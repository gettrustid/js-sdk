"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevocationStatusHandler = void 0;
const constants_1 = require("../constants");
const constants_2 = require("../constants");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const uuid = __importStar(require("uuid"));
const utils_1 = require("../../utils");
const js_jwz_1 = require("@iden3/js-jwz");
const message_handler_1 = require("./message-handler");
const common_1 = require("./common");
/**
 *
 * Allows to process RevocationStatusRequest protocol message
 *

 * @class RevocationStatusHandler
 * @implements implements IRevocationStatusHandler interface
 */
class RevocationStatusHandler extends message_handler_1.AbstractMessageHandler {
    /**
     * Creates an instance of RevocationStatusHandler.
     * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
     * @param {IIdentityWallet} _identityWallet - identity wallet
     *
     */
    constructor(_packerMgr, _identityWallet) {
        super();
        this._packerMgr = _packerMgr;
        this._identityWallet = _identityWallet;
    }
    handle(message, context) {
        if (!context.senderDid) {
            throw new Error('DID is required');
        }
        if (!context.mediaType) {
            throw new Error('mediaType is required');
        }
        switch (message.type) {
            case constants_1.PROTOCOL_MESSAGE_TYPE.REVOCATION_STATUS_REQUEST_MESSAGE_TYPE:
                return this.handleRevocationStatusRequestMessage(message, context);
            default:
                return super.handle(message, context);
        }
    }
    async handleRevocationStatusRequestMessage(rsRequest, context) {
        if (!rsRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        if (!rsRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!rsRequest.body?.revocation_nonce) {
            throw new Error(`failed request. empty 'revocation_nonce' field`);
        }
        const issuerDID = js_iden3_core_custom_1.DID.parse(rsRequest.to);
        const mtpWithTreeState = await this._identityWallet.generateNonRevocationMtpWithNonce(issuerDID, BigInt(rsRequest.body.revocation_nonce), context.treeState);
        const treeState = mtpWithTreeState.treeState;
        const revStatus = {
            issuer: {
                state: treeState?.state.string(),
                claimsTreeRoot: treeState.claimsRoot.string(),
                revocationTreeRoot: treeState.revocationRoot.string(),
                rootOfRoots: treeState.rootOfRoots.string()
            },
            mtp: mtpWithTreeState.proof
        };
        const guid = uuid.v4();
        const response = {
            id: guid,
            typ: constants_2.MediaType.PlainMessage,
            type: constants_1.PROTOCOL_MESSAGE_TYPE.REVOCATION_STATUS_RESPONSE_MESSAGE_TYPE,
            thid: rsRequest.thid ?? guid,
            body: revStatus,
            from: context.senderDid.string(),
            to: rsRequest.from
        };
        return response;
    }
    /**
     * @inheritdoc IRevocationStatusHandler#parseRevocationStatusRequest
     */
    async parseRevocationStatusRequest(request) {
        const { unpackedMessage: message } = await this._packerMgr.unpack(request);
        const ciRequest = message;
        if (message.type !== constants_1.PROTOCOL_MESSAGE_TYPE.REVOCATION_STATUS_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid media type');
        }
        return ciRequest;
    }
    /**
     * @inheritdoc IRevocationStatusHandler#handleRevocationStatusRequest
     */
    async handleRevocationStatusRequest(did, request, opts) {
        if (!opts) {
            opts = {
                mediaType: constants_2.MediaType.PlainMessage
            };
        }
        if (opts.mediaType === constants_2.MediaType.SignedMessage && !opts.packerOptions) {
            throw new Error(`jws packer options are required for ${constants_2.MediaType.SignedMessage}`);
        }
        const rsRequest = await this.parseRevocationStatusRequest(request);
        if (!opts.allowExpiredMessages) {
            (0, common_1.verifyExpiresTime)(rsRequest);
        }
        const response = await this.handleRevocationStatusRequestMessage(rsRequest, {
            senderDid: did,
            mediaType: opts.mediaType,
            packerOptions: opts.packerOptions,
            treeState: opts.treeState
        });
        const packerOpts = opts.mediaType === constants_2.MediaType.SignedMessage
            ? opts.packerOptions
            : {
                provingMethodAlg: js_jwz_1.proving.provingMethodGroth16AuthV2Instance.methodAlg
            };
        if (!rsRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        const senderDID = js_iden3_core_custom_1.DID.parse(rsRequest.to);
        return this._packerMgr.pack(opts.mediaType, utils_1.byteEncoder.encode(JSON.stringify(response)), {
            senderDID,
            ...packerOpts
        });
    }
}
exports.RevocationStatusHandler = RevocationStatusHandler;
