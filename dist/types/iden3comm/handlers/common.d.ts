import { AcceptProfile, AuthProof, BasicMessage, JWSPackerParams, ZeroKnowledgeProofRequest, ZeroKnowledgeProofResponse } from '../types';
import { DID } from 'js-iden3-core-custom';
import { IProofService } from '../../proof';
import { CircuitId } from '../../circuits';
import { MediaType } from '../constants';
import { Signer } from 'ethers';
/**
 * Processes zero knowledge proof requests.
 *
 * @param to - The identifier of the recipient.
 * @param requests - An array of zero knowledge proof requests.
 * @param from - The identifier of the sender.
 * @param proofService - The proof service.
 * @param opts - Additional options for processing the requests.
 * @returns A promise that resolves to an array of zero knowledge proof responses.
 */
export declare const processZeroKnowledgeProofRequests: (to: DID, requests: ZeroKnowledgeProofRequest[] | undefined, from: DID | undefined, proofService: IProofService, opts: {
    mediaType?: MediaType;
    packerOptions?: JWSPackerParams;
    supportedCircuits: CircuitId[];
    ethSigner?: Signer;
    challenge?: bigint;
}) => Promise<ZeroKnowledgeProofResponse[]>;
/**
 * Processes auth proof requests.
 *
 * @param to - The identifier of the recipient.
 * @param proofService - The proof service.
 * @param opts - Additional options for processing the requests.
 * @returns A promise that resolves to an auth proof response.
 */
export declare const processProofAuth: (to: DID, proofService: IProofService, opts: {
    supportedCircuits: CircuitId[];
    acceptProfile?: AcceptProfile;
    senderAddress: string;
    zkpResponses: ZeroKnowledgeProofResponse[];
}) => Promise<{
    authProof: AuthProof;
}>;
/**
 * Processes a ZeroKnowledgeProofResponse object and prepares it for further use.
 * @param zkProof - The ZeroKnowledgeProofResponse object containing the proof data.
 * @returns An object containing the requestId, zkProofEncoded, and metadata.
 */
export declare const processProofResponse: (zkProof: ZeroKnowledgeProofResponse) => {
    requestId: string | number;
    zkProofEncoded: string;
    metadata: string;
};
/**
 * Calculates the challenge authentication V2 value.
 * @param senderAddress - The address of the sender.
 * @param zkpResponses - An array of ZeroKnowledgeProofResponse objects.
 * @returns A bigint representing the challenge authentication value.
 */
export declare const calcChallengeAuthV2: (senderAddress: string, zkpResponses: ZeroKnowledgeProofResponse[]) => bigint;
/**
 * Packs metadata into a string format suitable for encoding in a transaction.
 * @param metas - An array of objects containing key-value pairs to be packed.
 * @returns A string representing the packed metadata.
 */
export declare const packMetadatas: (metas: {
    key: string;
    value: Uint8Array;
}[]) => string;
/**
 * Verifies that the expires_time field of a message is not in the past. Throws an error if it is.
 *
 * @param message - Basic message to verify.
 */
export declare const verifyExpiresTime: (message: BasicMessage) => void;
