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
exports.CredentialProposalHandler = exports.createProposal = exports.createProposalRequest = void 0;
const constants_1 = require("../constants");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const uuid = __importStar(require("uuid"));
const js_jwz_1 = require("@iden3/js-jwz");
const utils_1 = require("../../utils");
const message_handler_1 = require("./message-handler");
const common_1 = require("./common");
/**
 * @beta
 * createProposalRequest is a function to create protocol proposal-request protocol message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {ProposalRequestCreationOptions} opts - creation options
 * @returns `Promise<ProposalRequestMessage>`
 */
function createProposalRequest(sender, receiver, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: constants_1.MediaType.PlainMessage,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.PROPOSAL_REQUEST_MESSAGE_TYPE,
        body: opts,
        created_time: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date()),
        expires_time: opts?.expires_time ? (0, js_iden3_core_custom_1.getUnixTimestamp)(opts.expires_time) : undefined
    };
    return request;
}
exports.createProposalRequest = createProposalRequest;
/**
 * @beta
 * createProposal is a function to create protocol proposal protocol message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {Proposal[]} proposals - proposals
 * @returns `Promise<ProposalRequestMessage>`
 */
function createProposal(sender, receiver, proposals, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: constants_1.MediaType.PlainMessage,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.PROPOSAL_MESSAGE_TYPE,
        body: {
            proposals: proposals || []
        },
        created_time: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date()),
        expires_time: opts?.expires_time ? (0, js_iden3_core_custom_1.getUnixTimestamp)(opts.expires_time) : undefined
    };
    return request;
}
exports.createProposal = createProposal;
/**
 *
 * Allows to process ProposalRequest protocol message
 * @beta
 * @class CredentialProposalHandler
 * @implements implements ICredentialProposalHandler interface
 */
class CredentialProposalHandler extends message_handler_1.AbstractMessageHandler {
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
            case constants_1.PROTOCOL_MESSAGE_TYPE.PROPOSAL_REQUEST_MESSAGE_TYPE:
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
        if (message.type !== constants_1.PROTOCOL_MESSAGE_TYPE.PROPOSAL_REQUEST_MESSAGE_TYPE) {
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
                        type: constants_1.PROTOCOL_MESSAGE_TYPE.CREDENTIAL_OFFER_MESSAGE_TYPE,
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
                    type: constants_1.PROTOCOL_MESSAGE_TYPE.PROPOSAL_MESSAGE_TYPE,
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
        if (this._params.packerParams.mediaType === constants_1.MediaType.SignedMessage &&
            !this._params.packerParams.packerOptions) {
            throw new Error(`jws packer options are required for ${constants_1.MediaType.SignedMessage}`);
        }
        const proposalRequest = await this.parseProposalRequest(request);
        if (!proposalRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!opts?.allowExpiredMessages) {
            (0, common_1.verifyExpiresTime)(proposalRequest);
        }
        const senderDID = js_iden3_core_custom_1.DID.parse(proposalRequest.from);
        const message = await this.handleProposalRequestMessage(proposalRequest);
        const response = utils_1.byteEncoder.encode(JSON.stringify(message));
        const packerOpts = this._params.packerParams.mediaType === constants_1.MediaType.SignedMessage
            ? this._params.packerParams.packerOptions
            : {
                provingMethodAlg: js_jwz_1.proving.provingMethodGroth16AuthV2Instance.methodAlg
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
            (0, common_1.verifyExpiresTime)(proposal);
        }
        if (opts?.proposalRequest && opts.proposalRequest.from !== proposal.to) {
            throw new Error(`sender of the request is not a target of response - expected ${opts.proposalRequest.from}, given ${proposal.to}`);
        }
        return { proposal };
    }
}
exports.CredentialProposalHandler = CredentialProposalHandler;
