import { MediaType } from '../constants';
import { PROTOCOL_MESSAGE_TYPE } from '../constants';
import { W3CCredential } from '../../verifiable';
import { getUserDIDFromCredential } from '../../credentials';
import { byteDecoder, byteEncoder } from '../../utils';
import { proving } from '@iden3/js-jwz';
import { DID } from 'js-iden3-core-custom';
import * as uuid from 'uuid';
import { AbstractMessageHandler } from './message-handler';
import { verifyExpiresTime } from './common';
/**
 *
 * Allows to handle Credential offer protocol message and return fetched credential
 *
 * @public

 * @class FetchHandler
 * @implements implements IFetchHandler interface
 */
export class FetchHandler extends AbstractMessageHandler {
    /**
     * Constructs a new instance of the FetchHandler class.
     *
     * @param _packerMgr The package manager used for packing and unpacking data.
     * @param opts Optional configuration options for the FetchHandler.
     * @param opts.credentialWallet The credential wallet used for managing credentials.
     */
    constructor(_packerMgr, opts) {
        super();
        this._packerMgr = _packerMgr;
        this.opts = opts;
    }
    async handle(message, ctx) {
        switch (message.type) {
            case PROTOCOL_MESSAGE_TYPE.CREDENTIAL_OFFER_MESSAGE_TYPE: {
                const result = await this.handleOfferMessage(message, ctx);
                if (Array.isArray(result)) {
                    const credWallet = this.opts?.credentialWallet;
                    if (!credWallet)
                        throw new Error('Credential wallet is not provided');
                    await credWallet.saveAll(result);
                    return null;
                }
                return result;
            }
            case PROTOCOL_MESSAGE_TYPE.CREDENTIAL_FETCH_REQUEST_MESSAGE_TYPE:
                return this.handleFetchRequest(message);
            case PROTOCOL_MESSAGE_TYPE.CREDENTIAL_ISSUANCE_RESPONSE_MESSAGE_TYPE:
                return this.handleIssuanceResponseMsg(message);
            case PROTOCOL_MESSAGE_TYPE.CREDENTIAL_ONCHAIN_OFFER_MESSAGE_TYPE: {
                const result = await this.handleOnchainOfferMessage(message);
                if (Array.isArray(result)) {
                    const credWallet = this.opts?.credentialWallet;
                    if (!credWallet)
                        throw new Error('Credential wallet is not provided');
                    await credWallet.saveAll(result);
                    return null;
                }
                return result;
            }
            default:
                return super.handle(message, ctx);
        }
    }
    async handleOnchainOfferMessage(offerMessage) {
        if (!this.opts?.onchainIssuer) {
            throw new Error('onchain issuer is not provided');
        }
        const credentials = [];
        for (const credentialInfo of offerMessage.body.credentials) {
            const issuerDID = DID.parse(offerMessage.from);
            const userDID = DID.parse(offerMessage.to);
            const credential = await this.opts.onchainIssuer.getCredential(issuerDID, userDID, BigInt(credentialInfo.id));
            credentials.push(credential);
        }
        return credentials;
    }
    async handleOfferMessage(offerMessage, ctx) {
        if (!ctx.mediaType) {
            ctx.mediaType = MediaType.ZKPMessage;
        }
        const credentials = [];
        for (const credentialInfo of offerMessage.body.credentials) {
            const guid = uuid.v4();
            const fetchRequest = {
                id: guid,
                typ: ctx.mediaType,
                type: PROTOCOL_MESSAGE_TYPE.CREDENTIAL_FETCH_REQUEST_MESSAGE_TYPE,
                thid: offerMessage.thid ?? guid,
                body: {
                    id: credentialInfo.id
                },
                from: offerMessage.to,
                to: offerMessage.from
            };
            const msgBytes = byteEncoder.encode(JSON.stringify(fetchRequest));
            const packerOpts = ctx.mediaType === MediaType.SignedMessage
                ? ctx.packerOptions
                : {
                    provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
                };
            const senderDID = DID.parse(offerMessage.to);
            const token = byteDecoder.decode(await this._packerMgr.pack(ctx.mediaType, msgBytes, {
                senderDID,
                ...packerOpts
            }));
            try {
                if (!offerMessage?.body?.url) {
                    throw new Error(`could not fetch W3C credential, body url is missing`);
                }
                const resp = await fetch(offerMessage.body.url, {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        ...ctx.headers
                    },
                    body: token
                });
                const arrayBuffer = await resp.arrayBuffer();
                if (!arrayBuffer.byteLength) {
                    throw new Error(`could not fetch , ${credentialInfo?.id}, response is empty`);
                }
                const { unpackedMessage: message } = await this._packerMgr.unpack(new Uint8Array(arrayBuffer));
                if (message.type !== PROTOCOL_MESSAGE_TYPE.CREDENTIAL_ISSUANCE_RESPONSE_MESSAGE_TYPE) {
                    return message;
                }
                credentials.push(W3CCredential.fromJSON(message.body.credential));
            }
            catch (e) {
                throw new Error(`could not fetch protocol message for credential offer id: , ${credentialInfo?.id}, error: ${e.message ?? e}`);
            }
        }
        return credentials;
    }
    /**
     * Handles only messages with credentials/1.0/offer type
     *
     * @param {
     *     offer: Uint8Array; offer - raw offer message
     *     opts
     *   }) options how to fetch credential
     * @returns `Promise<W3CCredential[]>`
     */
    async handleCredentialOffer(offer, opts) {
        if (opts?.mediaType === MediaType.SignedMessage && !opts.packerOptions) {
            throw new Error(`jws packer options are required for ${MediaType.SignedMessage}`);
        }
        const offerMessage = await FetchHandler.unpackMessage(this._packerMgr, offer, PROTOCOL_MESSAGE_TYPE.CREDENTIAL_OFFER_MESSAGE_TYPE);
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(offerMessage);
        }
        const result = await this.handleOfferMessage(offerMessage, {
            mediaType: opts?.mediaType,
            headers: opts?.headers,
            packerOptions: opts?.packerOptions
        });
        if (Array.isArray(result)) {
            return result;
        }
        throw new Error('invalid protocol message response');
    }
    /**
     * Handles only messages with credentials/1.0/onchain-offer type
     * @beta
     */
    async handleOnchainOffer(offer) {
        const offerMessage = await FetchHandler.unpackMessage(this._packerMgr, offer, PROTOCOL_MESSAGE_TYPE.CREDENTIAL_ONCHAIN_OFFER_MESSAGE_TYPE);
        return this.handleOnchainOfferMessage(offerMessage);
    }
    async handleFetchRequest(msgRequest) {
        if (!msgRequest.to) {
            throw new Error("failed request. empty 'to' field");
        }
        if (!msgRequest.from) {
            throw new Error("failed request. empty 'from' field");
        }
        const issuerDID = DID.parse(msgRequest.to);
        const userDID = DID.parse(msgRequest.from);
        const credId = msgRequest.body?.id;
        if (!credId) {
            throw new Error('invalid credential id in fetch request body');
        }
        if (!this.opts?.credentialWallet) {
            throw new Error('please, provide credential wallet in options');
        }
        const cred = await this.opts.credentialWallet.findById(credId);
        if (!cred) {
            throw new Error('credential not found');
        }
        const userToVerifyDID = getUserDIDFromCredential(issuerDID, cred);
        if (userToVerifyDID.string() !== userDID.string()) {
            throw new Error('credential subject is not a sender DID');
        }
        return {
            id: uuid.v4(),
            type: PROTOCOL_MESSAGE_TYPE.CREDENTIAL_ISSUANCE_RESPONSE_MESSAGE_TYPE,
            typ: msgRequest.typ ?? MediaType.PlainMessage,
            thid: msgRequest.thid ?? uuid.v4(),
            body: { credential: cred },
            from: msgRequest.to,
            to: msgRequest.from
        };
    }
    /**
     * @inheritdoc IFetchHandler#handleCredentialFetchRequest
     */
    async handleCredentialFetchRequest(envelope, opts) {
        const msgRequest = await FetchHandler.unpackMessage(this._packerMgr, envelope, PROTOCOL_MESSAGE_TYPE.CREDENTIAL_FETCH_REQUEST_MESSAGE_TYPE);
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(msgRequest);
        }
        const request = await this.handleFetchRequest(msgRequest);
        return this._packerMgr.pack(MediaType.PlainMessage, byteEncoder.encode(JSON.stringify(request)), {});
    }
    async handleIssuanceResponseMsg(issuanceMsg) {
        if (!this.opts?.credentialWallet) {
            throw new Error('please provide credential wallet in options');
        }
        if (!issuanceMsg.body?.credential) {
            throw new Error('credential is missing in issuance response message');
        }
        await this.opts.credentialWallet.save(W3CCredential.fromJSON(issuanceMsg.body.credential));
        return null;
    }
    /**
     * @inheritdoc IFetchHandler#handleIssuanceResponseMessage
     */
    async handleIssuanceResponseMessage(envelop, opts) {
        const issuanceMsg = await FetchHandler.unpackMessage(this._packerMgr, envelop, PROTOCOL_MESSAGE_TYPE.CREDENTIAL_ISSUANCE_RESPONSE_MESSAGE_TYPE);
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(issuanceMsg);
        }
        await this.handleIssuanceResponseMsg(issuanceMsg);
        return Uint8Array.from([]);
    }
    /**
     * @inheritdoc IFetchHandler#unpackMessage
     */
    static async unpackMessage(packerMgr, envelope, messageType) {
        const { unpackedMessage: message } = await packerMgr.unpack(envelope);
        const msgRequest = message;
        if (message.type !== messageType) {
            throw new Error('Invalid message type');
        }
        return msgRequest;
    }
}
