import { BasicMessage, DIDDocument, IPackageManager, PackerParams } from '../types';
import { DID } from 'js-iden3-core-custom';
import { Proposal, ProposalRequestCredential, ProposalRequestMessage, ProposalMessage } from '../types/protocol/proposal-request';
import { IIdentityWallet } from '../../identity';
import { AbstractMessageHandler, BasicHandlerOptions, IProtocolMessageHandler } from './message-handler';
/** @beta ProposalRequestCreationOptions represents proposal-request creation options */
export type ProposalRequestCreationOptions = {
    credentials: ProposalRequestCredential[];
    did_doc?: DIDDocument;
    expires_time?: Date;
};
/** @beta ProposalCreationOptions represents proposal creation options */
export type ProposalCreationOptions = {
    expires_time?: Date;
};
/**
 * @beta
 * createProposalRequest is a function to create protocol proposal-request protocol message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {ProposalRequestCreationOptions} opts - creation options
 * @returns `Promise<ProposalRequestMessage>`
 */
export declare function createProposalRequest(sender: DID, receiver: DID, opts: ProposalRequestCreationOptions): ProposalRequestMessage;
/**
 * @beta
 * createProposal is a function to create protocol proposal protocol message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {Proposal[]} proposals - proposals
 * @returns `Promise<ProposalRequestMessage>`
 */
export declare function createProposal(sender: DID, receiver: DID, proposals?: Proposal[], opts?: ProposalCreationOptions): ProposalMessage;
/**
 * @beta
 * Interface that allows the processing of the proposal-request
 *
 * @interface ICredentialProposalHandler
 */
export interface ICredentialProposalHandler {
    /**
     * @beta
     * unpacks proposal-request
     * @param {Uint8Array} request - raw byte message
     * @returns `Promise<ProposalRequestMessage>`
     */
    parseProposalRequest(request: Uint8Array): Promise<ProposalRequestMessage>;
    /**
     *  @beta
     * handle proposal-request
     * @param {Uint8Array} request - raw byte message
     * @param {ProposalRequestHandlerOptions} opts - handler options
     * @returns {Promise<Uint8Array>}` - proposal response message
     */
    handleProposalRequest(request: Uint8Array, opts?: ProposalRequestHandlerOptions): Promise<Uint8Array>;
    /**
       * @beta
       * handle proposal protocol message
       * @param {ProposalMessage} proposal  - proposal message
       * @param {ProposalHandlerOptions} opts - options
       * @returns `Promise<{
        proposal: ProposalMessage;
      }>`
       */
    handleProposal(proposal: ProposalMessage, opts?: ProposalHandlerOptions): Promise<{
        proposal: ProposalMessage;
    }>;
}
/** @beta ProposalRequestHandlerOptions represents proposal-request handler options */
export type ProposalRequestHandlerOptions = BasicHandlerOptions;
/** @beta ProposalHandlerOptions represents proposal handler options */
export type ProposalHandlerOptions = BasicHandlerOptions & {
    proposalRequest?: ProposalRequestMessage;
};
/** @beta CredentialProposalHandlerParams represents credential proposal handler params */
export type CredentialProposalHandlerParams = {
    agentUrl: string;
    proposalResolverFn: (context: string, type: string) => Promise<Proposal>;
    packerParams: PackerParams;
};
/**
 *
 * Allows to process ProposalRequest protocol message
 * @beta
 * @class CredentialProposalHandler
 * @implements implements ICredentialProposalHandler interface
 */
export declare class CredentialProposalHandler extends AbstractMessageHandler implements ICredentialProposalHandler, IProtocolMessageHandler {
    private readonly _packerMgr;
    private readonly _identityWallet;
    private readonly _params;
    /**
     * @beta Creates an instance of CredentialProposalHandler.
     * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
     * @param {IIdentityWallet} _identityWallet - identity wallet
     * @param {CredentialProposalHandlerParams} _params - credential proposal handler params
     *
     */
    constructor(_packerMgr: IPackageManager, _identityWallet: IIdentityWallet, _params: CredentialProposalHandlerParams);
    handle(message: BasicMessage, context: ProposalRequestHandlerOptions): Promise<BasicMessage | null>;
    /**
     * @inheritdoc ICredentialProposalHandler#parseProposalRequest
     */
    parseProposalRequest(request: Uint8Array): Promise<ProposalRequestMessage>;
    private handleProposalRequestMessage;
    /**
     * @inheritdoc ICredentialProposalHandler#handleProposalRequest
     */
    handleProposalRequest(request: Uint8Array, opts?: ProposalRequestHandlerOptions): Promise<Uint8Array>;
    /**
     * @inheritdoc ICredentialProposalHandler#handleProposal
     */
    handleProposal(proposal: ProposalMessage, opts?: ProposalHandlerOptions): Promise<{
        proposal: ProposalMessage;
    }>;
}
