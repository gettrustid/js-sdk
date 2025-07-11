import { Claim } from 'js-iden3-core-custom';
import { BaseConfig } from './common';
import { Query } from './models';
/**
 * LinkedMultiQuery circuit representation
 * Inputs and public signals declaration, marshalling and parsing
 *
 * @beta
 * @class LinkedMultiQueryInputs
 */
export declare class LinkedMultiQueryInputs extends BaseConfig {
    static queryCount: number;
    linkNonce: bigint;
    claim: Claim;
    query: Query[];
    inputsMarshal(): Uint8Array;
}
/**
 * public signals
 *
 * @beta
 * @class LinkedMultiQueryPubSignals
 */
export declare class LinkedMultiQueryPubSignals {
    linkID: bigint;
    merklized: number;
    operatorOutput: bigint[];
    circuitQueryHash: bigint[];
    /**
     * PubSignalsUnmarshal unmarshal linkedMultiQuery10.circom public inputs to LinkedMultiQueryPubSignals
     *
     * @beta
     * @param {Uint8Array} data
     * @returns LinkedMultiQueryPubSignals
     */
    pubSignalsUnmarshal(data: Uint8Array): LinkedMultiQueryPubSignals;
}
