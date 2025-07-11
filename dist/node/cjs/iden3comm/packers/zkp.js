"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZKPPacker = exports.VerificationHandlerFunc = exports.DataPrepareHandlerFunc = void 0;
const js_jwz_1 = require("@iden3/js-jwz");
const index_1 = require("../../circuits/index");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const envelope_1 = require("../utils/envelope");
const errors_1 = require("../errors");
const constants_1 = require("../constants");
const utils_1 = require("../../utils");
const constants_2 = require("../constants");
const utils_2 = require("../utils");
const { getProvingMethod } = js_jwz_1.proving;
/**
 * Handler to
 *
 * @public
 * @class DataPrepareHandlerFunc
 */
class DataPrepareHandlerFunc {
    /**
     * Creates an instance of DataPrepareHandlerFunc.
     * @param {AuthDataPrepareFunc} dataPrepareFunc - function that produces marshaled inputs for auth circuits
     */
    constructor(dataPrepareFunc) {
        this.dataPrepareFunc = dataPrepareFunc;
    }
    /**
     *
     *
     * @param {Uint8Array} hash - challenge that will be signed
     * @param {DID} did - did of identity that will prepare inputs
     * @param {CircuitId} circuitId - circuit id
     * @returns `Promise<Uint8Array>`
     */
    prepare(hash, did, circuitId) {
        return this.dataPrepareFunc(hash, did, circuitId);
    }
}
exports.DataPrepareHandlerFunc = DataPrepareHandlerFunc;
/**
 * Handler to verify public signals of authorization circuits
 *
 * @public
 * @class VerificationHandlerFunc
 */
class VerificationHandlerFunc {
    /**
     * Creates an instance of VerificationHandlerFunc.
     * @param {StateVerificationFunc} stateVerificationFunc - state verification function
     */
    constructor(stateVerificationFunc) {
        this.stateVerificationFunc = stateVerificationFunc;
    }
    /**
     *
     *
     * @param {string} id  - id of circuit
     * @param {Array<string>} pubSignals - signals that must contain user id and state
     * @returns `Promise<boolean>`
     */
    verify(id, pubSignals, opts) {
        return this.stateVerificationFunc(id, pubSignals, opts);
    }
}
exports.VerificationHandlerFunc = VerificationHandlerFunc;
/**
 * Packer that can pack message to JWZ token,
 * and unpack and validate JWZ envelope
 * @public
 * @class ZKPPacker
 * @implements implements IPacker interface
 */
class ZKPPacker {
    /**
     * Creates an instance of ZKPPacker.
     * @param {Map<string, ProvingParams>} provingParamsMap - string is derived by JSON.parse(ProvingMethodAlg)
     * @param {Map<string, VerificationParams>} verificationParamsMap - string is derived by JSON.parse(ProvingMethodAlg)
     */
    constructor(provingParamsMap, verificationParamsMap, _opts = {
        acceptedStateTransitionDelay: constants_2.DEFAULT_AUTH_VERIFY_DELAY
    }) {
        this.provingParamsMap = provingParamsMap;
        this.verificationParamsMap = verificationParamsMap;
        this._opts = _opts;
        this.supportedProtocolVersions = [constants_1.ProtocolVersion.V1];
        this.supportedAlgorithms = [constants_1.AcceptJwzAlgorithms.Groth16];
        this.supportedCircuitIds = [constants_1.AcceptAuthCircuits.AuthV2];
    }
    /**
     * Packs a basic message using the specified parameters.
     * @param msg - The basic message to pack.
     * @param param - The parameters for the ZKPPacker.
     * @returns A promise that resolves to a Uint8Array representing the packed message.
     */
    packMessage(msg, param) {
        return this.pack(utils_1.byteEncoder.encode(JSON.stringify(msg)), param);
    }
    /**
     * creates JSON Web Zeroknowledge token
     *
     * @param {Uint8Array} payload - serialized message
     * @param {ZKPPackerParams} params - sender id and proving alg are required
     * @returns `Promise<Uint8Array>`
     */
    async pack(payload, params) {
        const provingMethod = await getProvingMethod(params.provingMethodAlg);
        const provingParams = this.provingParamsMap.get(params.provingMethodAlg.toString());
        if (!provingParams) {
            throw new Error(errors_1.ErrNoProvingMethodAlg);
        }
        const token = new js_jwz_1.Token(provingMethod, utils_1.byteDecoder.decode(payload), (hash, circuitId) => {
            return provingParams?.dataPreparer?.prepare(hash, params.senderDID, circuitId);
        });
        token.setHeader(js_jwz_1.Header.Type, constants_1.MediaType.ZKPMessage);
        const tokenStr = await token.prove(provingParams.provingKey, provingParams.wasm);
        return utils_1.byteEncoder.encode(tokenStr);
    }
    /**
     * validate envelope which is jwz token
     *
     * @param {Uint8Array} envelope
     * @returns `Promise<BasicMessage>`
     */
    async unpack(envelope) {
        const token = await js_jwz_1.Token.parse(utils_1.byteDecoder.decode(envelope));
        const provingMethodAlg = new js_jwz_1.ProvingMethodAlg(token.alg, token.circuitId);
        const verificationParams = this.verificationParamsMap.get(provingMethodAlg.toString());
        if (!verificationParams?.key) {
            throw new Error(errors_1.ErrPackedWithUnsupportedCircuit);
        }
        const isValid = await token.verify(verificationParams?.key);
        if (!isValid) {
            throw new Error(errors_1.ErrProofIsInvalid);
        }
        const verificationResult = await verificationParams?.verificationFn?.verify(token.circuitId, token.zkProof.pub_signals, this._opts);
        if (!verificationResult) {
            throw new Error(errors_1.ErrStateVerificationFailed);
        }
        const message = (0, envelope_1.bytesToProtocolMessage)(utils_1.byteEncoder.encode(token.getPayload()));
        // should throw if error
        verifySender(token, message);
        return message;
    }
    mediaType() {
        return constants_1.MediaType.ZKPMessage;
    }
    /** {@inheritDoc IPacker.getSupportedProfiles} */
    getSupportedProfiles() {
        return this.supportedProtocolVersions.map((v) => `${v};env=${this.mediaType()};alg=${this.supportedAlgorithms.join(',')};circuitIds=${this.supportedCircuitIds.join(',')}`);
    }
    /** {@inheritDoc IPacker.isProfileSupported} */
    isProfileSupported(profile) {
        const { protocolVersion, env, circuits, alg } = (0, utils_2.parseAcceptProfile)(profile);
        if (!this.supportedProtocolVersions.includes(protocolVersion)) {
            return false;
        }
        if (env !== this.mediaType()) {
            return false;
        }
        const supportedCircuitIds = this.supportedCircuitIds;
        const circuitIdSupported = !circuits?.length || circuits.some((c) => supportedCircuitIds.includes(c));
        const supportedAlgArr = this.supportedAlgorithms;
        const algSupported = !alg?.length || alg.some((a) => supportedAlgArr.includes(a));
        return algSupported && circuitIdSupported;
    }
}
exports.ZKPPacker = ZKPPacker;
const verifySender = async (token, msg) => {
    switch (token.circuitId) {
        case index_1.CircuitId.AuthV2:
            {
                if (!msg.from) {
                    throw new Error(errors_1.ErrSenderNotUsedTokenCreation);
                }
                const authSignals = new index_1.AuthV2PubSignals().pubSignalsUnmarshal(utils_1.byteEncoder.encode(JSON.stringify(token.zkProof.pub_signals)));
                const did = js_iden3_core_custom_1.DID.parseFromId(authSignals.userID);
                const msgHash = await token.getMessageHash();
                const challenge = js_iden3_core_custom_1.BytesHelper.bytesToInt(msgHash.reverse());
                if (challenge !== authSignals.challenge) {
                    throw new Error(errors_1.ErrSenderNotUsedTokenCreation);
                }
                if (msg.from !== did.string()) {
                    throw new Error(errors_1.ErrSenderNotUsedTokenCreation);
                }
            }
            break;
        default:
            throw new Error(errors_1.ErrUnknownCircuitID);
    }
};
