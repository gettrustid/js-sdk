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
exports.CredentialWallet = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const verifiable_1 = require("./../verifiable");
const uuid = __importStar(require("uuid"));
const resolver_1 = require("./status/resolver");
const sparse_merkle_tree_1 = require("./status/sparse-merkle-tree");
const agent_revocation_1 = require("./status/agent-revocation");
const utils_1 = require("./utils");
/**
 *
 * Wallet instance is a wrapper of CRUD logic for W3C credentials,
 * also it allows to fetch revocation statuses.
 *
 * @public
 * @class CredentialWallet
 * @implements implements ICredentialWallet interface
 */
class CredentialWallet {
    /**
     * Creates an instance of CredentialWallet.
     * @param {IDataStorage} _storage - data storage to access credential / identity / Merkle tree data
     * @param {CredentialStatusResolverRegistry} _credentialStatusResolverRegistry - list of credential status resolvers
     * if _credentialStatusResolverRegistry is not provided, default resolvers will be used
     */
    constructor(_storage, _credentialStatusResolverRegistry) {
        this._storage = _storage;
        this._credentialStatusResolverRegistry = _credentialStatusResolverRegistry;
        /**
         * {@inheritDoc ICredentialWallet.createCredential}
         */
        this.createCredential = (issuer, request, schema) => {
            if (!schema.$metadata.uris['jsonLdContext']) {
                throw new Error('jsonLdContext is missing is the schema');
            }
            // do copy of request to avoid mutation
            const r = { ...request };
            r.context = r.context ?? [];
            if (r.displayMethod?.type === verifiable_1.DisplayMethodType.Iden3BasicDisplayMethodV1 &&
                !r.context.includes(verifiable_1.VerifiableConstants.JSONLD_SCHEMA.IDEN3_DISPLAY_METHOD)) {
                r.context.push(verifiable_1.VerifiableConstants.JSONLD_SCHEMA.IDEN3_DISPLAY_METHOD);
            }
            r.context.push(schema.$metadata.uris['jsonLdContext']);
            r.expiration = r.expiration ? r.expiration * 1000 : undefined;
            r.id = r.id ? r.id : `urn:${uuid.v4()}`;
            r.issuanceDate = r.issuanceDate ? r.issuanceDate * 1000 : Date.now();
            return verifiable_1.W3CCredential.fromCredentialRequest(issuer, r);
        };
        // if no credential status resolvers are provided
        // register default issuer resolver
        if (!this._credentialStatusResolverRegistry) {
            this._credentialStatusResolverRegistry = new resolver_1.CredentialStatusResolverRegistry();
            this._credentialStatusResolverRegistry.register(verifiable_1.CredentialStatusType.SparseMerkleTreeProof, new sparse_merkle_tree_1.IssuerResolver());
            this._credentialStatusResolverRegistry.register(verifiable_1.CredentialStatusType.Iden3commRevocationStatusV1, new agent_revocation_1.AgentResolver());
        }
    }
    /**
     * {@inheritDoc ICredentialWallet.getAuthBJJCredential}
     */
    async getAuthBJJCredential(did) {
        // filter where the issuer of auth credential is given did
        const authBJJCredsOfIssuer = await this._storage.credential.findCredentialsByQuery({
            context: verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_SCHEMA_JSONLD_URL,
            type: verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_TYPE,
            allowedIssuers: [did.string()]
        });
        if (!authBJJCredsOfIssuer.length) {
            throw new Error(verifiable_1.VerifiableConstants.ERRORS.NO_AUTH_CRED_FOUND);
        }
        for (let index = 0; index < authBJJCredsOfIssuer.length; index++) {
            const authCred = authBJJCredsOfIssuer[index];
            const revocationStatus = await this.getRevocationStatusFromCredential(authCred);
            if (!revocationStatus.mtp.existence) {
                return authCred;
            }
        }
        throw new Error('all auth bjj credentials are revoked');
    }
    /**
     * {@inheritDoc ICredentialWallet.getAllAuthBJJCredentials}
     */
    async getAllAuthBJJCredentials(did) {
        return this._storage.credential.findCredentialsByQuery({
            context: verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_SCHEMA_JSONLD_URL,
            type: verifiable_1.VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_TYPE,
            allowedIssuers: [did.string()]
        });
    }
    /**
     * {@inheritDoc ICredentialWallet.getRevocationStatusFromCredential}
     */
    async getRevocationStatusFromCredential(cred) {
        const mtpProof = cred.getIden3SparseMerkleTreeProof();
        const sigProof = cred.getBJJSignature2021Proof();
        const stateInfo = mtpProof
            ? mtpProof.issuerData.state
            : sigProof?.issuerData.state;
        const issuerDID = js_iden3_core_custom_1.DID.parse(cred.issuer);
        const userDID = (0, utils_1.getUserDIDFromCredential)(issuerDID, cred);
        const opts = {
            issuerGenesisState: stateInfo,
            issuerDID,
            userDID
        };
        return this.getRevocationStatus(cred.credentialStatus, opts);
    }
    /**
     * {@inheritDoc ICredentialWallet.getRevocationStatus}
     */
    async getRevocationStatus(credStatus, credentialStatusResolveOptions) {
        const statusResolver = this._credentialStatusResolverRegistry?.get(credStatus.type);
        if (!statusResolver) {
            throw new Error(`credential status resolver does not exist for ${credStatus.type} type`);
        }
        return statusResolver.resolve(credStatus, credentialStatusResolveOptions);
    }
    /**
     * {@inheritDoc ICredentialWallet.findById}
     */
    async findById(id) {
        return this._storage.credential.findCredentialById(id);
    }
    /**
     * {@inheritDoc ICredentialWallet.findByContextType}
     */
    async findByContextType(context, type) {
        return this._storage.credential.findCredentialsByQuery({ context, type });
    }
    /**
     * {@inheritDoc ICredentialWallet.save}
     */
    async save(credential) {
        return this._storage.credential.saveCredential(credential);
    }
    /**
     * {@inheritDoc ICredentialWallet.saveAll}
     */
    async saveAll(credentials) {
        return this._storage.credential.saveAllCredentials(credentials);
    }
    /**
     * {@inheritDoc ICredentialWallet.remove}
     */
    async remove(id) {
        return this._storage.credential.removeCredential(id);
    }
    /**
     * {@inheritDoc ICredentialWallet.list}
     */
    async list() {
        return this._storage.credential.listCredentials();
    }
    /**
     * {@inheritDoc ICredentialWallet.findByQuery}
     */
    async findByQuery(query) {
        return this._storage.credential.findCredentialsByQuery(query);
    }
    /**
     * {@inheritDoc ICredentialWallet.filterByCredentialSubject}
     */
    async filterByCredentialSubject(credentials, subject) {
        return credentials.filter((cred) => {
            return cred.credentialSubject['id'] === subject.string();
        });
    }
    async findNonRevokedCredential(creds) {
        for (const cred of creds) {
            const revStatus = await this.getRevocationStatusFromCredential(cred);
            if (revStatus.mtp.existence) {
                continue;
            }
            return { cred, revStatus };
        }
        throw new Error(verifiable_1.VerifiableConstants.ERRORS.CREDENTIAL_WALLET_ALL_CREDENTIALS_ARE_REVOKED);
    }
}
exports.CredentialWallet = CredentialWallet;
