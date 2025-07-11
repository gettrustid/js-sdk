"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputGenerator = exports.circuitValidator = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const verifiable_1 = require("../../verifiable");
const circuits_1 = require("../../circuits");
const common_1 = require("../common");
const credentials_1 = require("../../credentials");
const utils_1 = require("../../utils");
const allOperations = Object.values(circuits_1.QueryOperators);
const v2Operations = [
    circuits_1.Operators.NOOP,
    circuits_1.Operators.EQ,
    circuits_1.Operators.LT,
    circuits_1.Operators.GT,
    circuits_1.Operators.IN,
    circuits_1.Operators.NIN,
    circuits_1.Operators.NE,
    circuits_1.Operators.SD
];
const v2OnChainOperations = [
    circuits_1.Operators.EQ,
    circuits_1.Operators.LT,
    circuits_1.Operators.GT,
    circuits_1.Operators.IN,
    circuits_1.Operators.NIN,
    circuits_1.Operators.NE
];
exports.circuitValidator = {
    [circuits_1.CircuitId.AtomicQueryMTPV2]: { maxQueriesCount: 1, supportedOperations: v2Operations },
    [circuits_1.CircuitId.AtomicQueryMTPV2OnChain]: {
        maxQueriesCount: 1,
        supportedOperations: v2OnChainOperations
    },
    [circuits_1.CircuitId.AtomicQuerySigV2]: { maxQueriesCount: 1, supportedOperations: v2Operations },
    [circuits_1.CircuitId.AtomicQuerySigV2OnChain]: {
        maxQueriesCount: 1,
        supportedOperations: v2OnChainOperations
    },
    [circuits_1.CircuitId.AtomicQueryV3]: { maxQueriesCount: 1, supportedOperations: allOperations },
    [circuits_1.CircuitId.AtomicQueryV3OnChain]: { maxQueriesCount: 1, supportedOperations: allOperations },
    [circuits_1.CircuitId.AuthV2]: { maxQueriesCount: 0, supportedOperations: [] },
    [circuits_1.CircuitId.StateTransition]: { maxQueriesCount: 0, supportedOperations: [] },
    [circuits_1.CircuitId.LinkedMultiQuery10]: { maxQueriesCount: 10, supportedOperations: allOperations }
};
class InputGenerator {
    constructor(_identityWallet, _credentialWallet, _stateStorage) {
        this._identityWallet = _identityWallet;
        this._credentialWallet = _credentialWallet;
        this._stateStorage = _stateStorage;
        this.credentialAtomicQueryMTPV2PrepareInputs = async ({ preparedCredential, identifier, proofReq, params, circuitQueries }) => {
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            const circuitInputs = new circuits_1.AtomicQueryMTPV2Inputs();
            circuitInputs.id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.requestID = BigInt(proofReq.id);
            const query = circuitQueries[0];
            query.operator = this.transformV2QueryOperator(query.operator);
            circuitInputs.query = query;
            circuitInputs.claim = {
                issuerID: circuitClaimData.issuerId,
                claim: circuitClaimData.claim,
                incProof: { proof: circuitClaimData.proof, treeState: circuitClaimData.treeState },
                nonRevProof: circuitClaimData.nonRevProof
            };
            circuitInputs.currentTimeStamp = (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date());
            circuitInputs.claimSubjectProfileNonce = BigInt(params.credentialSubjectProfileNonce);
            circuitInputs.profileNonce = BigInt(params.authProfileNonce);
            circuitInputs.skipClaimRevocationCheck = params.skipRevocation;
            this.checkOperatorSupport(proofReq.circuitId, query.operator);
            return circuitInputs.inputsMarshal();
        };
        this.credentialAtomicQueryMTPV2OnChainPrepareInputs = async ({ preparedCredential, identifier, proofReq, params, circuitQueries }) => {
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            const authInfo = await this.prepareAuthBJJCredential(identifier);
            const authClaimData = await this.newCircuitClaimData({
                credential: authInfo.credential,
                credentialCoreClaim: authInfo.coreClaim
            });
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            const circuitInputs = new circuits_1.AtomicQueryMTPV2OnChainInputs();
            const id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.requestID = BigInt(proofReq.id);
            const stateProof = await this._stateStorage.getGISTProof(id.bigInt());
            const gistProof = (0, common_1.toGISTProof)(stateProof);
            circuitInputs.gistProof = gistProof;
            if (authClaimData?.treeState) {
                circuitInputs.treeState = {
                    state: authClaimData?.treeState?.state,
                    claimsRoot: authClaimData?.treeState?.claimsRoot,
                    revocationRoot: authClaimData?.treeState?.revocationRoot,
                    rootOfRoots: authClaimData?.treeState?.rootOfRoots
                };
            }
            circuitInputs.authClaim = authClaimData.claim;
            circuitInputs.authClaimIncMtp = authClaimData.proof;
            circuitInputs.authClaimNonRevMtp = authInfo.nonRevProof.proof;
            if (!params.challenge) {
                throw new Error('challenge must be provided for onchain circuits');
            }
            const signature = await this._identityWallet.signChallenge(params.challenge, authInfo.credential);
            circuitInputs.signature = signature;
            circuitInputs.challenge = params.challenge;
            const query = circuitQueries[0];
            circuitInputs.query = query;
            circuitInputs.claim = {
                issuerID: circuitClaimData.issuerId,
                claim: circuitClaimData.claim,
                incProof: { proof: circuitClaimData.proof, treeState: circuitClaimData.treeState },
                nonRevProof: circuitClaimData.nonRevProof
            };
            circuitInputs.currentTimeStamp = (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date());
            circuitInputs.claimSubjectProfileNonce = BigInt(params.credentialSubjectProfileNonce);
            circuitInputs.profileNonce = BigInt(params.authProfileNonce);
            circuitInputs.skipClaimRevocationCheck = params.skipRevocation;
            this.checkOperatorSupport(proofReq.circuitId, query.operator);
            return circuitInputs.inputsMarshal();
        };
        this.credentialAtomicQuerySigV2PrepareInputs = async ({ preparedCredential, identifier, proofReq, params, circuitQueries }) => {
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            const circuitInputs = new circuits_1.AtomicQuerySigV2Inputs();
            circuitInputs.id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.claim = {
                issuerID: circuitClaimData?.issuerId,
                signatureProof: circuitClaimData.signatureProof,
                claim: circuitClaimData.claim,
                nonRevProof: circuitClaimData.nonRevProof
            };
            circuitInputs.requestID = BigInt(proofReq.id);
            circuitInputs.claimSubjectProfileNonce = BigInt(params.credentialSubjectProfileNonce);
            circuitInputs.profileNonce = BigInt(params.authProfileNonce);
            circuitInputs.skipClaimRevocationCheck = params.skipRevocation;
            const query = circuitQueries[0];
            query.operator = this.transformV2QueryOperator(query.operator);
            circuitInputs.query = query;
            circuitInputs.currentTimeStamp = (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date());
            this.checkOperatorSupport(proofReq.circuitId, query.operator);
            return circuitInputs.inputsMarshal();
        };
        this.credentialAtomicQuerySigV2OnChainPrepareInputs = async ({ preparedCredential, identifier, proofReq, params, circuitQueries }) => {
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            const authInfo = await this.prepareAuthBJJCredential(identifier);
            const authClaimData = await this.newCircuitClaimData({
                credential: authInfo.credential,
                credentialCoreClaim: authInfo.coreClaim
            });
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            const circuitInputs = new circuits_1.AtomicQuerySigV2OnChainInputs();
            const id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.id = id;
            circuitInputs.claim = {
                issuerID: circuitClaimData.issuerId,
                signatureProof: circuitClaimData.signatureProof,
                claim: circuitClaimData.claim,
                nonRevProof: circuitClaimData.nonRevProof
            };
            circuitInputs.requestID = BigInt(proofReq.id);
            circuitInputs.claimSubjectProfileNonce = BigInt(params.credentialSubjectProfileNonce);
            circuitInputs.profileNonce = BigInt(params.authProfileNonce);
            circuitInputs.skipClaimRevocationCheck = params.skipRevocation;
            const query = circuitQueries[0];
            circuitInputs.query = query;
            circuitInputs.currentTimeStamp = (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date());
            if (authClaimData.treeState) {
                circuitInputs.treeState = {
                    state: authClaimData.treeState?.state,
                    claimsRoot: authClaimData.treeState?.claimsRoot,
                    revocationRoot: authClaimData.treeState?.revocationRoot,
                    rootOfRoots: authClaimData.treeState?.rootOfRoots
                };
            }
            const stateProof = await this._stateStorage.getGISTProof(id.bigInt());
            const gistProof = (0, common_1.toGISTProof)(stateProof);
            circuitInputs.gistProof = gistProof;
            circuitInputs.authClaim = authClaimData.claim;
            circuitInputs.authClaimIncMtp = authClaimData.proof;
            circuitInputs.authClaimNonRevMtp = authInfo.nonRevProof.proof;
            if (!params.challenge) {
                throw new Error('challenge must be provided for onchain circuits');
            }
            const signature = await this._identityWallet.signChallenge(params.challenge, authInfo.credential);
            circuitInputs.signature = signature;
            circuitInputs.challenge = params.challenge;
            this.checkOperatorSupport(proofReq.circuitId, query.operator);
            return circuitInputs.inputsMarshal();
        };
        this.credentialAtomicQueryV3PrepareInputs = async ({ preparedCredential, identifier, proofReq, params, circuitQueries }) => {
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            let proofType;
            switch (proofReq.query.proofType) {
                case verifiable_1.ProofType.BJJSignature:
                    proofType = verifiable_1.ProofType.BJJSignature;
                    break;
                case verifiable_1.ProofType.Iden3SparseMerkleTreeProof:
                    proofType = verifiable_1.ProofType.Iden3SparseMerkleTreeProof;
                    break;
                default:
                    if (circuitClaimData.proof) {
                        proofType = verifiable_1.ProofType.Iden3SparseMerkleTreeProof;
                    }
                    else if (circuitClaimData.signatureProof) {
                        proofType = verifiable_1.ProofType.BJJSignature;
                    }
                    else {
                        throw Error('claim has no MTP or signature proof');
                    }
                    break;
            }
            const circuitInputs = new circuits_1.AtomicQueryV3Inputs();
            circuitInputs.id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.claim = {
                issuerID: circuitClaimData?.issuerId,
                signatureProof: circuitClaimData.signatureProof,
                claim: circuitClaimData.claim,
                nonRevProof: circuitClaimData.nonRevProof,
                incProof: { proof: circuitClaimData.proof, treeState: circuitClaimData.treeState }
            };
            circuitInputs.requestID = BigInt(proofReq.id);
            circuitInputs.claimSubjectProfileNonce = BigInt(params.credentialSubjectProfileNonce);
            circuitInputs.profileNonce = BigInt(params.authProfileNonce);
            circuitInputs.skipClaimRevocationCheck = params.skipRevocation;
            const query = circuitQueries[0];
            query.values = [circuits_1.Operators.SD, circuits_1.Operators.NOOP].includes(query.operator) ? [] : query.values;
            query.valueProof = query.operator === circuits_1.Operators.NOOP ? new circuits_1.ValueProof() : query.valueProof;
            circuitInputs.query = query;
            circuitInputs.currentTimeStamp = (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date());
            circuitInputs.proofType = proofType;
            circuitInputs.linkNonce = params.linkNonce ?? BigInt(0);
            circuitInputs.verifierID = params.verifierDid ? js_iden3_core_custom_1.DID.idFromDID(params.verifierDid) : undefined;
            circuitInputs.nullifierSessionID = proofReq.params?.nullifierSessionId
                ? BigInt(proofReq.params?.nullifierSessionId?.toString())
                : BigInt(0);
            this.checkOperatorSupport(proofReq.circuitId, query.operator);
            return circuitInputs.inputsMarshal();
        };
        this.credentialAtomicQueryV3OnChainPrepareInputs = async ({ preparedCredential, identifier, proofReq, params, circuitQueries }) => {
            const id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            let proofType;
            switch (proofReq.query.proofType) {
                case verifiable_1.ProofType.BJJSignature:
                    proofType = verifiable_1.ProofType.BJJSignature;
                    break;
                case verifiable_1.ProofType.Iden3SparseMerkleTreeProof:
                    proofType = verifiable_1.ProofType.Iden3SparseMerkleTreeProof;
                    break;
                default:
                    if (circuitClaimData.proof) {
                        proofType = verifiable_1.ProofType.Iden3SparseMerkleTreeProof;
                    }
                    else if (circuitClaimData.signatureProof) {
                        proofType = verifiable_1.ProofType.BJJSignature;
                    }
                    else {
                        throw Error('claim has no MTP or signature proof');
                    }
                    break;
            }
            const circuitInputs = new circuits_1.AtomicQueryV3OnChainInputs();
            circuitInputs.id = js_iden3_core_custom_1.DID.idFromDID(identifier);
            circuitInputs.claim = {
                issuerID: circuitClaimData?.issuerId,
                signatureProof: circuitClaimData.signatureProof,
                claim: circuitClaimData.claim,
                nonRevProof: circuitClaimData.nonRevProof,
                incProof: { proof: circuitClaimData.proof, treeState: circuitClaimData.treeState }
            };
            circuitInputs.requestID = BigInt(proofReq.id);
            circuitInputs.claimSubjectProfileNonce = BigInt(params.credentialSubjectProfileNonce);
            circuitInputs.profileNonce = BigInt(params.authProfileNonce);
            circuitInputs.skipClaimRevocationCheck = params.skipRevocation;
            const query = circuitQueries[0];
            query.values = [circuits_1.Operators.SD, circuits_1.Operators.NOOP].includes(query.operator) ? [] : query.values;
            query.valueProof = query.operator === circuits_1.Operators.NOOP ? new circuits_1.ValueProof() : query.valueProof;
            circuitInputs.query = query;
            circuitInputs.currentTimeStamp = (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date());
            circuitInputs.proofType = proofType;
            circuitInputs.linkNonce = params.linkNonce ?? BigInt(0);
            circuitInputs.verifierID = params.verifierDid ? js_iden3_core_custom_1.DID.idFromDID(params.verifierDid) : undefined;
            circuitInputs.nullifierSessionID = proofReq.params?.nullifierSessionId
                ? BigInt(proofReq.params?.nullifierSessionId?.toString())
                : BigInt(0);
            const isEthIdentity = (0, utils_1.isEthereumIdentity)(identifier);
            circuitInputs.isBJJAuthEnabled = isEthIdentity ? 0 : 1;
            circuitInputs.challenge = BigInt(params.challenge ?? 0);
            const stateProof = await this._stateStorage.getGISTProof(id.bigInt());
            const gistProof = (0, common_1.toGISTProof)(stateProof);
            circuitInputs.gistProof = gistProof;
            // auth inputs
            if (circuitInputs.isBJJAuthEnabled === 1) {
                const authPrepared = await this.prepareAuthBJJCredential(identifier);
                const authClaimData = await this.newCircuitClaimData({
                    credential: authPrepared.credential,
                    credentialCoreClaim: authPrepared.coreClaim
                });
                const signature = await this._identityWallet.signChallenge(circuitInputs.challenge, authPrepared.credential);
                circuitInputs.authClaim = authClaimData.claim;
                circuitInputs.authClaimIncMtp = authClaimData.proof;
                circuitInputs.authClaimNonRevMtp = authPrepared.nonRevProof.proof;
                circuitInputs.treeState = authClaimData.treeState;
                circuitInputs.signature = signature;
            }
            this.checkOperatorSupport(proofReq.circuitId, query.operator);
            return circuitInputs.inputsMarshal();
        };
        this.linkedMultiQuery10PrepareInputs = async ({ preparedCredential, params, proofReq, circuitQueries }) => {
            const circuitClaimData = await this.newCircuitClaimData(preparedCredential);
            circuitClaimData.nonRevProof = (0, common_1.toClaimNonRevStatus)(preparedCredential.revStatus);
            const circuitInputs = new circuits_1.LinkedMultiQueryInputs();
            circuitInputs.linkNonce = params.linkNonce ?? BigInt(0);
            circuitInputs.claim = circuitClaimData.claim;
            circuitInputs.query = circuitQueries;
            circuitQueries.forEach((query) => {
                this.checkOperatorSupport(proofReq.circuitId, query.operator);
            });
            circuitQueries.forEach((query) => {
                query.values = [circuits_1.Operators.SD, circuits_1.Operators.NOOP].includes(query.operator) ? [] : query.values;
                query.valueProof = query.operator === circuits_1.Operators.NOOP ? new circuits_1.ValueProof() : query.valueProof;
            });
            return circuitInputs.inputsMarshal();
        };
    }
    async generateInputs(ctx) {
        const { circuitId } = ctx.proofReq;
        const fnName = `${circuitId.split('-')[0]}PrepareInputs`;
        const queriesLength = ctx.circuitQueries.length;
        if (queriesLength > exports.circuitValidator[circuitId].maxQueriesCount) {
            throw new Error(`circuit ${circuitId} supports only ${exports.circuitValidator[circuitId].maxQueriesCount} queries`);
        }
        const fn = this[fnName];
        if (!fn) {
            throw new Error(`inputs generator for ${circuitId} not found`);
        }
        return fn(ctx);
    }
    async newCircuitClaimData(preparedCredential) {
        const smtProof = preparedCredential.credential.getIden3SparseMerkleTreeProof();
        const circuitClaim = new circuits_1.CircuitClaim();
        circuitClaim.claim = preparedCredential.credentialCoreClaim;
        circuitClaim.issuerId = js_iden3_core_custom_1.DID.idFromDID(js_iden3_core_custom_1.DID.parse(preparedCredential.credential.issuer));
        if (smtProof) {
            circuitClaim.proof = smtProof.mtp;
            circuitClaim.treeState = {
                state: smtProof.issuerData.state.value,
                claimsRoot: smtProof.issuerData.state.claimsTreeRoot,
                revocationRoot: smtProof.issuerData.state.revocationTreeRoot,
                rootOfRoots: smtProof.issuerData.state.rootOfRoots
            };
        }
        const sigProof = preparedCredential.credential.getBJJSignature2021Proof();
        if (sigProof) {
            const issuerDID = sigProof.issuerData.id;
            const userDID = (0, credentials_1.getUserDIDFromCredential)(issuerDID, preparedCredential.credential);
            const { credentialStatus, mtp, authCoreClaim } = sigProof.issuerData;
            if (!credentialStatus) {
                throw new Error("can't check the validity of issuer auth claim: no credential status in proof");
            }
            if (!mtp) {
                throw new Error('issuer auth credential must have a mtp proof');
            }
            if (!authCoreClaim) {
                throw new Error('issuer auth credential must have a core claim proof');
            }
            const opts = {
                issuerGenesisState: sigProof.issuerData.state,
                issuerDID,
                userDID
            };
            const rs = await this._credentialWallet.getRevocationStatus(credentialStatus, opts);
            const issuerAuthNonRevProof = (0, common_1.toClaimNonRevStatus)(rs);
            circuitClaim.signatureProof = {
                signature: sigProof.signature,
                issuerAuthIncProof: {
                    proof: sigProof.issuerData.mtp,
                    treeState: {
                        state: sigProof.issuerData.state.value,
                        claimsRoot: sigProof.issuerData.state.claimsTreeRoot,
                        revocationRoot: sigProof.issuerData.state.revocationTreeRoot,
                        rootOfRoots: sigProof.issuerData.state.rootOfRoots
                    }
                },
                issuerAuthClaim: sigProof.issuerData.authCoreClaim,
                issuerAuthNonRevProof
            };
        }
        return circuitClaim;
    }
    async prepareAuthBJJCredential(did, treeStateInfo) {
        const { authCredential, incProof, nonRevProof } = await this._identityWallet.getActualAuthCredential(did, treeStateInfo);
        const authCoreClaim = authCredential.getCoreClaimFromProof(verifiable_1.ProofType.Iden3SparseMerkleTreeProof);
        if (!authCoreClaim) {
            throw new Error('auth core claim is not defined for auth bjj credential');
        }
        return {
            credential: authCredential,
            incProof,
            nonRevProof,
            coreClaim: authCoreClaim
        };
    }
    transformV2QueryOperator(operator) {
        return operator === circuits_1.Operators.SD || operator === circuits_1.Operators.NOOP ? circuits_1.Operators.EQ : operator;
    }
    checkOperatorSupport(circuitId, operator) {
        const supportedOperators = exports.circuitValidator[circuitId].supportedOperations;
        if (!supportedOperators.includes(operator)) {
            throw new Error(`operator ${(0, circuits_1.getOperatorNameByValue)(operator)} is not supported by ${circuitId}`);
        }
    }
}
exports.InputGenerator = InputGenerator;
