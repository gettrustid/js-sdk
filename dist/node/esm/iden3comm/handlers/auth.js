import { MediaType } from '../constants';
import { PROTOCOL_MESSAGE_TYPE } from '../constants';
import { DID, getUnixTimestamp } from 'js-iden3-core-custom';
import { proving } from '@iden3/js-jwz';
import * as uuid from 'uuid';
import { byteDecoder, byteEncoder } from '../../utils';
import { processZeroKnowledgeProofRequests, verifyExpiresTime } from './common';
import { CircuitId } from '../../circuits';
import { AbstractMessageHandler } from './message-handler';
import { parseAcceptProfile } from '../utils';
/**
 *  createAuthorizationRequest is a function to create protocol authorization request
 * @param {string} reason - reason to request proof
 * @param {string} sender - sender did
 * @param {string} callbackUrl - callback that user should use to send response
 * @param {AuthorizationRequestCreateOptions} opts - authorization request options
 * @returns `Promise<AuthorizationRequestMessage>`
 */
export function createAuthorizationRequest(reason, sender, callbackUrl, opts) {
    return createAuthorizationRequestWithMessage(reason, '', sender, callbackUrl, opts);
}
/**
 *  createAuthorizationRequestWithMessage is a function to create protocol authorization request with explicit message to sign
 * @param {string} reason - reason to request proof
 * @param {string} message - message to sign in the response
 * @param {string} sender - sender did
 * @param {string} callbackUrl - callback that user should use to send response
 * @param {AuthorizationRequestCreateOptions} opts - authorization request options
 * @returns `Promise<AuthorizationRequestMessage>`
 */
export function createAuthorizationRequestWithMessage(reason, message, sender, callbackUrl, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender,
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
        body: {
            accept: opts?.accept,
            reason: reason,
            message: message,
            callbackUrl: callbackUrl,
            scope: opts?.scope ?? []
        },
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time ? getUnixTimestamp(opts.expires_time) : undefined
    };
    return request;
}
/**
 *
 * Allows to process AuthorizationRequest protocol message and produce JWZ response.
 *
 * @public

 * @class AuthHandler
 * @implements implements IAuthHandler interface
 */
export class AuthHandler extends AbstractMessageHandler {
    /**
     * Creates an instance of AuthHandler.
     * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
     * @param {IProofService} _proofService -  proof service to verify zk proofs
     *
     */
    constructor(_packerMgr, _proofService) {
        super();
        this._packerMgr = _packerMgr;
        this._proofService = _proofService;
        this._supportedCircuits = [
            CircuitId.AtomicQueryV3,
            CircuitId.AtomicQuerySigV2,
            CircuitId.AtomicQueryMTPV2,
            CircuitId.LinkedMultiQuery10
        ];
    }
    handle(message, ctx) {
        switch (message.type) {
            case PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE:
                return this.handleAuthRequest(message, ctx);
            case PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_RESPONSE_MESSAGE_TYPE:
                return this.handleAuthResponse(message, ctx);
            default:
                return super.handle(message, ctx);
        }
    }
    /**
     * @inheritdoc IAuthHandler#parseAuthorizationRequest
     */
    async parseAuthorizationRequest(request) {
        const { unpackedMessage: message } = await this._packerMgr.unpack(request);
        const authRequest = message;
        if (message.type !== PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid media type');
        }
        authRequest.body.scope = authRequest.body.scope || [];
        return authRequest;
    }
    async handleAuthRequest(authRequest, ctx) {
        if (authRequest.type !== PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid message type for authorization request');
        }
        // override sender did if it's explicitly specified in the auth request
        const to = authRequest.to ? DID.parse(authRequest.to) : ctx.senderDid;
        const guid = uuid.v4();
        if (!authRequest.from) {
            throw new Error('auth request should contain from field');
        }
        const responseType = PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_RESPONSE_MESSAGE_TYPE;
        const mediaType = this.getSupportedMediaTypeByProfile(ctx, responseType, authRequest.body.accept);
        const from = DID.parse(authRequest.from);
        const responseScope = await processZeroKnowledgeProofRequests(to, authRequest?.body.scope, from, this._proofService, { mediaType, supportedCircuits: this._supportedCircuits });
        return {
            id: guid,
            typ: mediaType,
            type: responseType,
            thid: authRequest.thid ?? guid,
            body: {
                message: authRequest?.body?.message,
                scope: responseScope
            },
            from: to.string(),
            to: authRequest.from
        };
    }
    /**
     * @inheritdoc IAuthHandler#handleAuthorizationRequest
     */
    async handleAuthorizationRequest(did, request, opts) {
        const authRequest = await this.parseAuthorizationRequest(request);
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(authRequest);
        }
        if (!opts) {
            opts = {
                mediaType: MediaType.ZKPMessage
            };
        }
        if (opts.mediaType === MediaType.SignedMessage && !opts.packerOptions) {
            throw new Error(`jws packer options are required for ${MediaType.SignedMessage}`);
        }
        const authResponse = await this.handleAuthRequest(authRequest, {
            senderDid: did,
            mediaType: opts.mediaType
        });
        const msgBytes = byteEncoder.encode(JSON.stringify(authResponse));
        const packerOpts = opts.mediaType === MediaType.SignedMessage
            ? opts.packerOptions
            : {
                provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
            };
        const token = byteDecoder.decode(await this._packerMgr.pack(opts.mediaType, msgBytes, {
            senderDID: did,
            ...packerOpts
        }));
        return { authRequest, authResponse, token };
    }
    async handleAuthResponse(response, ctx) {
        const request = ctx.request;
        if (response.type !== PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_RESPONSE_MESSAGE_TYPE) {
            throw new Error('Invalid message type for authorization response');
        }
        if ((request.body.message ?? '') !== (response.body.message ?? '')) {
            throw new Error('message for signing from request is not presented in response');
        }
        if (request.from !== response.to) {
            throw new Error(`sender of the request is not a target of response - expected ${request.from}, given ${response.to}`);
        }
        this.verifyAuthRequest(request);
        const requestScope = request.body.scope || [];
        const responseScope = response.body.scope || [];
        if (!response.from) {
            throw new Error(`proof response doesn't contain from field`);
        }
        const groupIdToLinkIdMap = new Map();
        // group requests by query group id
        for (const proofRequest of requestScope) {
            const groupId = proofRequest.query.groupId;
            const proofResp = responseScope.find((resp) => resp.id.toString() === proofRequest.id.toString());
            if (!proofResp) {
                throw new Error(`proof is not given for requestId ${proofRequest.id}`);
            }
            const circuitId = proofResp.circuitId;
            if (circuitId !== proofRequest.circuitId) {
                throw new Error(`proof is not given for requested circuit expected: ${proofRequest.circuitId}, given ${circuitId}`);
            }
            const params = proofRequest.params ?? {};
            params.verifierDid = DID.parse(request.from);
            const opts = [ctx.acceptedProofGenerationDelay, ctx.acceptedStateTransitionDelay].some((delay) => delay !== undefined)
                ? {
                    acceptedProofGenerationDelay: ctx.acceptedProofGenerationDelay,
                    acceptedStateTransitionDelay: ctx.acceptedStateTransitionDelay
                }
                : undefined;
            const { linkID } = await this._proofService.verifyZKPResponse(proofResp, {
                query: proofRequest.query,
                sender: response.from,
                params,
                opts
            });
            // write linkId to the proof response
            // const pubSig = pubSignals as unknown as { linkID?: number };
            if (linkID && groupId) {
                groupIdToLinkIdMap.set(groupId, [
                    ...(groupIdToLinkIdMap.get(groupId) ?? []),
                    { linkID: linkID, requestId: proofResp.id }
                ]);
            }
        }
        // verify grouping links
        for (const [groupId, metas] of groupIdToLinkIdMap.entries()) {
            // check that all linkIds are the same
            if (metas.some((meta) => meta.linkID !== metas[0].linkID)) {
                throw new Error(`Link id validation failed for group ${groupId}, request linkID to requestIds info: ${JSON.stringify(metas)}`);
            }
        }
        return response;
    }
    /**
     * @inheritdoc IAuthHandler#handleAuthorizationResponse
     */
    async handleAuthorizationResponse(response, request, opts) {
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(response);
        }
        const authResp = (await this.handleAuthResponse(response, {
            request,
            acceptedStateTransitionDelay: opts?.acceptedStateTransitionDelay,
            acceptedProofGenerationDelay: opts?.acceptedProofGenerationDelay
        }));
        return { request, response: authResp };
    }
    verifyAuthRequest(request) {
        const groupIdValidationMap = {};
        const requestScope = request.body.scope || [];
        for (const proofRequest of requestScope) {
            const groupId = proofRequest.query.groupId;
            if (groupId) {
                const existingRequests = groupIdValidationMap[groupId] ?? [];
                //validate that all requests in the group have the same schema, issuer and circuit
                for (const existingRequest of existingRequests) {
                    if (existingRequest.query.type !== proofRequest.query.type) {
                        throw new Error(`all requests in the group should have the same type`);
                    }
                    if (existingRequest.query.context !== proofRequest.query.context) {
                        throw new Error(`all requests in the group should have the same context`);
                    }
                    const allowedIssuers = proofRequest.query.allowedIssuers;
                    const existingRequestAllowedIssuers = existingRequest.query.allowedIssuers;
                    if (!(allowedIssuers.includes('*') ||
                        allowedIssuers.every((issuer) => existingRequestAllowedIssuers.includes(issuer)))) {
                        throw new Error(`all requests in the group should have the same issuer`);
                    }
                }
                groupIdValidationMap[groupId] = [...(groupIdValidationMap[groupId] ?? []), proofRequest];
            }
        }
    }
    getSupportedMediaTypeByProfile(ctx, responseType, profile) {
        let mediaType;
        if (!profile?.length) {
            return ctx.mediaType || MediaType.ZKPMessage;
        }
        const supportedMediaTypes = [];
        for (const acceptProfile of profile) {
            const { env } = parseAcceptProfile(acceptProfile);
            if (this._packerMgr.isProfileSupported(env, acceptProfile)) {
                supportedMediaTypes.push(env);
            }
        }
        if (!supportedMediaTypes.length) {
            throw new Error('no packer with profile which meets `accept` header requirements');
        }
        mediaType = supportedMediaTypes.includes(MediaType.ZKPMessage)
            ? MediaType.ZKPMessage
            : supportedMediaTypes[0];
        if (ctx.mediaType && supportedMediaTypes.includes(ctx.mediaType)) {
            mediaType = ctx.mediaType;
        }
        return mediaType;
    }
}
