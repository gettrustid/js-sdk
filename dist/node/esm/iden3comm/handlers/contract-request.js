import { CircuitId } from '../../circuits/models';
import { defaultAcceptProfile, PROTOCOL_MESSAGE_TYPE, ProtocolVersion } from '../constants';
import { DID, ChainIds, getUnixTimestamp, BytesHelper } from 'js-iden3-core-custom';
import { FunctionSignatures } from '../../storage';
import { processProofAuth, processZeroKnowledgeProofRequests, verifyExpiresTime } from './common';
import { AbstractMessageHandler } from './message-handler';
import { parseAcceptProfile } from '../utils';
import { hexToBytes } from '../../utils';
/**
 *
 * Allows to process ContractInvokeRequest protocol message
 *
 * @beta

 * @class ContractRequestHandler
 * @implements implements IContractRequestHandler interface
 */
export class ContractRequestHandler extends AbstractMessageHandler {
    /**
     * Creates an instance of ContractRequestHandler.
     * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
     * @param {IProofService} _proofService -  proof service to verify zk proofs
     * @param {IOnChainZKPVerifier} _zkpVerifier - zkp verifier to submit response
     * @param {IOnChainVerifierMultiQuery} _verifierMultiQuery - verifier multi-query to submit response
     *
     */
    constructor(_packerMgr, _proofService, _zkpVerifier) {
        super();
        this._packerMgr = _packerMgr;
        this._proofService = _proofService;
        this._zkpVerifier = _zkpVerifier;
        this._supportedCircuits = [
            CircuitId.AuthV2,
            CircuitId.AtomicQueryMTPV2OnChain,
            CircuitId.AtomicQuerySigV2OnChain,
            CircuitId.AtomicQueryV3OnChain,
            // Now we support off-chain circuits on-chain
            // TODO: We need to create validators for them
            CircuitId.AuthV2,
            CircuitId.AtomicQueryV3,
            CircuitId.LinkedMultiQuery10
        ];
    }
    async handle(message, ctx) {
        switch (message.type) {
            case PROTOCOL_MESSAGE_TYPE.CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE: {
                const ciMessage = message;
                const txHashResponsesMap = await this.handleContractInvoke(ciMessage, ctx);
                return this.createContractInvokeResponse(ciMessage, txHashResponsesMap);
            }
            default:
                return super.handle(message, ctx);
        }
    }
    async handleContractInvoke(message, ctx) {
        if (message.type !== PROTOCOL_MESSAGE_TYPE.CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid message type for contract invoke request');
        }
        const { senderDid: did, ethSigner, challenge } = ctx;
        if (!ctx.ethSigner) {
            throw new Error("Can't sign transaction. Provide Signer in options.");
        }
        const { chain_id } = message.body.transaction_data;
        const networkFlag = Object.keys(ChainIds).find((key) => ChainIds[key] === chain_id);
        if (!networkFlag) {
            throw new Error(`Invalid chain id ${chain_id}`);
        }
        const verifierDid = message.from ? DID.parse(message.from) : undefined;
        const { scope = [] } = message.body;
        const zkpResponses = await processZeroKnowledgeProofRequests(did, scope, verifierDid, this._proofService, {
            ethSigner,
            challenge: challenge ?? BytesHelper.bytesToInt(hexToBytes(await ethSigner.getAddress())),
            supportedCircuits: this._supportedCircuits
        });
        const methodId = message.body.transaction_data.method_id.replace('0x', '');
        switch (methodId) {
            case FunctionSignatures.SubmitZKPResponseV2: {
                const txHashZkpResponsesMap = await this._zkpVerifier.submitZKPResponseV2(ethSigner, message.body.transaction_data, zkpResponses);
                const response = new Map();
                for (const [txHash, zkpResponses] of txHashZkpResponsesMap) {
                    response.set(txHash, { responses: zkpResponses });
                }
                // set txHash of the first response
                message.body.transaction_data.txHash = txHashZkpResponsesMap.keys().next().value;
                return response;
            }
            case FunctionSignatures.SubmitZKPResponseV1: {
                const txHashZkpResponseMap = await this._zkpVerifier.submitZKPResponse(ethSigner, message.body.transaction_data, zkpResponses);
                const response = new Map();
                for (const [txHash, zkpResponse] of txHashZkpResponseMap) {
                    response.set(txHash, { responses: [zkpResponse] });
                }
                // set txHash of the first response
                message.body.transaction_data.txHash = txHashZkpResponseMap.keys().next().value;
                return response;
            }
            case FunctionSignatures.SubmitResponse: {
                // We need to
                // 1. Generate auth proof from message.body.accept -> authResponse
                // 2. Generate proofs for each query in scope -> zkpResponses
                // Build auth response from accept
                if (!message.to) {
                    throw new Error(`failed message. empty 'to' field`);
                }
                // Get first supported accept profile and pass it to processProofAuth
                const acceptProfile = this.getFirstSupportedProfile(PROTOCOL_MESSAGE_TYPE.CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE, message.body.accept);
                const identifier = DID.parse(message.to);
                const { authProof } = await processProofAuth(identifier, this._proofService, {
                    supportedCircuits: this._supportedCircuits,
                    acceptProfile,
                    senderAddress: await ethSigner.getAddress(),
                    zkpResponses: zkpResponses
                });
                // we return txHash because responsesMap could be empty if there are no queries in scope
                const txHashZkpResponsesMap = await this._zkpVerifier.submitResponse(ethSigner, message.body.transaction_data, zkpResponses, authProof);
                message.body.transaction_data.txHash = txHashZkpResponsesMap.keys().next().value;
                return txHashZkpResponsesMap;
            }
            default:
                throw new Error(`Not supported method id. Only '${FunctionSignatures.SubmitZKPResponseV1}, ${FunctionSignatures.SubmitZKPResponseV2} and ${FunctionSignatures.SubmitResponse} are supported.'`);
        }
    }
    getFirstSupportedProfile(responseType, profile) {
        if (profile?.length) {
            for (const acceptProfileString of profile) {
                // 1. check protocol version
                const acceptProfile = parseAcceptProfile(acceptProfileString);
                const responseTypeVersion = Number(responseType.split('/').at(-2));
                if (acceptProfile.protocolVersion !== ProtocolVersion.V1 ||
                    (acceptProfile.protocolVersion === ProtocolVersion.V1 &&
                        (responseTypeVersion < 1 || responseTypeVersion >= 2))) {
                    continue;
                }
                // 2. check packer support
                if (this._packerMgr.isProfileSupported(acceptProfile.env, acceptProfileString)) {
                    return acceptProfile;
                }
            }
        }
        // if we don't have supported profiles, we use default
        return defaultAcceptProfile;
    }
    /**
     * unpacks contract-invoke request
     * @beta
     * @param {Uint8Array} request - raw byte message
     * @returns `Promise<ContractInvokeRequest>`
     */
    async parseContractInvokeRequest(request) {
        const { unpackedMessage: message } = await this._packerMgr.unpack(request);
        const ciRequest = message;
        if (message.type !== PROTOCOL_MESSAGE_TYPE.CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid media type');
        }
        ciRequest.body.scope = ciRequest.body.scope || [];
        return ciRequest;
    }
    /**
     * creates contract invoke response
     * @private
     * @beta
     * @param {ContractInvokeRequest} request - ContractInvokeRequest
     * @param { Map<string, ZeroKnowledgeInvokeResponse>} responses - map tx hash to array of ZeroKnowledgeInvokeResponse
     * @returns `Promise<ContractInvokeResponse>`
     */
    async createContractInvokeResponse(request, txHashToZkpResponseMap) {
        const contractInvokeResponse = {
            id: request.id,
            thid: request.thid,
            type: PROTOCOL_MESSAGE_TYPE.CONTRACT_INVOKE_RESPONSE_MESSAGE_TYPE,
            from: request.to,
            to: request.from,
            body: {
                transaction_data: request.body.transaction_data,
                scope: []
            },
            created_time: getUnixTimestamp(new Date())
        };
        for (const [txHash, zkpResponses] of txHashToZkpResponseMap) {
            for (const zkpResponse of zkpResponses.responses) {
                contractInvokeResponse.body.scope.push({
                    txHash,
                    ...zkpResponse
                });
            }
            contractInvokeResponse.body = {
                ...contractInvokeResponse.body,
                crossChainProof: zkpResponses.crossChainProof,
                authProof: zkpResponses.authProof
            };
        }
        return contractInvokeResponse;
    }
    /**
     * handle contract invoke request
     * supports only 0xb68967e2 method id
     * @beta
     * @deprecated
     * @param {did} did  - sender DID
     * @param {ContractInvokeRequest} request  - contract invoke request
     * @param {ContractInvokeHandlerOptions} opts - handler options
     * @returns {Map<string, ZeroKnowledgeProofResponse>}` - map of transaction hash - ZeroKnowledgeProofResponse
     */
    async handleContractInvokeRequest(did, request, opts) {
        const ciRequest = await this.parseContractInvokeRequest(request);
        if (!opts.allowExpiredMessages) {
            verifyExpiresTime(ciRequest);
        }
        if (ciRequest.body.transaction_data.method_id !== FunctionSignatures.SubmitZKPResponseV1) {
            throw new Error(`please use handle method to work with other method ids`);
        }
        if (ciRequest.type !== PROTOCOL_MESSAGE_TYPE.CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid message type for contract invoke request');
        }
        const { ethSigner, challenge } = opts;
        if (!ethSigner) {
            throw new Error("Can't sign transaction. Provide Signer in options.");
        }
        const { chain_id } = ciRequest.body.transaction_data;
        const networkFlag = Object.keys(ChainIds).find((key) => ChainIds[key] === chain_id);
        if (!networkFlag) {
            throw new Error(`Invalid chain id ${chain_id}`);
        }
        const verifierDid = ciRequest.from ? DID.parse(ciRequest.from) : undefined;
        const zkpResponses = await processZeroKnowledgeProofRequests(did, ciRequest?.body?.scope, verifierDid, this._proofService, { ethSigner, challenge, supportedCircuits: this._supportedCircuits });
        return this._zkpVerifier.submitZKPResponse(ethSigner, ciRequest.body.transaction_data, zkpResponses);
    }
}
