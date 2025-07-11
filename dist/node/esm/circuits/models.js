import { Proof } from '@iden3/js-merkletree';
import { Operators, QueryOperators } from './comparer';
/**
 * Query represents basic request to claim slot verification
 *
 * @public
 * @class Query
 */
export class Query {
    /**
     * Validates Query instance
     *
     */
    validate() {
        if (this.operator !== QueryOperators.$noop &&
            this.operator !== QueryOperators.$sd &&
            this.values?.some((v) => typeof v !== 'bigint'))
            throw new Error(CircuitError.EmptyQueryValue);
    }
    validateValueArraySize(maxArrSize) {
        if ([Operators.NOOP, Operators.SD, Operators.NULLIFY].includes(this.operator) &&
            this.values.length !== 0) {
            throw new Error(CircuitError.InvalidValuesArrSize);
        }
        else if ([
            Operators.EQ,
            Operators.LT,
            Operators.GT,
            Operators.NE,
            Operators.LTE,
            Operators.GTE,
            Operators.EXISTS
        ].includes(this.operator) &&
            this.values.length !== 1) {
            throw new Error(CircuitError.InvalidValuesArrSize);
        }
        else if ([Operators.BETWEEN, Operators.NONBETWEEN].includes(this.operator) &&
            this.values.length !== 2) {
            throw new Error(CircuitError.InvalidValuesArrSize);
        }
        else if ([Operators.IN, Operators.NIN].includes(this.operator) &&
            this.values.length > maxArrSize) {
            throw new Error(CircuitError.InvalidValuesArrSize);
        }
    }
}
/**
 * CircuitID is alias for circuit identifier
 *
 * @enum {number}
 */
export var CircuitId;
(function (CircuitId) {
    // Auth is a type that must be used for authV2.circom
    CircuitId["AuthV2"] = "authV2";
    // StateTransition is a type that must be used for stateTransition.circom
    CircuitId["StateTransition"] = "stateTransition";
    // AtomicQueryMTPV2 is a type for credentialAtomicQueryMTPV2.circom
    CircuitId["AtomicQueryMTPV2"] = "credentialAtomicQueryMTPV2";
    // AtomicQueryMTPV2OnChain is a type for credentialAtomicQueryMTPV2OnChain.circom
    CircuitId["AtomicQueryMTPV2OnChain"] = "credentialAtomicQueryMTPV2OnChain";
    // AtomicQuerySig is a type for credentialAttrQuerySig.circom
    CircuitId["AtomicQuerySigV2"] = "credentialAtomicQuerySigV2";
    // AtomicQuerySigOnChain is a type for credentialAtomicQuerySigOnChain.circom
    CircuitId["AtomicQuerySigV2OnChain"] = "credentialAtomicQuerySigV2OnChain";
    /**
     * @beta
     */
    // AtomicQueryV3CircuitID is a type for credentialAtomicQueryV3.circom
    CircuitId["AtomicQueryV3"] = "credentialAtomicQueryV3-beta.1";
    /**
     * @beta
     */
    // AtomicQueryV3OnChainCircuitID is a type for credentialAtomicQueryV3OnChain.circom
    CircuitId["AtomicQueryV3OnChain"] = "credentialAtomicQueryV3OnChain-beta.1";
    /**
     * @beta
     */
    // LinkedMultiQuery is a type for linkedMultiQuery.circom
    CircuitId["LinkedMultiQuery10"] = "linkedMultiQuery10-beta.1";
})(CircuitId || (CircuitId = {}));
/**
 * Claim structure for circuit inputs
 *
 * @public
 * @class CircuitClaim
 */
export class CircuitClaim {
}
/**
 * List of errors of circuit inputs processing
 *
 * @enum {number}
 */
export var CircuitError;
(function (CircuitError) {
    CircuitError["EmptyAuthClaimProof"] = "empty auth claim mtp proof";
    CircuitError["EmptyAuthClaimProofInTheNewState"] = "empty auth claim mtp proof in the new state";
    CircuitError["EmptyAuthClaimNonRevProof"] = "empty auth claim non-revocation mtp proof";
    CircuitError["EmptyChallengeSignature"] = "empty challenge signature";
    CircuitError["EmptyClaimSignature"] = "empty claim signature";
    CircuitError["EmptyClaimProof"] = "empty claim mtp proof";
    CircuitError["EmptyClaimNonRevProof"] = "empty claim non-revocation mtp proof";
    CircuitError["EmptyIssuerAuthClaimProof"] = "empty issuer auth claim mtp proof";
    CircuitError["EmptyIssuerAuthClaimNonRevProof"] = "empty issuer auth claim non-revocation mtp proof";
    CircuitError["EmptyJsonLDQueryProof"] = "empty JSON-LD query mtp proof";
    CircuitError["EmptyJsonLDQueryValue"] = "empty JSON-LD query value";
    CircuitError["EmptyJsonLDQueryPath"] = "empty JSON-LD query path";
    CircuitError["EmptyQueryValue"] = "empty query value";
    CircuitError["EmptyJsonLDQueryValues"] = "empty JSON-LD query values";
    CircuitError["EmptyId"] = "empty Id";
    CircuitError["EmptyChallenge"] = "empty challenge";
    CircuitError["EmptyGISTProof"] = "empty GIST merkle tree proof";
    CircuitError["EmptyTreeState"] = "empty tree state";
    CircuitError["EmptyRequestID"] = "empty request ID";
    CircuitError["InvalidProofType"] = "invalid proof type";
    CircuitError["InvalidValuesArrSize"] = "invalid query Values array size";
    CircuitError["InvalidOperationType"] = "invalid operation type";
})(CircuitError || (CircuitError = {}));
/**
 * ValueProof represents a Merkle Proof for a value stored as MT
 *
 * @public
 * @class ValueProof
 */
export class ValueProof {
    /**
     * Creates an instance of ValueProof.
     */
    constructor() {
        this.path = BigInt(0);
        this.value = BigInt(0);
        this.mtp = new Proof();
    }
    /**
     * validates instance of ValueProof
     *
     */
    validate() {
        if (typeof this.path !== 'bigint') {
            throw new Error(CircuitError.EmptyJsonLDQueryPath);
        }
        if (typeof this.value !== 'bigint') {
            throw new Error(CircuitError.EmptyJsonLDQueryValue);
        }
        if (!this.mtp) {
            throw new Error(CircuitError.EmptyJsonLDQueryProof);
        }
    }
}
