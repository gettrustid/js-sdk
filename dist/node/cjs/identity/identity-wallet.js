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
exports.IdentityWallet = void 0;
const kms_1 = require("../kms");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const js_crypto_1 = require("@iden3/js-crypto");
const js_merkletree_1 = require("@iden3/js-merkletree");
const common_1 = require("./common");
const uuid = __importStar(require("uuid"));
const schema_processor_1 = require("../schema-processor");
const storage_1 = require("../storage");
const verifiable_1 = require("../verifiable");
const credentials_1 = require("../credentials");
const circuits_1 = require("../circuits");
const utils_1 = require("../utils");
const credential_status_publisher_1 = require("../credentials/status/credential-status-publisher");
const proof_1 = require("../proof");
const blockchain_1 = require("../blockchain");
/**
 * @public
 * Wallet instance to manage the digital identity based on iden3 protocol
 * allows to: create identity/profile, sign payloads (bigint / bytes), generate keys,
 * generate Merkle tree proofs of inclusion / non-inclusion to Merkle trees, issue credentials with a BJJSignature and Iden3SparseMerkleTree Proofs,
 * revoke credentials, add credentials to Merkle trees, push states to reverse hash service
 *
 *
 * @class IdentityWallet - class
 * @implements implements IIdentityWallet interface
 */
class IdentityWallet {
    /**
     * Constructs a new instance of the `IdentityWallet` class
     *
     * @param {KMS} _kms - Key Management System that allows signing data with BJJ key
     * @param {IDataStorage} _storage - data storage to access credential / identity / Merkle tree data
     * @param {ICredentialWallet} _credentialWallet - credential wallet instance to quickly access credential CRUD functionality
     * @public
     */
    constructor(_kms, _storage, _credentialWallet, _opts) {
        this._kms = _kms;
        this._storage = _storage;
        this._credentialWallet = _credentialWallet;
        this._opts = _opts;
        this._credentialStatusPublisherRegistry = this.getCredentialStatusPublisherRegistry(_opts);
        this._inputsGenerator = new proof_1.InputGenerator(this, _credentialWallet, _storage.states);
        this._transactionService = new blockchain_1.TransactionService(_storage.states.getRpcProvider());
    }
    get credentialWallet() {
        return this._credentialWallet;
    }
    getCredentialStatusPublisherRegistry(_opts) {
        if (!_opts?.credentialStatusPublisherRegistry) {
            const registry = new credential_status_publisher_1.CredentialStatusPublisherRegistry();
            const emptyPublisher = { publish: () => Promise.resolve() };
            registry.register(verifiable_1.CredentialStatusType.Iden3ReverseSparseMerkleTreeProof, new credential_status_publisher_1.Iden3SmtRhsCredentialStatusPublisher());
            registry.register(verifiable_1.CredentialStatusType.SparseMerkleTreeProof, emptyPublisher);
            registry.register(verifiable_1.CredentialStatusType.Iden3commRevocationStatusV1, emptyPublisher);
            return registry;
        }
        else {
            return this._opts?.credentialStatusPublisherRegistry;
        }
    }
    async createAuthCoreClaim(revNonce, seed) {
        const keyId = await this._kms.createKeyFromSeed(kms_1.KmsKeyType.BabyJubJub, seed);
        const pubKeyHex = await this._kms.publicKey(keyId);
        const pubKey = js_crypto_1.PublicKey.newFromHex(pubKeyHex);
        const schemaHash = js_iden3_core_custom_1.SchemaHash.authSchemaHash;
        const authClaim = js_iden3_core_custom_1.Claim.newClaim(schemaHash, js_iden3_core_custom_1.ClaimOptions.withIndexDataInts(pubKey.p[0], pubKey.p[1]), js_iden3_core_custom_1.ClaimOptions.withRevocationNonce(BigInt(0)));
        authClaim.setRevocationNonce(BigInt(revNonce));
        return { authClaim, pubKey };
    }
    async createAuthBJJCredential(did, pubKey, authClaim, currentState, revocationOpts) {
        const authData = authClaim.getExpirationDate();
        const expiration = authData ? (0, js_iden3_core_custom_1.getUnixTimestamp)(authData) : 0;
        const request = {
            credentialSchema: verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_SCHEMA_JSON_URL,
            type: verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_TYPE,
            credentialSubject: {
                x: pubKey.p[0].toString(),
                y: pubKey.p[1].toString()
            },
            subjectPosition: (0, common_1.subjectPositionIndex)(authClaim.getIdPosition()),
            version: 0,
            expiration,
            revocationOpts: {
                nonce: Number(authClaim.getRevocationNonce()),
                id: revocationOpts.id.replace(/\/$/, ''),
                type: revocationOpts.type,
                issuerState: currentState.hex()
            }
        };
        // Check if has already an auth credential
        const authCredentials = await this._credentialWallet.getAllAuthBJJCredentials(did);
        let credential = new verifiable_1.W3CCredential();
        if (authCredentials.length === 0) {
            const schema = JSON.parse(verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_SCHEMA_JSON);
            try {
                credential = this._credentialWallet.createCredential(did, request, schema);
            }
            catch (e) {
                throw new Error(`Error create w3c credential ${e.message}`);
            }
        }
        else {
            // credential with sigProof signed with previous auth bjj credential
            credential = await this.issueCredential(did, request);
        }
        return credential;
    }
    /**
     * {@inheritDoc IIdentityWallet.createIdentity}
     */
    async createIdentity(opts) {
        const tmpIdentifier = opts.seed ? uuid.v5(js_crypto_1.Hex.encode((0, js_crypto_1.sha256)(opts.seed)), uuid.NIL) : uuid.v4();
        opts.seed = opts.seed ?? (0, js_crypto_1.getRandomBytes)(32);
        await this._storage.mt.createIdentityMerkleTrees(tmpIdentifier);
        const revNonce = opts.revocationOpts.nonce ?? 0;
        const { authClaim, pubKey } = await this.createAuthCoreClaim(revNonce, opts.seed);
        const { hi, hv } = authClaim.hiHv();
        await this._storage.mt.addToMerkleTree(tmpIdentifier, storage_1.MerkleTreeType.Claims, hi, hv);
        const claimsTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(tmpIdentifier, storage_1.MerkleTreeType.Claims);
        const ctr = await claimsTree.root();
        const currentState = (0, js_merkletree_1.hashElems)([ctr.bigInt(), js_merkletree_1.ZERO_HASH.bigInt(), js_merkletree_1.ZERO_HASH.bigInt()]);
        const didType = (0, js_iden3_core_custom_1.buildDIDType)(opts.method || js_iden3_core_custom_1.DidMethod.Iden3, opts.blockchain || js_iden3_core_custom_1.Blockchain.Polygon, opts.networkId || js_iden3_core_custom_1.NetworkId.Amoy);
        const identifier = js_iden3_core_custom_1.Id.idGenesisFromIdenState(didType, currentState.bigInt());
        const did = js_iden3_core_custom_1.DID.parseFromId(identifier);
        await this._storage.mt.bindMerkleTreeToNewIdentifier(tmpIdentifier, did.string());
        const oldTreeState = {
            revocationRoot: js_merkletree_1.ZERO_HASH,
            claimsRoot: ctr,
            state: currentState,
            rootOfRoots: js_merkletree_1.ZERO_HASH
        };
        const identity = await this._storage.identity.getIdentity(did.string());
        if (!identity) {
            await this._storage.identity.saveIdentity({
                did: did.string(),
                state: currentState,
                isStatePublished: false,
                isStateGenesis: true
            });
        }
        // check whether we have auth credential, if not - create a new one
        const credentials = await this._credentialWallet.findByQuery({
            credentialSubject: {
                x: {
                    $eq: pubKey.p[0].toString()
                },
                y: {
                    $eq: pubKey.p[1].toString()
                }
            },
            allowedIssuers: [did.string()]
        });
        // if credential exists with the same credential status type we return this credential
        if (credentials.length === 1 &&
            credentials[0].credentialStatus.type === opts.revocationOpts.type) {
            return {
                did,
                credential: credentials[0]
            };
        }
        // otherwise something is already wrong with storage as it has more than 1 credential in it or credential status type of existing credential is different from what user provides - We should remove everything and create new credential.
        // in this way credential status of auth credential can be upgraded
        for (let i = 0; i < credentials.length; i++) {
            await this._credentialWallet.remove(credentials[i].id);
        }
        // otherwise  we create a new credential
        const credential = await this.createAuthBJJCredential(did, pubKey, authClaim, currentState, opts.revocationOpts);
        const index = authClaim.hIndex();
        const { proof } = await claimsTree.generateProof(index, ctr);
        const mtpProof = new verifiable_1.Iden3SparseMerkleTreeProof({
            mtp: proof,
            issuerData: {
                id: did,
                state: {
                    rootOfRoots: oldTreeState.rootOfRoots,
                    revocationTreeRoot: oldTreeState.revocationRoot,
                    claimsTreeRoot: ctr,
                    value: currentState
                }
            },
            coreClaim: authClaim
        });
        credential.proof = [mtpProof];
        // only if user specified that genesis state publishing is not needed we won't do this.
        if (!opts.revocationOpts.genesisPublishingDisabled) {
            await this.publishRevocationInfoByCredentialStatusType(did, opts.revocationOpts.type, {
                rhsUrl: opts.revocationOpts.id,
                onChain: opts.revocationOpts.onChain
            });
        }
        await this._credentialWallet.save(credential);
        return {
            did,
            credential
        };
    }
    /**
     * {@inheritDoc IIdentityWallet.createEthereumBasedIdentity}
     */
    async createEthereumBasedIdentity(opts) {
        opts.seed = opts.seed ?? (0, js_crypto_1.getRandomBytes)(32);
        opts.createBjjCredential = opts.createBjjCredential ?? true;
        let credential;
        const ethSigner = opts.ethSigner;
        if (opts.createBjjCredential && !ethSigner) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_SIGNER_IS_REQUIRED);
        }
        const currentState = js_merkletree_1.ZERO_HASH; // In Ethereum identities we don't have an initial state with the auth credential
        const didType = (0, js_iden3_core_custom_1.buildDIDType)(opts.method || js_iden3_core_custom_1.DidMethod.Iden3, opts.blockchain || js_iden3_core_custom_1.Blockchain.Polygon, opts.networkId || js_iden3_core_custom_1.NetworkId.Amoy);
        const keyIdEth = await this._kms.createKeyFromSeed(kms_1.KmsKeyType.Secp256k1, opts.seed);
        const pubKeyHexEth = (await this._kms.publicKey(keyIdEth)).slice(2); // 04 + x + y (uncompressed key)
        const did = (0, utils_1.buildDIDFromEthPubKey)(didType, pubKeyHexEth);
        await this._storage.mt.createIdentityMerkleTrees(did.string());
        await this._storage.identity.saveIdentity({
            did: did.string(),
            state: currentState,
            isStatePublished: false,
            isStateGenesis: true
        });
        if (opts.createBjjCredential && ethSigner) {
            // Old tree state genesis state
            const oldTreeState = {
                revocationRoot: js_merkletree_1.ZERO_HASH,
                claimsRoot: js_merkletree_1.ZERO_HASH,
                state: currentState,
                rootOfRoots: js_merkletree_1.ZERO_HASH
            };
            credential = await this.addBJJAuthCredential(did, oldTreeState, true, ethSigner, opts);
        }
        return {
            did,
            credential
        };
    }
    /** {@inheritDoc IIdentityWallet.getGenesisDIDMetadata} */
    async getGenesisDIDMetadata(did) {
        // check if it is a genesis identity
        const identity = await this._storage.identity.getIdentity(did.string());
        if (identity) {
            return { nonce: 0, genesisDID: js_iden3_core_custom_1.DID.parse(identity.did) };
        }
        const profile = await this._storage.identity.getProfileById(did.string());
        if (!profile) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_PROFILE_OR_IDENTITY_NOT_FOUND);
        }
        return { nonce: profile.nonce, genesisDID: js_iden3_core_custom_1.DID.parse(profile.genesisIdentifier) };
    }
    /** {@inheritDoc IIdentityWallet.createProfile} */
    async createProfile(did, nonce, verifier, tags) {
        const profileDID = (0, common_1.generateProfileDID)(did, nonce);
        const identityProfiles = await this._storage.identity.getProfilesByGenesisIdentifier(did.string());
        const profilesForTagAndVerifier = await this._storage.identity.getProfilesByVerifier(verifier, tags);
        if (profilesForTagAndVerifier.length) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_PROFILE_ALREADY_EXISTS_VERIFIER_TAGS);
        }
        const existingProfileWithNonce = identityProfiles.find((p) => p.nonce == nonce);
        if (existingProfileWithNonce) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_PROFILE_ALREADY_EXISTS);
        }
        await this._storage.identity.saveProfile({
            id: profileDID.string(),
            nonce,
            genesisIdentifier: did.string(),
            verifier,
            tags
        });
        return profileDID;
    }
    /**
     *
     * gets profile identity by genesis identifiers
     *
     * @param {string} genesisIdentifier - genesis identifier from which profile has been derived
     * @returns `{Promise<Profile[]>}`
     */
    async getProfilesByDID(did) {
        return this._storage.identity.getProfilesByGenesisIdentifier(did.string());
    }
    /** {@inheritDoc IIdentityWallet.generateKey} */
    async generateKey(keyType) {
        const key = await this._kms.createKeyFromSeed(keyType, (0, js_crypto_1.getRandomBytes)(32));
        return key;
    }
    /**
     * @deprecated The method should not be used. It returns only one profile per verifier, which can potentially restrict business use cases
     * {@inheritDoc IIdentityWallet.getProfileByVerifier}
     */
    async getProfileByVerifier(verifier) {
        return this._storage.identity.getProfileByVerifier(verifier);
    }
    /** {@inheritDoc IIdentityWallet.getProfilesByVerifier} */
    async getProfilesByVerifier(verifier, tags) {
        return this._storage.identity.getProfilesByVerifier(verifier, tags);
    }
    /** {@inheritDoc IIdentityWallet.getDIDTreeModel} */
    async getDIDTreeModel(did) {
        const didStr = did.string();
        const claimsTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(didStr, storage_1.MerkleTreeType.Claims);
        const revocationTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(didStr, storage_1.MerkleTreeType.Revocations);
        const rootsTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(didStr, storage_1.MerkleTreeType.Roots);
        const state = (0, js_merkletree_1.hashElems)([
            (await claimsTree.root()).bigInt(),
            (await revocationTree.root()).bigInt(),
            (await rootsTree.root()).bigInt()
        ]);
        return {
            state,
            claimsTree,
            revocationTree,
            rootsTree
        };
    }
    /** {@inheritDoc IIdentityWallet.generateClaimMtp} */
    async generateCredentialMtp(did, credential, treeState) {
        const coreClaim = await this.getCoreClaimFromCredential(credential);
        return this.generateCoreClaimMtp(did, coreClaim, treeState);
    }
    /** {@inheritDoc IIdentityWallet.generateClaimMtp} */
    async generateCoreClaimMtp(did, coreClaim, treeState) {
        const treesModel = await this.getDIDTreeModel(did);
        const claimsTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(did.string(), storage_1.MerkleTreeType.Claims);
        const claimsRoot = await treesModel.claimsTree.root();
        const rootOfRoots = await treesModel.rootsTree.root();
        const revocationRoot = await treesModel.revocationTree.root();
        const { proof } = await claimsTree.generateProof(coreClaim.hIndex(), treeState ? treeState.claimsRoot : claimsRoot);
        return {
            proof,
            treeState: treeState ?? {
                state: treesModel.state,
                claimsRoot,
                rootOfRoots,
                revocationRoot
            }
        };
    }
    /** {@inheritDoc IIdentityWallet.generateNonRevocationMtp} */
    async generateNonRevocationMtp(did, credential, treeState) {
        const coreClaim = await this.getCoreClaimFromCredential(credential);
        const revNonce = coreClaim.getRevocationNonce();
        return this.generateNonRevocationMtpWithNonce(did, revNonce, treeState);
    }
    /** {@inheritDoc IIdentityWallet.generateNonRevocationMtpWithNonce} */
    async generateNonRevocationMtpWithNonce(did, revNonce, treeState) {
        const treesModel = await this.getDIDTreeModel(did);
        const revocationTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(did.string(), storage_1.MerkleTreeType.Revocations);
        const claimsRoot = await treesModel.claimsTree.root();
        const rootOfRoots = await treesModel.rootsTree.root();
        const revocationRoot = await treesModel.revocationTree.root();
        const { proof } = await revocationTree.generateProof(revNonce, treeState ? treeState.revocationRoot : revocationRoot);
        return {
            proof,
            treeState: treeState ?? {
                state: treesModel.state,
                claimsRoot,
                rootOfRoots,
                revocationRoot
            }
        };
    }
    /** {@inheritDoc IIdentityWallet.sign} */
    async sign(message, credential) {
        const keyKMSId = (0, credentials_1.getKMSIdByAuthCredential)(credential);
        const payload = js_crypto_1.poseidon.hashBytes(message);
        const signature = await this._kms.sign(keyKMSId, js_iden3_core_custom_1.BytesHelper.intToBytes(payload));
        return js_crypto_1.Signature.newFromCompressed(signature);
    }
    /** {@inheritDoc IIdentityWallet.signChallenge} */
    async signChallenge(challenge, credential) {
        const keyKMSId = (0, credentials_1.getKMSIdByAuthCredential)(credential);
        const signature = await this._kms.sign(keyKMSId, js_iden3_core_custom_1.BytesHelper.intToBytes(challenge));
        return js_crypto_1.Signature.newFromCompressed(signature);
    }
    /** {@inheritDoc IIdentityWallet.issueCredential} */
    async issueCredential(issuerDID, req, opts) {
        req.revocationOpts.id = req.revocationOpts.id.replace(/\/$/, '');
        let schema;
        const loader = opts?.documentLoader ?? (0, schema_processor_1.cacheLoader)(opts);
        try {
            schema = (await loader(req.credentialSchema)).document;
        }
        catch (e) {
            throw new Error(`can't load credential schema ${req.credentialSchema}`);
        }
        const jsonSchema = schema;
        let credential = new verifiable_1.W3CCredential();
        const issuerRoots = await this.getDIDTreeModel(issuerDID);
        req.revocationOpts.issuerState = issuerRoots.state.hex();
        req.revocationOpts.nonce =
            typeof req.revocationOpts.nonce === 'number'
                ? req.revocationOpts.nonce
                : new DataView((0, js_crypto_1.getRandomBytes)(16).buffer).getUint32(0, false);
        req.subjectPosition = req.subjectPosition ?? verifiable_1.SubjectPosition.Index;
        try {
            credential = this._credentialWallet.createCredential(issuerDID, req, jsonSchema);
            const encodedCred = utils_1.byteEncoder.encode(JSON.stringify(credential));
            const encodedSchema = utils_1.byteEncoder.encode(JSON.stringify(schema));
            await new schema_processor_1.JsonSchemaValidator().validate(encodedCred, encodedSchema);
        }
        catch (e) {
            throw new Error(`Error create w3c credential ${e.message}`);
        }
        const { authCredential: issuerAuthBJJCredential } = await this.getActualAuthCredential(issuerDID);
        const coreClaimOpts = {
            revNonce: req.revocationOpts.nonce,
            subjectPosition: req.subjectPosition,
            merklizedRootPosition: req.merklizedRootPosition ?? verifiable_1.MerklizedRootPosition.None,
            updatable: false,
            version: 0,
            merklizeOpts: { ...opts, documentLoader: loader }
        };
        const coreClaim = await credential.toCoreClaim(coreClaimOpts);
        const { hi, hv } = coreClaim.hiHv();
        const coreClaimHash = js_crypto_1.poseidon.hash([hi, hv]);
        const signature = await this.signChallenge(coreClaimHash, issuerAuthBJJCredential);
        if (!issuerAuthBJJCredential.proof) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_ISSUER_AUTH_BJJ_CRED_MUST_HAVE_ANY_PROOF);
        }
        const mtpAuthBJJProof = issuerAuthBJJCredential.getIden3SparseMerkleTreeProof();
        if (!mtpAuthBJJProof) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_ISSUER_AUTH_BJJ_CRED_MUST_HAVE_MTP_PROOF);
        }
        const sigProof = new verifiable_1.BJJSignatureProof2021({
            issuerData: {
                id: issuerDID,
                state: mtpAuthBJJProof.issuerData.state,
                authCoreClaim: mtpAuthBJJProof.coreClaim,
                mtp: mtpAuthBJJProof.mtp,
                credentialStatus: issuerAuthBJJCredential.credentialStatus
            },
            coreClaim,
            signature
        });
        credential.proof = [sigProof];
        return credential;
    }
    /** {@inheritDoc IIdentityWallet.getActualAuthCredential} */
    async getActualAuthCredential(did, treeStateInfo) {
        const authCredentials = await this._credentialWallet.getAllAuthBJJCredentials(did);
        for (let i = 0; i < authCredentials.length; i++) {
            const incProof = await this.generateCredentialMtp(did, authCredentials[i], treeStateInfo);
            if (!incProof.proof.existence) {
                continue;
            }
            const nonRevProof = await this.generateNonRevocationMtp(did, authCredentials[i], treeStateInfo);
            if (!nonRevProof.proof.existence) {
                return {
                    authCredential: authCredentials[i],
                    incProof,
                    nonRevProof
                };
            }
        }
        throw new Error(verifiable_1.VerifiableConstants.ERRORS.NO_AUTH_CRED_FOUND);
    }
    /** {@inheritDoc IIdentityWallet.revokeCredential} */
    async revokeCredential(issuerDID, credential) {
        const issuerTree = await this.getDIDTreeModel(issuerDID);
        const coreClaim = await this.getCoreClaimFromCredential(credential);
        if (!coreClaim) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_CORE_CLAIM_REQUIRED_IN_ANY_PROOF);
        }
        const nonce = coreClaim.getRevocationNonce();
        await issuerTree.revocationTree.add(nonce, BigInt(0));
        return Number(BigInt.asUintN(64, nonce));
    }
    /** {@inheritDoc IIdentityWallet.addCredentialsToMerkleTree} */
    async addCredentialsToMerkleTree(credentials, issuerDID) {
        const oldIssuerTree = await this.getDIDTreeModel(issuerDID);
        let claimsRoot = await oldIssuerTree.claimsTree.root();
        let rootOfRoots = await oldIssuerTree.rootsTree.root();
        let revocationRoot = await oldIssuerTree.revocationTree.root();
        const oldTreeState = {
            state: oldIssuerTree.state,
            claimsRoot,
            revocationRoot,
            rootOfRoots
        };
        for (let index = 0; index < credentials.length; index++) {
            const credential = credentials[index];
            // credential must have a bjj signature proof
            const coreClaim = credential.getCoreClaimFromProof(verifiable_1.ProofType.BJJSignature);
            if (!coreClaim) {
                throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_CORE_CLAIM_REQUIRED_IN_SIG_PROOF);
            }
            await this._storage.mt.addToMerkleTree(issuerDID.string(), storage_1.MerkleTreeType.Claims, coreClaim.hIndex(), coreClaim.hValue());
        }
        const newIssuerTreeState = await this.getDIDTreeModel(issuerDID);
        const claimTreeRoot = await newIssuerTreeState.claimsTree.root();
        await this._storage.mt.addToMerkleTree(issuerDID.string(), storage_1.MerkleTreeType.Roots, claimTreeRoot.bigInt(), BigInt(0));
        const newIssuerTreeStateWithROR = await this.getDIDTreeModel(issuerDID);
        claimsRoot = await newIssuerTreeStateWithROR.claimsTree.root();
        rootOfRoots = await newIssuerTreeStateWithROR.rootsTree.root();
        revocationRoot = await newIssuerTreeStateWithROR.revocationTree.root();
        return {
            credentials,
            newTreeState: {
                state: newIssuerTreeStateWithROR.state,
                claimsRoot,
                rootOfRoots,
                revocationRoot
            },
            oldTreeState: oldTreeState
        };
    }
    /** {@inheritDoc IIdentityWallet.generateIden3SparseMerkleTreeProof} */
    // treeState -  optional, if it is not passed proof of claim inclusion will be generated on the latest state in the tree.
    async generateIden3SparseMerkleTreeProof(issuerDID, credentials, txId, blockNumber, blockTimestamp, treeState, opts) {
        for (let index = 0; index < credentials.length; index++) {
            const credential = credentials[index];
            // TODO: return coreClaim from generateCredentialMtp and use it below
            // credential must have a bjj signature proof
            const coreClaim = credential.getCoreClaimFromProof(verifiable_1.ProofType.BJJSignature) ||
                (await credential.toCoreClaim(opts));
            if (!coreClaim) {
                throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_CORE_CLAIM_REQUIRED_IN_SIG_PROOF);
            }
            const mtpWithProof = await this.generateCoreClaimMtp(issuerDID, coreClaim, treeState);
            const mtpProof = new verifiable_1.Iden3SparseMerkleTreeProof({
                mtp: mtpWithProof.proof,
                issuerData: {
                    id: issuerDID,
                    state: {
                        claimsTreeRoot: mtpWithProof.treeState.claimsRoot,
                        revocationTreeRoot: mtpWithProof.treeState.revocationRoot,
                        rootOfRoots: mtpWithProof.treeState.rootOfRoots,
                        value: mtpWithProof.treeState.state,
                        txId,
                        blockNumber,
                        blockTimestamp
                    }
                },
                coreClaim
            });
            if (Array.isArray(credentials[index].proof)) {
                credentials[index].proof.push(mtpProof);
            }
            else {
                credentials[index].proof = credentials[index].proof
                    ? [credentials[index].proof, mtpProof]
                    : [mtpProof];
            }
        }
        return credentials;
    }
    /** {@inheritDoc IIdentityWallet.publishSpecificStateToRHS} */
    async publishSpecificStateToRHS(treeModel, rhsURL, revokedNonces) {
        await (0, credentials_1.pushHashesToRHS)(treeModel.state, treeModel, rhsURL, revokedNonces);
    }
    /** {@inheritDoc IIdentityWallet.publishStateToRHS} */
    async publishStateToRHS(issuerDID, rhsURL, revokedNonces) {
        const treeState = await this.getDIDTreeModel(issuerDID);
        await (0, credentials_1.pushHashesToRHS)(treeState.state, {
            revocationTree: treeState.revocationTree,
            claimsTree: treeState.claimsTree,
            state: treeState.state,
            rootsTree: treeState.rootsTree
        }, rhsURL, revokedNonces);
    }
    /** {@inheritDoc IIdentityWallet.publishRevocationInfoByCredentialStatusType} */
    async publishRevocationInfoByCredentialStatusType(issuerDID, credentialStatusType, opts) {
        const rhsPublishers = this._credentialStatusPublisherRegistry.get(credentialStatusType);
        if (!rhsPublishers) {
            throw new Error(`there is no registered publisher to save  hash is not registered for ${credentialStatusType} is not registered`);
        }
        let nodes = [];
        const tree = opts?.treeModel ?? (await this.getDIDTreeModel(issuerDID));
        nodes = await (0, credentials_1.getNodesRepresentation)(opts?.revokedNonces ?? [], {
            revocationTree: tree.revocationTree,
            claimsTree: tree.claimsTree,
            state: tree.state,
            rootsTree: tree.rootsTree
        }, tree.state);
        if (!nodes.length) {
            return;
        }
        const rhsPublishersTask = rhsPublishers.map((publisher) => publisher.publish({ nodes, ...opts, credentialStatusType, issuerDID }));
        await Promise.all(rhsPublishersTask);
    }
    async getCoreClaimFromCredential(credential) {
        const coreClaimFromSigProof = credential.getCoreClaimFromProof(verifiable_1.ProofType.BJJSignature);
        const coreClaimFromMtpProof = credential.getCoreClaimFromProof(verifiable_1.ProofType.Iden3SparseMerkleTreeProof);
        if (coreClaimFromMtpProof &&
            coreClaimFromSigProof &&
            coreClaimFromMtpProof.hex() !== coreClaimFromSigProof.hex()) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_CORE_CLAIM_MISMATCH);
        }
        if (!coreClaimFromMtpProof && !coreClaimFromSigProof) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_CORE_CLAIM_IS_NOT_SET);
        }
        //eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
        const coreClaim = coreClaimFromMtpProof ?? coreClaimFromSigProof;
        return coreClaim;
    }
    async findOwnedCredentialsByDID(did, query) {
        const credentials = await this._credentialWallet.findByQuery(query);
        if (!credentials.length) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_NO_CREDENTIAL_SATISFIED_QUERY);
        }
        const { genesisDID } = await this.getGenesisDIDMetadata(did);
        const profiles = await this.getProfilesByDID(genesisDID);
        return credentials.filter((cred) => {
            const credentialSubjectId = cred.credentialSubject['id']; // credential subject
            return (credentialSubjectId == genesisDID.string() ||
                profiles.some((p) => {
                    return p.id === credentialSubjectId;
                }));
        });
    }
    /** {@inheritDoc IIdentityWallet.updateIdentityState} */
    async updateIdentityState(issuerDID, published, treeState) {
        const latestTreeState = await this.getDIDTreeModel(issuerDID);
        await this._storage.identity.saveIdentity({
            did: issuerDID.string(),
            state: treeState?.state ?? latestTreeState.state,
            isStatePublished: published,
            isStateGenesis: false
        });
    }
    /** {@inheritdoc IIdentityWallet.transitState} */
    async transitState(did, oldTreeState, isOldStateGenesis, ethSigner, prover) {
        const newTreeModel = await this.getDIDTreeModel(did);
        const claimsRoot = await newTreeModel.claimsTree.root();
        const rootOfRoots = await newTreeModel.rootsTree.root();
        const revocationRoot = await newTreeModel.revocationTree.root();
        const newTreeState = {
            revocationRoot,
            claimsRoot,
            state: newTreeModel.state,
            rootOfRoots
        };
        const userId = js_iden3_core_custom_1.DID.idFromDID(did);
        let proof;
        const isEthIdentity = (0, utils_1.isEthereumIdentity)(did); // don't generate proof for ethereum identities
        let txId;
        if (!isEthIdentity) {
            if (!prover) {
                throw new Error(verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_PROVER_IS_REQUIRED);
            }
            // generate the proof
            const authInfo = await this._inputsGenerator.prepareAuthBJJCredential(did, oldTreeState);
            const challenge = js_crypto_1.Poseidon.hash([oldTreeState.state.bigInt(), newTreeState.state.bigInt()]);
            const signature = await this.signChallenge(challenge, authInfo.credential);
            const circuitInputs = new circuits_1.StateTransitionInputs();
            circuitInputs.id = userId;
            circuitInputs.signature = signature;
            circuitInputs.isOldStateGenesis = isOldStateGenesis;
            const authClaimIncProofNewState = await this.generateCredentialMtp(did, authInfo.credential, newTreeState);
            circuitInputs.newTreeState = authClaimIncProofNewState.treeState;
            circuitInputs.authClaimNewStateIncProof = authClaimIncProofNewState.proof;
            circuitInputs.oldTreeState = oldTreeState;
            circuitInputs.authClaim = {
                claim: authInfo.coreClaim,
                incProof: authInfo.incProof,
                nonRevProof: authInfo.nonRevProof
            };
            const inputs = circuitInputs.inputsMarshal();
            proof = await prover.generate(inputs, circuits_1.CircuitId.StateTransition);
            txId = await this._storage.states.publishState(proof, ethSigner);
        }
        else {
            const oldUserState = oldTreeState.state;
            const newUserState = newTreeState.state;
            const userStateTransitionInfo = {
                userId,
                oldUserState,
                newUserState,
                isOldStateGenesis,
                methodId: BigInt(1),
                methodParams: '0x'
            };
            txId = await this._storage.states.publishStateGeneric(ethSigner, userStateTransitionInfo);
        }
        await this.updateIdentityState(did, true, newTreeState);
        return txId;
    }
    async getAuthBJJCredential(did, oldTreeState, { nonce, seed, id, type }) {
        const { authClaim, pubKey } = await this.createAuthCoreClaim(nonce, seed);
        const { hi, hv } = authClaim.hiHv();
        await this._storage.mt.addToMerkleTree(did.string(), storage_1.MerkleTreeType.Claims, hi, hv);
        // Calculate current state after adding credential to merkle tree
        const claimsTree = await this._storage.mt.getMerkleTreeByIdentifierAndType(did.string(), storage_1.MerkleTreeType.Claims);
        const currentState = (0, js_merkletree_1.hashElems)([
            (await claimsTree.root()).bigInt(),
            oldTreeState.revocationRoot.bigInt(),
            oldTreeState.rootOfRoots.bigInt()
        ]);
        return this.createAuthBJJCredential(did, pubKey, authClaim, currentState, {
            id,
            type
        });
    }
    /** {@inheritdoc IIdentityWallet.addBJJAuthCredential} */
    async addBJJAuthCredential(did, oldTreeState, isOldStateGenesis, ethSigner, opts, prover // it will be needed in case of non ethereum identities
    ) {
        opts.seed = opts.seed ?? (0, js_crypto_1.getRandomBytes)(32);
        opts.revocationOpts.nonce =
            opts.revocationOpts.nonce ??
                (isOldStateGenesis
                    ? 0
                    : opts.revocationOpts.nonce ?? new DataView((0, js_crypto_1.getRandomBytes)(12).buffer).getUint32(0));
        const credential = await this.getAuthBJJCredential(did, oldTreeState, {
            nonce: opts.revocationOpts.nonce,
            seed: opts.seed,
            id: opts.revocationOpts.id,
            type: opts.revocationOpts.type
        });
        const addMtpToCredAndPublishRevState = async () => {
            const { receipt, block } = await this._transactionService.getTransactionReceiptAndBlock(txId);
            const credsWithIden3MTPProof = await this.generateIden3SparseMerkleTreeProof(did, [credential], txId, receipt?.blockNumber, block?.timestamp, undefined, {
                revNonce: opts.revocationOpts.nonce ?? 0,
                subjectPosition: verifiable_1.SubjectPosition.None,
                merklizedRootPosition: verifiable_1.MerklizedRootPosition.None,
                updatable: false,
                version: 0,
                merklizeOpts: { documentLoader: (0, schema_processor_1.cacheLoader)() }
            });
            await this._credentialWallet.saveAll(credsWithIden3MTPProof);
            await this.publishRevocationInfoByCredentialStatusType(did, opts.revocationOpts.type, {
                rhsUrl: opts.revocationOpts.id,
                onChain: opts.revocationOpts.onChain
            });
            return credsWithIden3MTPProof[0];
        };
        let txId = '';
        let attempt = 2;
        do {
            try {
                txId = await this.transitState(did, oldTreeState, isOldStateGenesis, ethSigner, prover);
                break;
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.warn(`Error while transiting state, retrying state transition, attempt: ${attempt}`, err);
            }
        } while (--attempt);
        if (!txId) {
            const oldTransitStateInfoJson = JSON.stringify({
                claimsRoot: oldTreeState.claimsRoot.hex(),
                revocationRoot: oldTreeState.revocationRoot.hex(),
                rootOfRoots: oldTreeState.rootOfRoots.hex(),
                state: oldTreeState.state.hex(),
                isOldStateGenesis,
                credentialId: credential.id,
                did: did.string()
            }, null, 2);
            await this._credentialWallet.save(credential);
            throw new Error(`Error publishing state, info to publish: ${oldTransitStateInfoJson}`);
        }
        return addMtpToCredAndPublishRevState();
    }
}
exports.IdentityWallet = IdentityWallet;
