import { DID } from 'js-iden3-core-custom';
import { RevocationStatus, W3CCredential } from '../../verifiable';
import { ZeroKnowledgeProofRequest } from '../../iden3comm';
import { CircuitClaim, CircuitId, Operators, Query, TreeState } from '../../circuits';
import { PreparedAuthBJJCredential, PreparedCredential } from '../common';
import { IIdentityWallet } from '../../identity';
import { IStateStorage } from '../../storage';
import { ICredentialWallet } from '../../credentials';
export type DIDProfileMetadata = {
    authProfileNonce: number | string;
    credentialSubjectProfileNonce: number | string;
};
export type ProofGenerationOptions = {
    skipRevocation: boolean;
    challenge?: bigint;
    credential?: W3CCredential;
    credentialRevocationStatus?: RevocationStatus;
    verifierDid?: DID;
    linkNonce?: bigint;
};
export type AuthProofGenerationOptions = {
    challenge?: bigint;
};
export type ProofInputsParams = ProofGenerationOptions & DIDProfileMetadata;
type InputContext = {
    preparedCredential: PreparedCredential;
    identifier: DID;
    proofReq: ZeroKnowledgeProofRequest;
    params: ProofInputsParams;
    circuitQueries: Query[];
};
export declare const circuitValidator: {
    [k in CircuitId]: {
        maxQueriesCount: number;
        supportedOperations: Operators[];
    };
};
export declare class InputGenerator {
    private readonly _identityWallet;
    private readonly _credentialWallet;
    private readonly _stateStorage;
    constructor(_identityWallet: IIdentityWallet, _credentialWallet: ICredentialWallet, _stateStorage: IStateStorage);
    generateInputs(ctx: InputContext): Promise<Uint8Array>;
    newCircuitClaimData(preparedCredential: PreparedCredential): Promise<CircuitClaim>;
    prepareAuthBJJCredential(did: DID, treeStateInfo?: TreeState): Promise<PreparedAuthBJJCredential>;
    private credentialAtomicQueryMTPV2PrepareInputs;
    private credentialAtomicQueryMTPV2OnChainPrepareInputs;
    private credentialAtomicQuerySigV2PrepareInputs;
    private credentialAtomicQuerySigV2OnChainPrepareInputs;
    private credentialAtomicQueryV3PrepareInputs;
    private credentialAtomicQueryV3OnChainPrepareInputs;
    private linkedMultiQuery10PrepareInputs;
    private transformV2QueryOperator;
    private checkOperatorSupport;
}
export {};
