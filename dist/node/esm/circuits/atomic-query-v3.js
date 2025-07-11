import { Claim, Id, SchemaHash } from 'js-iden3-core-custom';
import { BaseConfig, bigIntArrayToStringArray, prepareSiblingsStr, getNodeAuxValue, prepareCircuitArrayValues } from './common';
import { CircuitError, ValueProof } from './models';
import { Hash, Proof, ZERO_HASH } from '@iden3/js-merkletree';
import { byteDecoder, byteEncoder } from '../utils';
import { ProofType } from '../verifiable';
const zero = '0';
/**
 * AtomicQueryV3Inputs ZK private inputs for credentialAtomicQueryV3.circom
 *
 * @beta
 * @class AtomicQueryV3Inputs
 * @extends {BaseConfig}
 */
export class AtomicQueryV3Inputs extends BaseConfig {
    validate() {
        if (!this.requestID) {
            throw new Error(CircuitError.EmptyRequestID);
        }
        if (!this.claim.nonRevProof.proof) {
            throw new Error(CircuitError.EmptyClaimNonRevProof);
        }
        if (!this.query.values) {
            throw new Error(CircuitError.EmptyQueryValue);
        }
        this.query.validateValueArraySize(this.getValueArrSize());
        if (!this.proofType) {
            throw new Error(CircuitError.InvalidProofType);
        }
        if (this.proofType === ProofType.BJJSignature) {
            if (!this.claim.signatureProof?.issuerAuthIncProof.proof) {
                throw new Error(CircuitError.EmptyIssuerAuthClaimProof);
            }
            if (!this.claim.signatureProof.issuerAuthNonRevProof.proof) {
                throw new Error(CircuitError.EmptyIssuerAuthClaimNonRevProof);
            }
            if (!this.claim.signatureProof.signature) {
                throw new Error(CircuitError.EmptyClaimSignature);
            }
        }
        if (this.proofType === ProofType.Iden3SparseMerkleTreeProof) {
            if (!this.claim?.incProof?.proof) {
                throw new Error(CircuitError.EmptyClaimProof);
            }
        }
    }
    fillMTPProofsWithZero(s) {
        s.issuerClaimMtp = prepareSiblingsStr(new Proof(), this.getMTLevel());
        s.issuerClaimClaimsTreeRoot = ZERO_HASH.bigInt().toString();
        s.issuerClaimRevTreeRoot = ZERO_HASH.bigInt().toString();
        s.issuerClaimRootsTreeRoot = ZERO_HASH.bigInt().toString();
        s.issuerClaimIdenState = ZERO_HASH.bigInt().toString();
    }
    fillSigProofWithZero(s) {
        s.issuerClaimSignatureR8x = zero;
        s.issuerClaimSignatureR8y = zero;
        s.issuerClaimSignatureS = zero;
        s.issuerAuthClaim = new Claim().marshalJson();
        s.issuerAuthClaimMtp = prepareSiblingsStr(new Proof(), this.getMTLevel());
        s.issuerAuthClaimsTreeRoot = zero;
        s.issuerAuthRevTreeRoot = zero;
        s.issuerAuthRootsTreeRoot = zero;
        s.issuerAuthClaimNonRevMtp = prepareSiblingsStr(new Proof(), this.getMTLevel());
        s.issuerAuthClaimNonRevMtpAuxHi = ZERO_HASH.bigInt().toString();
        s.issuerAuthClaimNonRevMtpAuxHv = ZERO_HASH.bigInt().toString();
        s.issuerAuthClaimNonRevMtpNoAux = zero;
        s.issuerAuthState = zero;
    }
    // InputsMarshal returns Circom private inputs for credentialAtomicQueryV3.circom
    inputsMarshal() {
        this.validate();
        if (this.query.valueProof) {
            this.query.validate();
            this.query.valueProof.validate();
        }
        let valueProof = this.query.valueProof;
        if (!valueProof) {
            valueProof = new ValueProof();
            valueProof.path = 0n;
            valueProof.value = 0n;
            valueProof.mtp = new Proof();
        }
        let treeState = this.claim.nonRevProof.treeState;
        if (this.proofType === ProofType.BJJSignature && this.skipClaimRevocationCheck) {
            treeState = this.claim.signatureProof?.issuerAuthNonRevProof.treeState;
        }
        if (!treeState) {
            throw new Error(CircuitError.EmptyTreeState);
        }
        const s = {
            requestID: this.requestID.toString(),
            userGenesisID: this.id.bigInt().toString(),
            profileNonce: this.profileNonce.toString(),
            claimSubjectProfileNonce: this.claimSubjectProfileNonce.toString(),
            issuerID: this.claim.issuerID.bigInt().toString(),
            issuerClaim: this.claim.claim.marshalJson(),
            issuerClaimNonRevClaimsTreeRoot: treeState.claimsRoot.bigInt().toString(),
            issuerClaimNonRevRevTreeRoot: treeState.revocationRoot.bigInt().toString(),
            issuerClaimNonRevRootsTreeRoot: treeState.rootOfRoots.bigInt().toString(),
            issuerClaimNonRevState: treeState.state.bigInt().toString(),
            issuerClaimNonRevMtp: prepareSiblingsStr(this.claim.nonRevProof.proof, this.getMTLevel()),
            claimSchema: this.claim.claim.getSchemaHash().bigInt().toString(),
            claimPathMtp: prepareSiblingsStr(valueProof.mtp, this.getMTLevelsClaim()),
            claimPathValue: valueProof.value.toString(),
            operator: this.query.operator,
            timestamp: this.currentTimeStamp,
            // value in this path in merklized json-ld document
            slotIndex: this.query.slotIndex,
            isRevocationChecked: 1
        };
        if (this.skipClaimRevocationCheck) {
            s.isRevocationChecked = 0;
        }
        if (this.proofType === ProofType.BJJSignature) {
            const sigProof = this.claim.signatureProof;
            s.proofType = '1';
            s.issuerClaimSignatureR8x = sigProof.signature.R8[0].toString();
            s.issuerClaimSignatureR8y = sigProof.signature.R8[1].toString();
            s.issuerClaimSignatureS = sigProof.signature.S.toString();
            s.issuerAuthClaim = sigProof.issuerAuthClaim?.marshalJson();
            s.issuerAuthClaimMtp = prepareSiblingsStr(sigProof.issuerAuthIncProof.proof, this.getMTLevel());
            s.issuerAuthClaimsTreeRoot = sigProof.issuerAuthIncProof.treeState?.claimsRoot
                .bigInt()
                .toString();
            s.issuerAuthRevTreeRoot = sigProof.issuerAuthIncProof.treeState?.revocationRoot
                .bigInt()
                .toString();
            s.issuerAuthRootsTreeRoot = sigProof.issuerAuthIncProof.treeState?.rootOfRoots
                .bigInt()
                .toString();
            s.issuerAuthClaimNonRevMtp = prepareSiblingsStr(sigProof.issuerAuthNonRevProof.proof, this.getMTLevel());
            const nodeAuxIssuerAuthNonRev = getNodeAuxValue(sigProof.issuerAuthNonRevProof.proof);
            s.issuerAuthClaimNonRevMtpAuxHi = nodeAuxIssuerAuthNonRev.key.bigInt().toString();
            s.issuerAuthClaimNonRevMtpAuxHv = nodeAuxIssuerAuthNonRev.value.bigInt().toString();
            s.issuerAuthClaimNonRevMtpNoAux = nodeAuxIssuerAuthNonRev.noAux;
            s.issuerAuthState = sigProof.issuerAuthIncProof.treeState?.state.bigInt().toString();
            this.fillMTPProofsWithZero(s);
        }
        else if (this.proofType === ProofType.Iden3SparseMerkleTreeProof) {
            s.proofType = '2';
            const incProofTreeState = this.claim.incProof?.treeState;
            if (!incProofTreeState) {
                throw new Error(CircuitError.EmptyTreeState);
            }
            s.issuerClaimMtp = prepareSiblingsStr(this.claim.incProof?.proof, this.getMTLevel());
            s.issuerClaimClaimsTreeRoot = incProofTreeState.claimsRoot.bigInt().toString();
            s.issuerClaimRevTreeRoot = incProofTreeState.revocationRoot.bigInt().toString();
            s.issuerClaimRootsTreeRoot = incProofTreeState.rootOfRoots.bigInt().toString();
            s.issuerClaimIdenState = incProofTreeState.state.bigInt().toString();
            this.fillSigProofWithZero(s);
        }
        const nodeAuxNonRev = getNodeAuxValue(this.claim.nonRevProof.proof);
        s.issuerClaimNonRevMtpAuxHi = nodeAuxNonRev.key.bigInt().toString();
        s.issuerClaimNonRevMtpAuxHv = nodeAuxNonRev.value.bigInt().toString();
        s.issuerClaimNonRevMtpNoAux = nodeAuxNonRev.noAux;
        const nodAuxJSONLD = getNodeAuxValue(valueProof.mtp);
        s.claimPathMtpNoAux = nodAuxJSONLD.noAux;
        s.claimPathMtpAuxHi = nodAuxJSONLD.key.bigInt().toString();
        s.claimPathMtpAuxHv = nodAuxJSONLD.value.bigInt().toString();
        s.claimPathKey = valueProof.path.toString();
        s.valueArraySize = this.query.values.length;
        const values = prepareCircuitArrayValues(this.query.values, this.getValueArrSize());
        s.value = bigIntArrayToStringArray(values);
        s.linkNonce = this.linkNonce.toString();
        s.verifierID = this.verifierID?.bigInt().toString() ?? '0';
        s.nullifierSessionID = this.nullifierSessionID.toString();
        return byteEncoder.encode(JSON.stringify(s));
    }
}
/**
 * @beta
 * AtomicQueryV3PubSignals public inputs
 */
export class AtomicQueryV3PubSignals extends BaseConfig {
    constructor() {
        super(...arguments);
        this.value = [];
    }
    // PubSignalsUnmarshal unmarshal credentialAtomicQueryV3.circom public signals
    pubSignalsUnmarshal(data) {
        // expected order:
        // merklized
        // userID
        // issuerState
        // linkID
        // nullifier
        // operatorOutput
        // proofType
        // requestID
        // issuerID
        // isRevocationChecked
        // issuerClaimNonRevState
        // timestamp
        // claimSchema
        // claimPathKey
        // slotIndex
        // operator
        // value
        // valueArraySize
        // verifierID
        // nullifierSessionID
        // 19 is a number of fields in AtomicQueryV3PubSignals before values, values is last element in the proof and
        // it is length could be different base on the circuit configuration. The length could be modified by set value
        // in ValueArraySize
        const fieldLength = 19;
        const sVals = JSON.parse(byteDecoder.decode(data));
        if (sVals.length !== fieldLength + this.getValueArrSize()) {
            throw new Error(`invalid number of Output values expected ${fieldLength + this.getValueArrSize()} got ${sVals.length}`);
        }
        let fieldIdx = 0;
        // -- merklized
        this.merklized = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        //  - userID
        this.userID = Id.fromBigInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - issuerState
        this.issuerState = Hash.fromString(sVals[fieldIdx]);
        fieldIdx++;
        // - linkID
        this.linkID = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - nullifier
        this.nullifier = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - operatorOutput
        this.operatorOutput = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - proofType
        this.proofType = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        // - requestID
        this.requestID = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - issuerID
        this.issuerID = Id.fromBigInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - isRevocationChecked
        this.isRevocationChecked = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        // - issuerClaimNonRevState
        this.issuerClaimNonRevState = Hash.fromString(sVals[fieldIdx]);
        fieldIdx++;
        //  - timestamp
        this.timestamp = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        //  - claimSchema
        this.claimSchema = SchemaHash.newSchemaHashFromInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - ClaimPathKey
        this.claimPathKey = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - slotIndex
        this.slotIndex = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        // - operator
        this.operator = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        //  - values
        for (let index = 0; index < this.getValueArrSize(); index++) {
            this.value.push(BigInt(sVals[fieldIdx]));
            fieldIdx++;
        }
        // - valueArraySize
        this.valueArraySize = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        // - verifierID
        if (sVals[fieldIdx] !== '0') {
            this.verifierID = Id.fromBigInt(BigInt(sVals[fieldIdx]));
        }
        fieldIdx++;
        // - nullifierSessionID
        this.nullifierSessionID = BigInt(sVals[fieldIdx]);
        return this;
    }
}
