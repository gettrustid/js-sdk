"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTreeState = exports.extractProof = exports.W3CCredential = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const proof_1 = require("./proof");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const js_merkletree_1 = require("@iden3/js-merkletree");
const js_jsonld_merklization_1 = require("@iden3/js-jsonld-merklization");
const js_crypto_1 = require("@iden3/js-crypto");
const utils_1 = require("../credentials/utils");
const utils_2 = require("../utils");
const constants_1 = require("./constants");
const core_utils_1 = require("./core-utils");
const jsonld = __importStar(require("jsonld/lib"));
const ldcontext = __importStar(require("jsonld/lib/context"));
/**
 * W3C Verifiable credential
 *
 * @public
 * @export
 * @class W3CCredential
 */
class W3CCredential {
    constructor() {
        this.id = '';
        this['@context'] = [];
        this.type = [];
        this.credentialSubject = {};
        this.issuer = '';
    }
    /**
     *
     * @param issuer - DID of the issuer
     * @param request - Credential request
     * @returns - W3C Credential
     */
    static fromCredentialRequest(issuer, request) {
        if (!request.id) {
            throw new Error('Credential id is required');
        }
        if (!request.context) {
            throw new Error('Credential context is required');
        }
        const context = [
            constants_1.VerifiableConstants.JSONLD_SCHEMA.W3C_CREDENTIAL_2018,
            constants_1.VerifiableConstants.JSONLD_SCHEMA.IDEN3_CREDENTIAL,
            ...request.context
        ];
        const credentialType = [
            constants_1.VerifiableConstants.CREDENTIAL_TYPE.W3C_VERIFIABLE_CREDENTIAL,
            request.type
        ];
        const credentialSubject = request.credentialSubject;
        credentialSubject['type'] = request.type;
        const cr = new W3CCredential();
        cr.id = request.id;
        cr['@context'] = context;
        cr.type = credentialType;
        cr.credentialSubject = credentialSubject;
        cr.issuer = issuer.string();
        cr.credentialSchema = {
            id: request.credentialSchema,
            type: constants_1.VerifiableConstants.JSON_SCHEMA_VALIDATOR
        };
        cr.credentialStatus = W3CCredential.buildCredentialStatus(request, issuer);
        request.expiration && (cr.expirationDate = new Date(request.expiration).toISOString());
        request.refreshService && (cr.refreshService = request.refreshService);
        request.displayMethod && (cr.displayMethod = request.displayMethod);
        request.issuanceDate && (cr.issuanceDate = new Date(request.issuanceDate).toISOString());
        return cr;
    }
    /**
     * Builds credential status
     * @param {CredentialRequest} request
     * @returns `CredentialStatus`
     */
    static buildCredentialStatus(request, issuer) {
        const credentialStatus = {
            id: request.revocationOpts.id,
            type: request.revocationOpts.type,
            revocationNonce: request.revocationOpts.nonce
        };
        switch (request.revocationOpts.type) {
            case constants_1.CredentialStatusType.SparseMerkleTreeProof:
                return {
                    ...credentialStatus,
                    id: `${credentialStatus.id.replace(/\/$/, '')}/${credentialStatus.revocationNonce}`
                };
            case constants_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof:
                return {
                    ...credentialStatus,
                    id: request.revocationOpts.issuerState
                        ? `${credentialStatus.id.replace(/\/$/, '')}/node?state=${request.revocationOpts.issuerState}`
                        : `${credentialStatus.id.replace(/\/$/, '')}`
                };
            case constants_1.CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023: {
                const issuerId = js_iden3_core_custom_1.DID.idFromDID(issuer);
                const chainId = (0, js_iden3_core_custom_1.getChainId)(js_iden3_core_custom_1.DID.blockchainFromId(issuerId), js_iden3_core_custom_1.DID.networkIdFromId(issuerId));
                const searchParams = [
                    ['revocationNonce', request.revocationOpts.nonce?.toString() || ''],
                    ['contractAddress', `${chainId}:${request.revocationOpts.id}`],
                    ['state', request.revocationOpts.issuerState || '']
                ]
                    .filter(([, value]) => Boolean(value))
                    .map(([key, value]) => `${key}=${value}`)
                    .join('&');
                return {
                    ...credentialStatus,
                    // `[did]:[methodid]:[chain]:[network]:[id]/credentialStatus?(revocationNonce=value)&[contractAddress=[chainID]:[contractAddress]]&(state=issuerState)`
                    id: `${issuer.string()}/credentialStatus?${searchParams}`
                };
            }
            default:
                return credentialStatus;
        }
    }
    toJSON() {
        return {
            ...this,
            proof: Array.isArray(this.proof)
                ? this.proof.map(this.proofToJSON)
                : this.proofToJSON(this.proof)
        };
    }
    proofToJSON(p) {
        if (!p) {
            return p;
        }
        if (!p['type']) {
            throw new Error('proof must have type property');
        }
        switch (p.type) {
            case constants_1.ProofType.Iden3SparseMerkleTreeProof:
            case constants_1.ProofType.BJJSignature:
                return p.toJSON();
            default:
                return p;
        }
    }
    static fromJSON(obj) {
        const w = new W3CCredential();
        Object.assign(w, structuredClone(obj));
        w.proof = Array.isArray(w.proof)
            ? w.proof.map(W3CCredential.proofFromJSON)
            : W3CCredential.proofFromJSON(w.proof);
        return w;
    }
    /**
     * merklization of the verifiable credential
     *
     * @returns `Promise<Merklizer>`
     */
    async merklize(opts) {
        const credential = { ...this };
        delete credential.proof;
        return await js_jsonld_merklization_1.Merklizer.merklizeJSONLD(JSON.stringify(credential), opts);
    }
    /**
     * gets core claim representation from credential proof
     *
     * @param {ProofType} proofType
     * @returns {*}  {(Claim | undefined)}
     */
    getCoreClaimFromProof(proofType) {
        if (Array.isArray(this.proof)) {
            for (const proof of this.proof) {
                const { claim, proofType: extractedProofType } = extractProof(proof);
                if (proofType === extractedProofType) {
                    return claim;
                }
            }
        }
        else if (typeof this.proof === 'object') {
            const { claim, proofType: extractedProofType } = extractProof(this.proof);
            if (extractedProofType == proofType) {
                return claim;
            }
        }
        return undefined;
    }
    /**
     * gets core claim representation from W3CCredential
     *
     * @param {CoreClaimParsingOptions} [opts] - options to create core claim
     * @returns {*}  {(Promise<Claim>)}
     */
    async toCoreClaim(opts) {
        if (!opts) {
            opts = {
                revNonce: 0,
                version: 0,
                subjectPosition: constants_1.SubjectPosition.Index,
                merklizedRootPosition: constants_1.MerklizedRootPosition.None,
                updatable: false,
                merklizeOpts: {}
            };
        }
        const mz = await this.merklize(opts.merklizeOpts);
        const credentialType = (0, core_utils_1.findCredentialType)(mz);
        const subjectId = this.credentialSubject['id'];
        const ldCtx = await jsonld.processContext(ldcontext.getInitialContext({}), this['@context'], mz.options);
        const { slots, nonMerklized } = await (0, core_utils_1.parseCoreClaimSlots)(ldCtx, mz, credentialType);
        // if schema is for non merklized credential, root position must be set to none ('')
        // otherwise default position for merklized position is index.
        if (nonMerklized && opts.merklizedRootPosition !== constants_1.MerklizedRootPosition.None) {
            throw new Error('merklized root position is not supported for non-merklized claims');
        }
        if (!nonMerklized && opts.merklizedRootPosition === constants_1.MerklizedRootPosition.None) {
            opts.merklizedRootPosition = constants_1.MerklizedRootPosition.Index;
        }
        const schemaHash = (0, core_utils_1.calculateCoreSchemaHash)(utils_2.byteEncoder.encode(credentialType));
        const claim = js_iden3_core_custom_1.Claim.newClaim(schemaHash, js_iden3_core_custom_1.ClaimOptions.withIndexDataBytes(slots.indexA, slots.indexB), js_iden3_core_custom_1.ClaimOptions.withValueDataBytes(slots.valueA, slots.valueB), js_iden3_core_custom_1.ClaimOptions.withRevocationNonce(BigInt(opts.revNonce)), js_iden3_core_custom_1.ClaimOptions.withVersion(opts.version));
        if (opts.updatable) {
            claim.setFlagUpdatable(opts.updatable);
        }
        if (this.expirationDate) {
            claim.setExpirationDate(new Date(this.expirationDate));
        }
        if (subjectId) {
            const did = js_iden3_core_custom_1.DID.parse(subjectId.toString());
            const id = js_iden3_core_custom_1.DID.idFromDID(did);
            switch (opts.subjectPosition) {
                case '':
                case constants_1.SubjectPosition.Index:
                    claim.setIndexId(id);
                    break;
                case constants_1.SubjectPosition.Value:
                    claim.setValueId(id);
                    break;
                default:
                    throw new Error('unknown subject position');
            }
        }
        switch (opts.merklizedRootPosition) {
            case constants_1.MerklizedRootPosition.Index: {
                const mk = await this.merklize(opts.merklizeOpts);
                claim.setIndexMerklizedRoot((await mk.root()).bigInt());
                break;
            }
            case constants_1.MerklizedRootPosition.Value: {
                const mk = await this.merklize(opts.merklizeOpts);
                claim.setValueMerklizedRoot((await mk.root()).bigInt());
                break;
            }
            case constants_1.MerklizedRootPosition.None:
                break;
            default:
                throw new Error('unknown merklized root position');
        }
        return claim;
    }
    /**
     * checks BJJSignatureProof2021 in W3C VC
     *
     * @returns BJJSignatureProof2021 | undefined
     */
    getBJJSignature2021Proof() {
        const proof = this.getProofByType(constants_1.ProofType.BJJSignature);
        if (proof) {
            return proof;
        }
        return undefined;
    }
    /**
     * checks Iden3SparseMerkleTreeProof in W3C VC
     *
     * @returns {*}  {(Iden3SparseMerkleTreeProof | undefined)}
     */
    getIden3SparseMerkleTreeProof() {
        const proof = this.getProofByType(constants_1.ProofType.Iden3SparseMerkleTreeProof);
        if (proof) {
            return proof;
        }
        return undefined;
    }
    /**
     * Verify credential proof
     *
     * @returns {*}  {(boolean)}
     */
    async verifyProof(proofType, resolverURL, opts) {
        const proof = this.getProofByType(proofType);
        if (!proof) {
            throw new Error('proof not found');
        }
        const coreClaim = this.getCoreClaimFromProof(proofType);
        if (!coreClaim) {
            throw new Error(`can't get core claim`);
        }
        await this.verifyCoreClaimMatch(coreClaim, opts?.merklizeOptions);
        switch (proofType) {
            case constants_1.ProofType.BJJSignature: {
                if (!opts?.credStatusResolverRegistry) {
                    throw new Error('please provide credential status resolver registry');
                }
                const bjjProof = proof;
                const userDID = (0, utils_1.getUserDIDFromCredential)(bjjProof.issuerData.id, this);
                return this.verifyBJJSignatureProof(bjjProof, coreClaim, resolverURL, userDID, opts.credStatusResolverRegistry);
            }
            case constants_1.ProofType.Iden3SparseMerkleTreeProof: {
                return this.verifyIden3SparseMerkleTreeProof(proof, coreClaim, resolverURL);
            }
            default: {
                throw new Error('invalid proof type');
            }
        }
    }
    async verifyCoreClaimMatch(coreClaim, merklizeOpts) {
        let merklizedRootPosition = '';
        const merklizedPosition = coreClaim.getMerklizedPosition();
        switch (merklizedPosition) {
            case js_iden3_core_custom_1.MerklizedRootPosition.None:
                merklizedRootPosition = constants_1.MerklizedRootPosition.None;
                break;
            case js_iden3_core_custom_1.MerklizedRootPosition.Index:
                merklizedRootPosition = constants_1.MerklizedRootPosition.Index;
                break;
            case js_iden3_core_custom_1.MerklizedRootPosition.Value:
                merklizedRootPosition = constants_1.MerklizedRootPosition.Value;
                break;
        }
        let subjectPosition = '';
        const idPosition = coreClaim.getIdPosition();
        switch (idPosition) {
            case js_iden3_core_custom_1.IdPosition.None:
                subjectPosition = constants_1.SubjectPosition.None;
                break;
            case js_iden3_core_custom_1.IdPosition.Index:
                subjectPosition = constants_1.SubjectPosition.Index;
                break;
            case js_iden3_core_custom_1.IdPosition.Value:
                subjectPosition = constants_1.SubjectPosition.Value;
                break;
        }
        const coreClaimOpts = {
            revNonce: Number(coreClaim.getRevocationNonce()),
            version: coreClaim.getVersion(),
            merklizedRootPosition,
            subjectPosition,
            updatable: coreClaim.getFlagUpdatable(),
            merklizeOpts: merklizeOpts
        };
        const credentialCoreClaim = await this.toCoreClaim(coreClaimOpts);
        if (coreClaim.hex() != credentialCoreClaim.hex()) {
            throw new Error('proof generated for another credential');
        }
    }
    async verifyBJJSignatureProof(proof, coreClaim, resolverURL, userDID, credStatusResolverRegistry) {
        // issuer auth claim
        const authClaim = proof.issuerData.authCoreClaim;
        const rawSlotsInt = authClaim.rawSlotsAsInts();
        const pubKey = new js_crypto_1.PublicKey([rawSlotsInt[2], rawSlotsInt[3]]);
        // core claim hash
        const { hi, hv } = coreClaim.hiHv();
        const claimHash = js_crypto_1.poseidon.hash([hi, hv]);
        const bjjValid = pubKey.verifyPoseidon(claimHash, proof.signature);
        if (!bjjValid) {
            throw new Error('signature is not valid');
        }
        await (0, utils_2.validateDIDDocumentAuth)(proof.issuerData.id, resolverURL, proof.issuerData.state.value);
        const credStatusType = proof.issuerData.credentialStatus.type;
        const credStatusResolver = await credStatusResolverRegistry.get(credStatusType);
        if (!credStatusResolver) {
            throw new Error(`please register credential status resolver for ${credStatusType} type`);
        }
        const credStatus = await credStatusResolver.resolve(proof.issuerData.credentialStatus, {
            issuerDID: proof.issuerData.id,
            userDID: userDID
        });
        const stateValid = validateTreeState(credStatus.issuer);
        if (!stateValid) {
            throw new Error('signature proof: invalid tree state of the issuer while checking credential status of singing key');
        }
        const revocationNonce = BigInt(proof.issuerData.credentialStatus.revocationNonce || 0);
        if (revocationNonce !== proof.issuerData.authCoreClaim.getRevocationNonce()) {
            throw new Error(`revocation nonce mismatch: revocation nonce from core representation of auth credential is not the same as in its credential`);
        }
        const proofValid = await (0, js_merkletree_1.verifyProof)(js_merkletree_1.Hash.fromHex(credStatus.issuer.revocationTreeRoot), credStatus.mtp, revocationNonce, BigInt(0));
        if (!proofValid) {
            throw new Error(`proof validation failed. revNonce=${revocationNonce}`);
        }
        if (credStatus.mtp.existence) {
            throw new Error('signature proof: singing key of the issuer is revoked');
        }
        return true;
    }
    async verifyIden3SparseMerkleTreeProof(proof, coreClaim, resolverURL) {
        await (0, utils_2.validateDIDDocumentAuth)(proof.issuerData.id, resolverURL, proof.issuerData.state.value);
        // root from proof == issuerData.state.claimsTreeRoot
        const { hi, hv } = coreClaim.hiHv();
        const rootFromProofValue = await (0, js_merkletree_1.rootFromProof)(proof.mtp, hi, hv);
        if (!rootFromProofValue.equals(proof.issuerData.state.claimsTreeRoot)) {
            throw new Error('verifyIden3SparseMerkleTreeProof: root from proof not equal to issuer data claims tree root');
        }
        return true;
    }
    getProofByType(proofType) {
        if (Array.isArray(this.proof)) {
            for (const proof of this.proof) {
                if (proof?.type === proofType) {
                    return proof;
                }
            }
        }
        else if (this.proof?.type == proofType) {
            return this.proof;
        }
        return undefined;
    }
}
exports.W3CCredential = W3CCredential;
W3CCredential.proofFromJSON = (p) => {
    if (!p) {
        return p;
    }
    if (!p['type']) {
        throw new Error('proof must have type property');
    }
    switch (p.type) {
        case constants_1.ProofType.Iden3SparseMerkleTreeProof:
            return proof_1.Iden3SparseMerkleTreeProof.fromJSON(p);
        case constants_1.ProofType.BJJSignature:
            return proof_1.BJJSignatureProof2021.fromJSON(p);
        default:
            return p;
    }
};
/**
 * extracts core claim from Proof and returns Proof Type
 *
 * @param {object} proof - proof of vc
 * @returns {*}  {{ claim: Claim; proofType: ProofType }}
 */
function extractProof(proof) {
    if (proof instanceof proof_1.Iden3SparseMerkleTreeProof) {
        return {
            claim: proof.coreClaim,
            proofType: constants_1.ProofType.Iden3SparseMerkleTreeProof
        };
    }
    if (proof instanceof proof_1.BJJSignatureProof2021) {
        return { claim: proof.coreClaim, proofType: constants_1.ProofType.BJJSignature };
    }
    if (typeof proof === 'object') {
        const p = proof;
        const defaultProofType = p.type;
        if (!defaultProofType) {
            throw new Error('proof type is not specified');
        }
        if (!p.coreClaim) {
            throw new Error(`coreClaim field is not defined in proof type ${defaultProofType}`);
        }
        const coreClaim = p.coreClaim instanceof js_iden3_core_custom_1.Claim ? p.coreClaim : new js_iden3_core_custom_1.Claim().fromHex(p.coreClaim);
        return { claim: coreClaim, proofType: defaultProofType };
    }
    throw new Error('proof format is not supported');
}
exports.extractProof = extractProof;
/**
 * validate tree state by recalculating poseidon hash of roots and comparing with state
 *
 * @param {Issuer} treeState - issuer struct
 * @returns {boolean}
 */
function validateTreeState(treeState) {
    const ctrHash = treeState.claimsTreeRoot ? js_merkletree_1.Hash.fromHex(treeState.claimsTreeRoot) : new js_merkletree_1.Hash();
    const rtrHash = treeState.revocationTreeRoot
        ? js_merkletree_1.Hash.fromHex(treeState.revocationTreeRoot)
        : new js_merkletree_1.Hash();
    const rorHash = treeState.rootOfRoots ? js_merkletree_1.Hash.fromHex(treeState.rootOfRoots) : new js_merkletree_1.Hash();
    const wantState = js_crypto_1.poseidon.hash([ctrHash.bigInt(), rtrHash.bigInt(), rorHash.bigInt()]);
    const stateHash = treeState.state ? js_merkletree_1.Hash.fromHex(treeState.state) : new js_merkletree_1.Hash();
    return wantState === stateHash.bigInt();
}
exports.validateTreeState = validateTreeState;
