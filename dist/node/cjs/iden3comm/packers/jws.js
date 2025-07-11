"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWSPacker = void 0;
const constants_1 = require("../constants");
const did_1 = require("../utils/did");
const kms_1 = require("../../kms/");
const did_jwt_1 = require("did-jwt");
const did_resolver_1 = require("did-resolver");
const encoding_1 = require("../../utils/encoding");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
/**
 * Packer that can pack message to JWZ token,
 * and unpack and validate JWZ envelope
 * @public
 * @class ZKPPacker
 * @implements implements IPacker interface
 */
class JWSPacker {
    /**
     * Creates an instance of JWSPacker.
     *
     * @param {KMS} _kms
     * @param {Resolvable} _documentResolver
     * @memberof JWSPacker
     */
    constructor(_kms, _documentResolver) {
        this._kms = _kms;
        this._documentResolver = _documentResolver;
        this.supportedAlgorithms = [constants_1.AcceptJwsAlgorithms.ES256K, constants_1.AcceptJwsAlgorithms.ES256KR];
        this.supportedProtocolVersions = [constants_1.ProtocolVersion.V1];
    }
    /**
     * Packs the given payload and returns a promise that resolves to the packed data.
     *
     * @param {Uint8Array} payload - The payload to be packed.
     * @param {PackerParams} param - The packing parameters.
     * @returns `Promise<Uint8Array>`
     */
    packMessage(msg, param) {
        return this.packInternal(msg, param);
    }
    /**
     * creates JSON Web Signature token
     *
     * @param {Uint8Array} payload - serialized message
     * @param {PackerParams} params - sender id and proving alg are required
     * @returns `Promise<Uint8Array>`
     */
    async pack(payload, params) {
        const message = JSON.parse(utils_1.byteDecoder.decode(payload));
        return this.packInternal(message, params);
    }
    /**
     * validate envelope which is jwz token
     *
     * @param {Uint8Array} envelope
     * @returns `Promise<BasicMessage>`
     */
    async unpack(envelope) {
        const jws = utils_1.byteDecoder.decode(envelope);
        const [headerStr, msgStr] = jws.split('.');
        const header = JSON.parse((0, utils_1.decodeBase64url)(headerStr));
        const message = JSON.parse((0, utils_1.decodeBase64url)(msgStr));
        const explicitSender = (0, did_resolver_1.parse)(header.kid)?.did;
        if (explicitSender && explicitSender !== message.from) {
            throw new Error(`Sender does not match DID in message with kid ${header?.kid}`);
        }
        const didDocument = await this.resolveDidDoc(message.from);
        let vms = (0, did_1.resolveVerificationMethods)(didDocument);
        if (!vms?.length) {
            throw new Error(`No verification methods defined in the DID document of ${didDocument.id}`);
        }
        if (header.kid) {
            const vm = vms.find((v) => {
                return v.id === header.kid;
            });
            if (!vm) {
                throw new Error(`verification method with specified kid ${header.kid} is not found in the DID Document`);
            }
            vms = [vm];
        }
        const verificationResponse = (0, did_jwt_1.verifyJWS)(jws, vms);
        if (!verificationResponse) {
            throw new Error('JWS verification failed');
        }
        return message;
    }
    mediaType() {
        return constants_1.MediaType.SignedMessage;
    }
    /** {@inheritDoc IPacker.getSupportedProfiles} */
    getSupportedProfiles() {
        return this.supportedProtocolVersions.map((v) => `${v};env=${this.mediaType()};alg=${this.supportedAlgorithms.join(',')}`);
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
        if (circuits) {
            throw new Error(`Circuits are not supported for ${env} media type`);
        }
        const algSupported = !alg?.length || alg.some((a) => this.supportedAlgorithms.includes(a));
        return algSupported;
    }
    async resolveDidDoc(from) {
        let didDocument;
        try {
            const didResolutionResult = await this._documentResolver.resolve(from);
            if (!didResolutionResult?.didDocument?.id) {
                throw new Error(`did document for ${from} is not found in resolution result`);
            }
            didDocument = didResolutionResult.didDocument;
        }
        catch (err) {
            throw new Error(`did document for ${from} is not resolved: ${err.message}`);
        }
        return didDocument;
    }
    async packInternal(message, params) {
        if (!params.alg) {
            throw new Error('Missing algorithm');
        }
        const from = message.from ?? '';
        if (!from) {
            throw new Error('Missing sender DID');
        }
        const vmTypes = constants_1.SUPPORTED_PUBLIC_KEY_TYPES[params.alg];
        if (!vmTypes?.length) {
            throw new Error(`No supported verification methods for algorithm ${params.alg}`);
        }
        const didDocument = params.didDocument ?? (await this.resolveDidDoc(from));
        const vms = (0, did_1.resolveVerificationMethods)(didDocument);
        if (!vms.length) {
            throw new Error(`No verification methods defined in the DID document of ${didDocument.id}`);
        }
        // try to find a managed signing key that matches keyRef
        const vm = params.kid ? vms.find((vm) => vm.id === params.kid) : vms[0];
        if (!vm) {
            throw new Error(`No key found with id ${params.kid} in DID document of ${didDocument.id}`);
        }
        const { publicKeyBytes, kmsKeyType } = (0, did_1.extractPublicKeyBytes)(vm);
        if (!publicKeyBytes && !kmsKeyType) {
            if ((vm.blockchainAccountId || vm.ethereumAddress) && !params.signer) {
                throw new Error(`No signer provided for ${vm.blockchainAccountId || vm.ethereumAddress}`);
            }
        }
        const kid = vm.id;
        const headerObj = { alg: params.alg, kid, typ: constants_1.MediaType.SignedMessage };
        const header = (0, utils_1.encodeBase64url)(JSON.stringify(headerObj));
        const msg = (0, utils_1.encodeBase64url)(JSON.stringify(message));
        const signingInput = `${header}.${msg}`;
        const signingInputBytes = utils_1.byteEncoder.encode(signingInput);
        let signatureBase64;
        if (params.signer) {
            const signature = await params.signer(vm, signingInputBytes);
            signatureBase64 = (0, encoding_1.bytesToBase64url)(signature);
        }
        else {
            if (!publicKeyBytes) {
                throw new Error('No public key found');
            }
            if (!kmsKeyType) {
                throw new Error('No KMS key type found');
            }
            const signatureBytes = await this._kms.sign({ type: kmsKeyType, id: (0, kms_1.keyPath)(kmsKeyType, (0, utils_1.bytesToHex)(publicKeyBytes)) }, signingInputBytes, { alg: params.alg });
            signatureBase64 = (0, encoding_1.bytesToBase64url)(signatureBytes);
        }
        return utils_1.byteEncoder.encode(`${signingInput}.${signatureBase64}`);
    }
}
exports.JWSPacker = JWSPacker;
