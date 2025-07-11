import { PROTOCOL_MESSAGE_TYPE, MediaType } from '../constants';
import { DID, getUnixTimestamp } from 'js-iden3-core-custom';
import * as uuid from 'uuid';
import { proving } from '@iden3/js-jwz';
import { byteEncoder } from '../../utils';
import { AbstractMessageHandler } from './message-handler';
import { verifyExpiresTime } from './common';
/**
 * @beta
 * createProposalRequest is a function to create protocol proposal-request protocol message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {ProposalRequestCreationOptions} opts - creation options
 * @returns `Promise<ProposalRequestMessage>`
 */
export function createProposalRequest(sender, receiver, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.PROPOSAL_REQUEST_MESSAGE_TYPE,
        body: opts,
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time ? getUnixTimestamp(opts.expires_time) : undefined
    };
    return request;
}
/**
 * @beta
 * createProposal is a function to create protocol proposal protocol message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {Proposal[]} proposals - proposals
 * @returns `Promise<ProposalRequestMessage>`
 */
export function createProposal(sender, receiver, proposals, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.PROPOSAL_MESSAGE_TYPE,
        body: {
            proposals: proposals || []
        },
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time ? getUnixTimestamp(opts.expires_time) : undefined
    };
    return request;
}
/**
 *
 * Allows to process ProposalRequest protocol message
 * @beta
 * @class CredentialProposalHandler
 * @implements implements ICredentialProposalHandler interface
 */
export class CredentialProposalHandler extends AbstractMessageHandler {
    /**
     * @beta Creates an instance of CredentialProposalHandler.
     * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
     * @param {IIdentityWallet} _identityWallet - identity wallet
     * @param {CredentialProposalHandlerParams} _params - credential proposal handler params
     *
     */
    constructor(_packerMgr, _identityWallet, _params) {
        super();
        this._packerMgr = _packerMgr;
        this._identityWallet = _identityWallet;
        this._params = _params;
    }
    async handle(message, context) {
        switch (message.type) {
            case PROTOCOL_MESSAGE_TYPE.PROPOSAL_REQUEST_MESSAGE_TYPE:
                return (await this.handleProposalRequestMessage(message, context));
            default:
                return super.handle(message, context);
        }
    }
    /**
     * @inheritdoc ICredentialProposalHandler#parseProposalRequest
     */
    async parseProposalRequest(request) {
        const { unpackedMessage: message } = await this._packerMgr.unpack(request);
        const proposalRequest = message;
        if (message.type !== PROTOCOL_MESSAGE_TYPE.PROPOSAL_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid media type');
        }
        return proposalRequest;
    }
    async handleProposalRequestMessage(proposalRequest, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ctx) {
        if (!proposalRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        if (!proposalRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!proposalRequest.body?.credentials?.length) {
            throw new Error(`failed request. no 'credentials' in body`);
        }
        let credOfferMessage = undefined;
        let proposalMessage = undefined;
        for (let i = 0; i < proposalRequest.body.credentials.length; i++) {
            const cred = proposalRequest.body.credentials[i];
            // check if there is credentials in the wallet
            let credsFromWallet = [];
            try {
                credsFromWallet = await this._identityWallet.credentialWallet.findByQuery({
                    credentialSubject: {
                        id: {
                            $eq: proposalRequest.from
                        }
                    },
                    type: cred.type,
                    context: cred.context,
                    allowedIssuers: [proposalRequest.to]
                });
            }
            catch (e) {
                if (e.message !== 'no credential satisfied query') {
                    throw e;
                }
            }
            if (credsFromWallet.length) {
                const guid = uuid.v4();
                if (!credOfferMessage) {
                    credOfferMessage = {
                        id: guid,
                        typ: this._params.packerParams.mediaType,
                        type: PROTOCOL_MESSAGE_TYPE.CREDENTIAL_OFFER_MESSAGE_TYPE,
                        thid: proposalRequest.thid ?? guid,
                        body: {
                            url: this._params.agentUrl,
                            credentials: []
                        },
                        from: proposalRequest.to,
                        to: proposalRequest.from
                    };
                }
                credOfferMessage.body.credentials.push(...credsFromWallet.map((c) => ({
                    id: c.id,
                    description: ''
                })));
                continue;
            }
            // credential not found in the wallet, prepare proposal protocol message
            const proposal = await this._params.proposalResolverFn(cred.context, cred.type);
            if (!proposal) {
                throw new Error(`can't resolve Proposal for type: ${cred.type}, context: ${cred.context}`);
            }
            if (!proposalMessage) {
                const guid = uuid.v4();
                proposalMessage = {
                    id: guid,
                    typ: this._params.packerParams.mediaType,
                    type: PROTOCOL_MESSAGE_TYPE.PROPOSAL_MESSAGE_TYPE,
                    thid: proposalRequest.thid ?? guid,
                    body: {
                        proposals: []
                    },
                    from: proposalRequest.to,
                    to: proposalRequest.from
                };
            }
            proposalMessage.body?.proposals.push(proposal);
        }
        return proposalMessage ?? credOfferMessage;
    }
    /**
     * @inheritdoc ICredentialProposalHandler#handleProposalRequest
     */
    async handleProposalRequest(request, 
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts) {
        if (this._params.packerParams.mediaType === MediaType.SignedMessage &&
            !this._params.packerParams.packerOptions) {
            throw new Error(`jws packer options are required for ${MediaType.SignedMessage}`);
        }
        const proposalRequest = await this.parseProposalRequest(request);
        if (!proposalRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(proposalRequest);
        }
        const senderDID = DID.parse(proposalRequest.from);
        const message = await this.handleProposalRequestMessage(proposalRequest);
        const response = byteEncoder.encode(JSON.stringify(message));
        const packerOpts = this._params.packerParams.mediaType === MediaType.SignedMessage
            ? this._params.packerParams.packerOptions
            : {
                provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
            };
        return this._packerMgr.pack(this._params.packerParams.mediaType, response, {
            senderDID,
            ...packerOpts
        });
    }
    /**
     * @inheritdoc ICredentialProposalHandler#handleProposal
     */
    async handleProposal(proposal, opts) {
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(proposal);
        }
        if (opts?.proposalRequest && opts.proposalRequest.from !== proposal.to) {
            throw new Error(`sender of the request is not a target of response - expected ${opts.proposalRequest.from}, given ${proposal.to}`);
        }
        return { proposal };
    }
}
