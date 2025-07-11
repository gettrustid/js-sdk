"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AtomicQueryV3OnChainPubSignals = exports.AtomicQueryV3OnChainInputs = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const common_1 = require("./common");
const models_1 = require("./models");
const js_merkletree_1 = require("@iden3/js-merkletree");
const utils_1 = require("../utils");
const verifiable_1 = require("../verifiable");
const zero = '0';
/**
 * AtomicQueryV3OnChainInputs ZK private inputs for credentialAtomicQueryV3OnChain.circom
 *
 * @beta
 * @class AtomicQueryV3OnChainInputs
 * @extends {BaseConfig}
 */
class AtomicQueryV3OnChainInputs extends common_1.BaseConfig {
    validate() {
        if (!this.requestID) {
            throw new Error(models_1.CircuitError.EmptyRequestID);
        }
        if (!this.claim.nonRevProof.proof) {
            throw new Error(models_1.CircuitError.EmptyClaimNonRevProof);
        }
        if (!this.query.values) {
            throw new Error(models_1.CircuitError.EmptyQueryValue);
        }
        this.query.validateValueArraySize(this.getValueArrSize());
        if (!this.proofType) {
            throw new Error(models_1.CircuitError.InvalidProofType);
        }
        if (!this.challenge) {
            throw new Error(models_1.CircuitError.EmptyChallenge);
        }
        if (this.isBJJAuthEnabled === 1) {
            if (!this.authClaimIncMtp) {
                throw new Error(models_1.CircuitError.EmptyAuthClaimProof);
            }
            if (!this.authClaimNonRevMtp) {
                throw new Error(models_1.CircuitError.EmptyAuthClaimNonRevProof);
            }
            if (!this.signature) {
                throw new Error(models_1.CircuitError.EmptyChallengeSignature);
            }
            if (!this.gistProof.proof) {
                throw new Error(models_1.CircuitError.EmptyGISTProof);
            }
        }
        if (this.proofType === verifiable_1.ProofType.BJJSignature) {
            if (!this.claim.signatureProof?.issuerAuthIncProof.proof) {
                throw new Error(models_1.CircuitError.EmptyIssuerAuthClaimProof);
            }
            if (!this.claim.signatureProof.issuerAuthNonRevProof.proof) {
                throw new Error(models_1.CircuitError.EmptyIssuerAuthClaimNonRevProof);
            }
            if (!this.claim.signatureProof.signature) {
                throw new Error(models_1.CircuitError.EmptyClaimSignature);
            }
        }
        if (this.proofType === verifiable_1.ProofType.Iden3SparseMerkleTreeProof) {
            if (!this.claim?.incProof?.proof) {
                throw new Error(models_1.CircuitError.EmptyClaimProof);
            }
        }
    }
    fillMTPProofsWithZero(s) {
        s.issuerClaimMtp = (0, common_1.prepareSiblingsStr)(new js_merkletree_1.Proof(), this.getMTLevel());
        s.issuerClaimClaimsTreeRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.issuerClaimRevTreeRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.issuerClaimRootsTreeRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.issuerClaimIdenState = js_merkletree_1.ZERO_HASH.bigInt().toString();
    }
    fillSigProofWithZero(s) {
        s.issuerClaimSignatureR8x = zero;
        s.issuerClaimSignatureR8y = zero;
        s.issuerClaimSignatureS = zero;
        s.issuerAuthClaim = new js_iden3_core_custom_1.Claim().marshalJson();
        s.issuerAuthClaimMtp = (0, common_1.prepareSiblingsStr)(new js_merkletree_1.Proof(), this.getMTLevel());
        s.issuerAuthClaimsTreeRoot = zero;
        s.issuerAuthRevTreeRoot = zero;
        s.issuerAuthRootsTreeRoot = zero;
        s.issuerAuthClaimNonRevMtp = (0, common_1.prepareSiblingsStr)(new js_merkletree_1.Proof(), this.getMTLevel());
        s.issuerAuthClaimNonRevMtpAuxHi = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.issuerAuthClaimNonRevMtpAuxHv = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.issuerAuthClaimNonRevMtpNoAux = zero;
        s.issuerAuthState = zero;
    }
    fillAuthWithZero(s) {
        s.authClaim = new js_iden3_core_custom_1.Claim().marshalJson();
        s.userClaimsTreeRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.userRevTreeRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.userRootsTreeRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.userState = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.authClaimIncMtp = (0, common_1.prepareSiblingsStr)(new js_merkletree_1.Proof(), this.getMTLevel());
        s.authClaimNonRevMtp = (0, common_1.prepareSiblingsStr)(new js_merkletree_1.Proof(), this.getMTLevel());
        s.challengeSignatureR8x = zero;
        s.challengeSignatureR8y = zero;
        s.challengeSignatureS = zero;
        s.gistRoot = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.gistMtp = (0, common_1.prepareSiblingsStr)(new js_merkletree_1.Proof(), this.getMTLevelOnChain());
        s.authClaimNonRevMtpAuxHi = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.authClaimNonRevMtpAuxHv = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.authClaimNonRevMtpNoAux = zero;
        s.gistMtpAuxHi = js_merkletree_1.ZERO_HASH.bigInt().toString();
        s.gistMtpAuxHv = js_merkletree_1.ZERO_HASH.bigInt().toString();
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
            valueProof = new models_1.ValueProof();
            valueProof.path = 0n;
            valueProof.value = 0n;
            valueProof.mtp = new js_merkletree_1.Proof();
        }
        let treeState = this.claim.nonRevProof.treeState;
        if (this.proofType === verifiable_1.ProofType.BJJSignature && this.skipClaimRevocationCheck) {
            treeState = this.claim.signatureProof?.issuerAuthNonRevProof.treeState;
        }
        if (!treeState) {
            throw new Error(models_1.CircuitError.EmptyTreeState);
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
            issuerClaimNonRevMtp: (0, common_1.prepareSiblingsStr)(this.claim.nonRevProof.proof, this.getMTLevel()),
            claimSchema: this.claim.claim.getSchemaHash().bigInt().toString(),
            claimPathMtp: (0, common_1.prepareSiblingsStr)(valueProof.mtp, this.getMTLevelsClaim()),
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
            s.authClaimIncMtp = (0, common_1.prepareSiblingsStr)(this.authClaimIncMtp, this.getMTLevel());
            s.authClaimNonRevMtp = (0, common_1.prepareSiblingsStr)(this.authClaimNonRevMtp, this.getMTLevel());
            s.challengeSignatureR8x = this.signature.R8[0].toString();
            s.challengeSignatureR8y = this.signature.R8[1].toString();
            s.challengeSignatureS = this.signature.S.toString();
            s.gistMtp =
                this.gistProof && (0, common_1.prepareSiblingsStr)(this.gistProof.proof, this.getMTLevelOnChain());
            const nodeAuxAuth = (0, common_1.getNodeAuxValue)(this.authClaimNonRevMtp);
            s.authClaimNonRevMtpAuxHi = nodeAuxAuth.key.bigInt().toString();
            s.authClaimNonRevMtpAuxHv = nodeAuxAuth.value.bigInt().toString();
            s.authClaimNonRevMtpNoAux = nodeAuxAuth.noAux;
            const globalNodeAux = (0, common_1.getNodeAuxValue)(this.gistProof.proof);
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
        if (this.proofType === verifiable_1.ProofType.BJJSignature) {
            const sigProof = this.claim.signatureProof;
            s.proofType = '1';
            s.issuerClaimSignatureR8x = sigProof.signature.R8[0].toString();
            s.issuerClaimSignatureR8y = sigProof.signature.R8[1].toString();
            s.issuerClaimSignatureS = sigProof.signature.S.toString();
            s.issuerAuthClaim = sigProof.issuerAuthClaim?.marshalJson();
            s.issuerAuthClaimMtp = (0, common_1.prepareSiblingsStr)(sigProof.issuerAuthIncProof.proof, this.getMTLevel());
            const issuerAuthTreeState = this.claim.nonRevProof.treeState;
            if (!issuerAuthTreeState) {
                throw new Error(models_1.CircuitError.EmptyTreeState);
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
            s.issuerAuthClaimNonRevMtp = (0, common_1.prepareSiblingsStr)(sigProof.issuerAuthNonRevProof.proof, this.getMTLevel());
            const nodeAuxIssuerAuthNonRev = (0, common_1.getNodeAuxValue)(sigProof.issuerAuthNonRevProof.proof);
            s.issuerAuthClaimNonRevMtpAuxHi = nodeAuxIssuerAuthNonRev.key.bigInt().toString();
            s.issuerAuthClaimNonRevMtpAuxHv = nodeAuxIssuerAuthNonRev.value.bigInt().toString();
            s.issuerAuthClaimNonRevMtpNoAux = nodeAuxIssuerAuthNonRev.noAux;
            s.issuerAuthState = sigProof.issuerAuthIncProof.treeState?.state.bigInt().toString();
            this.fillMTPProofsWithZero(s);
        }
        else if (this.proofType === verifiable_1.ProofType.Iden3SparseMerkleTreeProof) {
            s.proofType = '2';
            const incProofTreeState = this.claim.incProof?.treeState;
            if (!incProofTreeState) {
                throw new Error(models_1.CircuitError.EmptyTreeState);
            }
            s.issuerClaimMtp = (0, common_1.prepareSiblingsStr)(this.claim.incProof?.proof, this.getMTLevel());
            s.issuerClaimClaimsTreeRoot = incProofTreeState.claimsRoot.bigInt().toString();
            s.issuerClaimRevTreeRoot = incProofTreeState.revocationRoot.bigInt().toString();
            s.issuerClaimRootsTreeRoot = incProofTreeState.rootOfRoots.bigInt().toString();
            s.issuerClaimIdenState = incProofTreeState.state.bigInt().toString();
            this.fillSigProofWithZero(s);
        }
        const nodeAuxNonRev = (0, common_1.getNodeAuxValue)(this.claim.nonRevProof.proof);
        s.issuerClaimNonRevMtpAuxHi = nodeAuxNonRev.key.bigInt().toString();
        s.issuerClaimNonRevMtpAuxHv = nodeAuxNonRev.value.bigInt().toString();
        s.issuerClaimNonRevMtpNoAux = nodeAuxNonRev.noAux;
        const nodAuxJSONLD = (0, common_1.getNodeAuxValue)(valueProof.mtp);
        s.claimPathMtpNoAux = nodAuxJSONLD.noAux;
        s.claimPathMtpAuxHi = nodAuxJSONLD.key.bigInt().toString();
        s.claimPathMtpAuxHv = nodAuxJSONLD.value.bigInt().toString();
        s.claimPathKey = valueProof.path.toString();
        s.valueArraySize = this.query.values.length;
        const values = (0, common_1.prepareCircuitArrayValues)(this.query.values, this.getValueArrSize());
        s.value = (0, common_1.bigIntArrayToStringArray)(values);
        s.linkNonce = this.linkNonce.toString();
        s.verifierID = this.verifierID?.bigInt().toString() ?? '0';
        s.nullifierSessionID = this.nullifierSessionID.toString();
        s.isBJJAuthEnabled = this.isBJJAuthEnabled.toString();
        return utils_1.byteEncoder.encode(JSON.stringify(s));
    }
}
exports.AtomicQueryV3OnChainInputs = AtomicQueryV3OnChainInputs;
/**
 * @beta
 * AtomicQueryV3OnChainPubSignals public inputs
 */
class AtomicQueryV3OnChainPubSignals extends common_1.BaseConfig {
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
        const sVals = JSON.parse(utils_1.byteDecoder.decode(data));
        let fieldIdx = 0;
        //  - userID
        this.userID = js_iden3_core_custom_1.Id.fromBigInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - circuitQueryHash
        this.circuitQueryHash = BigInt(sVals[fieldIdx]);
        fieldIdx++;
        // - issuerState
        this.issuerState = js_merkletree_1.Hash.fromString(sVals[fieldIdx]);
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
        this.gistRoot = js_merkletree_1.Hash.fromString(sVals[fieldIdx]);
        fieldIdx++;
        // - issuerID
        this.issuerID = js_iden3_core_custom_1.Id.fromBigInt(BigInt(sVals[fieldIdx]));
        fieldIdx++;
        // - issuerClaimNonRevState
        this.issuerClaimNonRevState = js_merkletree_1.Hash.fromString(sVals[fieldIdx]);
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
exports.AtomicQueryV3OnChainPubSignals = AtomicQueryV3OnChainPubSignals;
