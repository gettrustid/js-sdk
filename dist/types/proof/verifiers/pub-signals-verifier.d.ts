import { Id } from 'js-iden3-core-custom';
import { DocumentLoader } from '@iden3/js-jsonld-merklization';
import { IStateStorage } from '../../storage';
import { ProofQuery } from '../../verifiable';
import { BaseConfig } from '../../circuits/common';
import { VerifyOpts } from './query';
import { JSONObject, VerifiablePresentation } from '../../iden3comm';
/**
 *  Verify Context - params for pub signal verification
 * @type VerifyContext
 */
export type VerifyContext = {
    pubSignals: string[];
    query: ProofQuery;
    verifiablePresentation?: VerifiablePresentation;
    sender: string;
    challenge: bigint;
    opts?: VerifyOpts;
    params?: JSONObject;
};
export declare const userStateError: Error;
/**
 * PubSignalsVerifier provides verify method
 * @public
 * @class PubSignalsVerifier
 */
export declare class PubSignalsVerifier {
    private readonly _documentLoader;
    private readonly _stateStorage;
    userId: Id;
    challenge: bigint;
    /**
     * Creates an instance of PubSignalsVerifier.
     * @param {DocumentLoader} _documentLoader document loader
     * @param {IStateStorage} _stateStorage state storage
     */
    constructor(_documentLoader: DocumentLoader, _stateStorage: IStateStorage);
    /**
     * verify public signals
     *
     * @param {string} circuitId circuit id
     * @param {VerifyContext} ctx verification parameters
     * @returns `Promise<BaseConfig>`
     */
    verify(circuitId: string, ctx: VerifyContext): Promise<BaseConfig>;
    private credentialAtomicQueryMTPV2Verify;
    private credentialAtomicQuerySigV2Verify;
    private credentialAtomicQueryV3Verify;
    private authV2Verify;
    private linkedMultiQuery10Verify;
    private verifyIdOwnership;
    private checkQueryV2Circuits;
    private resolve;
    private rootResolve;
    private checkStateExistenceForId;
    private checkGlobalState;
    private checkRevocationStateForId;
    private checkRevocationState;
}
