import { Claim, Id } from 'js-iden3-core-custom';
import { BaseConfig, bigIntArrayToStringArray, prepareSiblingsStr, getNodeAuxValue, prepareCircuitArrayValues } from './common';
import { CircuitError, ValueProof } from './models';
import { Hash, Proof, ZERO_HASH } from '@iden3/js-merkletree';
import { byteDecoder, byteEncoder } from '../utils';
import { ProofType } from '../verifiable';
const zero = '0';
/**
 * AtomicQueryV3OnChainInputs ZK private inputs for credentialAtomicQueryV3OnChain.circom
 *
 * @beta
 * @class AtomicQueryV3OnChainInputs
 * @extends {BaseConfig}
 */
export class AtomicQueryV3OnChainInputs extends BaseConfig {
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
        if (!this.challenge) {
            throw new Error(CircuitError.EmptyChallenge);
        }
        if (this.isBJJAuthEnabled === 1) {
            if (!this.authClaimIncMtp) {
                throw new Error(CircuitError.EmptyAuthClaimProof);
            }
            if (!this.authClaimNonRevMtp) {
                throw new Error(CircuitError.EmptyAuthClaimNonRevProof);
            }
            if (!this.signature) {
                throw new Error(CircuitError.EmptyChallengeSignature);
            }
            if (!this.gistProof.proof) {
                throw new Error(CircuitError.EmptyGISTProof);
            }
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
    fillAuthWithZero(s) {
        s.authClaim = new Claim().marshalJson();
        s.userClaimsTreeRoot = ZERO_HASH.bigInt().toString();
        s.userRevTreeRoot = ZERO_HASH.bigInt().toString();
        s.userRootsTreeRoot = ZERO_HASH.bigInt().toString();
        s.userState = ZERO_HASH.bigInt().toString();
        s.authClaimIncMtp = prepareSiblingsStr(new Proof(), this.getMTLevel());
        s.authClaimNonRevMtp = prepareSiblingsStr(new Proof(), this.getMTLevel());
        s.challengeSignatureR8x = zero;
        s.challengeSignatureR8y = zero;
        s.challengeSignatureS = zero;
        s.gistRoot = ZERO_HASH.bigInt().toString();
        s.gistMtp = prepareSiblingsStr(new Proof(), this.getMTLevelOnChain());
        s.authClaimNonRevMtpAuxHi = ZERO_HASH.bigInt().toString();
        s.authClaimNonRevMtpAuxHv = ZERO_HASH.bigInt().toString();
        s.authClaimNonRevMtpNoAux = zero;
        s.gistMtpAuxHi = ZERO_HASH.bigInt().toString();
        s.gistMtpAuxHv = ZERO_HASH.bigInt().toString();
        s.gistMtpNoAux = zero;
    }
    // InputsMarshal returns Circom private inputs for credentialAtomicQueryV3OnChain.circom
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
        s.challenge = this.challenge?.toString();
        if (this.isBJJAuthEnabled === 1) {
            s.authClaim = this.authClaim?.marshalJson();
            s.userClaimsTreeRoot = this.treeState.claimsRoot?.bigInt().toString();
            s.userRevTreeRoot = this.treeState.revocationRoot?.bigInt().toString();
            s.userRootsTreeRoot = this.treeState.rootOfRoots?.bigInt().toString();
            s.userState = this.treeState.state?.bigInt().toString();
            s.authClaimIncMtp = prepareSiblingsStr(this.authClaimIncMtp, this.getMTLevel());
            s.authClaimNonRevMtp = prepareSiblingsStr(this.authClaimNonRevMtp, this.getMTLevel());
            s.challengeSignatureR8x = this.signature.R8[0].toString();
            s.challengeSignatureR8y = this.signature.R8[1].toString();
            s.challengeSignatureS = this.signature.S.toString();
            s.gistMtp =
                this.gistProof && prepareSiblingsStr(this.gistProof.proof, this.getMTLevelOnChain());
            const nodeAuxAuth = getNodeAuxValue(this.authClaimNonRevMtp);
            s.authClaimNonRevMtpAuxHi = nodeAuxAuth.key.bigInt().toString();
            s.authClaimNonRevMtpAuxHv = nodeAuxAuth.value.bigInt().toString();
            s.authClaimNonRevMtpNoAux = nodeAuxAuth.noAux;
            const globalNodeAux = getNodeAuxValue(this.gistProof.proof);
            s.gistMtpAuxHi = globalNodeAux.key.bigInt().toString();
            s.gistMtpAuxHv = globalNodeAux.value.bigInt().toString();
            s.gistMtpNoAux = globalNodeAux.noAux;
            s.gistRoot = this.gistProof.root.bigInt().toString();
        }
        else {
            this.fillAuthWithZero(s);
        }
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
            const issuerAuthTreeState = this.claim.nonRevProof.treeState;
            if (!issuerAuthTreeState) {
                throw new Error(CircuitError.EmptyTreeState);
            }
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
        s.isBJJAuthEnabled = this.isBJJAuthEnabled.toString();
        return byteEncoder.encode(JSON.stringify(s));
    }
}
/**
 * @beta
 * AtomicQueryV3OnChainPubSignals public inputs
 */
export class AtomicQueryV3OnChainPubSignals extends BaseConfig {
    // PubSignalsUnmarshal unmarshal credentialAtomicQueryV3.circom public signals
    pubSignalsUnmarshal(data) {
        // expected order:
        // userID
        // circuitQueryHash
        // issuerState
        // linkID
        // nullifier
        // operatorOutput
        // proofType
        // requestID
        // challenge
        // gistRoot
        // issuerID
        // issuerClaimNonRevState
        // timestamp
        // isBJJAuthEnabled
        const sVals = JSON.parse(byteDecoder.decode(data));
        let fieldIdx = 0;
        //  - userID
        this.userID = Id.fromBigInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - circuitQueryHash
        this.circuitQueryHash = BigInt(sVals[fieldIdx]);
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
        // - challenge
        this.challenge = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - gistRoot
        this.gistRoot = Hash.fromString(sVals[fieldIdx]);
        fieldIdx++;
        // - issuerID
        this.issuerID = Id.fromBigInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - issuerClaimNonRevState
        this.issuerClaimNonRevState = Hash.fromString(sVals[fieldIdx]);
        fieldIdx++;
        //  - timestamp
        this.timestamp = parseInt(sVals[fieldIdx]);
        fieldIdx++;
        // - isBJJAuthEnabled
        this.isBJJAuthEnabled = parseInt(sVals[fieldIdx]);
        return this;
    }
    /** {@inheritDoc IStateInfoPubSignals.getStatesInfo} */
    getStatesInfo() {
        return {
            states: [
                { id: this.issuerID, state: this.issuerState },
                { id: this.issuerID, state: this.issuerClaimNonRevState }
            ],
            gists: [{ id: this.userID, root: this.gistRoot }]
        };
    }
}
