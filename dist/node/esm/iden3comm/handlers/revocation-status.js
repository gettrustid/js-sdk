import { PROTOCOL_MESSAGE_TYPE } from '../constants';
import { MediaType } from '../constants';
import { DID } from 'js-iden3-core-custom';
import * as uuid from 'uuid';
import { byteEncoder } from '../../utils';
import { proving } from '@iden3/js-jwz';
import { AbstractMessageHandler } from './message-handler';
import { verifyExpiresTime } from './common';
/**
 *
 * Allows to process RevocationStatusRequest protocol message
 *

 * @class RevocationStatusHandler
 * @implements implements IRevocationStatusHandler interface
 */
export class RevocationStatusHandler extends AbstractMessageHandler {
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
            case PROTOCOL_MESSAGE_TYPE.REVOCATION_STATUS_REQUEST_MESSAGE_TYPE:
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
        const issuerDID = DID.parse(rsRequest.to);
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
            typ: MediaType.PlainMessage,
            type: PROTOCOL_MESSAGE_TYPE.REVOCATION_STATUS_RESPONSE_MESSAGE_TYPE,
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
        if (message.type !== PROTOCOL_MESSAGE_TYPE.REVOCATION_STATUS_REQUEST_MESSAGE_TYPE) {
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
                mediaType: MediaType.PlainMessage
            };
        }
        if (opts.mediaType === MediaType.SignedMessage && !opts.packerOptions) {
            throw new Error(`jws packer options are required for ${MediaType.SignedMessage}`);
        }
        const rsRequest = await this.parseRevocationStatusRequest(request);
        if (!opts.allowExpiredMessages) {
            verifyExpiresTime(rsRequest);
        }
        const response = await this.handleRevocationStatusRequestMessage(rsRequest, {
            senderDid: did,
            mediaType: opts.mediaType,
            packerOptions: opts.packerOptions,
            treeState: opts.treeState
        });
        const packerOpts = opts.mediaType === MediaType.SignedMessage
            ? opts.packerOptions
            : {
                provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
            };
        if (!rsRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        const senderDID = DID.parse(rsRequest.to);
        return this._packerMgr.pack(opts.mediaType, byteEncoder.encode(JSON.stringify(response)), {
            senderDID,
            ...packerOpts
        });
    }
}
