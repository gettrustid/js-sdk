import { DID } from 'js-iden3-core-custom';
import { W3CCredential, VerifiableConstants, CredentialStatusType, DisplayMethodType } from './../verifiable';
import * as uuid from 'uuid';
import { CredentialStatusResolverRegistry } from './status/resolver';
import { IssuerResolver } from './status/sparse-merkle-tree';
import { AgentResolver } from './status/agent-revocation';
import { getUserDIDFromCredential } from './utils';
/**
 *
 * Wallet instance is a wrapper of CRUD logic for W3C credentials,
 * also it allows to fetch revocation statuses.
 *
 * @public
 * @class CredentialWallet
 * @implements implements ICredentialWallet interface
 */
export class CredentialWallet {
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
            if (r.displayMethod?.type === DisplayMethodType.Iden3BasicDisplayMethodV1 &&
                !r.context.includes(VerifiableConstants.JSONLD_SCHEMA.IDEN3_DISPLAY_METHOD)) {
                r.context.push(VerifiableConstants.JSONLD_SCHEMA.IDEN3_DISPLAY_METHOD);
            }
            r.context.push(schema.$metadata.uris['jsonLdContext']);
            r.expiration = r.expiration ? r.expiration * 1000 : undefined;
            r.id = r.id ? r.id : `urn:${uuid.v4()}`;
            r.issuanceDate = r.issuanceDate ? r.issuanceDate * 1000 : Date.now();
            return W3CCredential.fromCredentialRequest(issuer, r);
        };
        // if no credential status resolvers are provided
        // register default issuer resolver
        if (!this._credentialStatusResolverRegistry) {
            this._credentialStatusResolverRegistry = new CredentialStatusResolverRegistry();
            this._credentialStatusResolverRegistry.register(CredentialStatusType.SparseMerkleTreeProof, new IssuerResolver());
            this._credentialStatusResolverRegistry.register(CredentialStatusType.Iden3commRevocationStatusV1, new AgentResolver());
        }
    }
    /**
     * {@inheritDoc ICredentialWallet.getAuthBJJCredential}
     */
    async getAuthBJJCredential(did) {
        // filter where the issuer of auth credential is given did
        const authBJJCredsOfIssuer = await this._storage.credential.findCredentialsByQuery({
            context: VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_SCHEMA_JSONLD_URL,
            type: VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_TYPE,
            allowedIssuers: [did.string()]
        });
        if (!authBJJCredsOfIssuer.length) {
            throw new Error(VerifiableConstants.ERRORS.NO_AUTH_CRED_FOUND);
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
            context: VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_SCHEMA_JSONLD_URL,
            type: VerifiableConstants.AUTH.AUTH_BJJ_CREDENTIAL_TYPE,
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
        const issuerDID = DID.parse(cred.issuer);
        const userDID = getUserDIDFromCredential(issuerDID, cred);
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
        throw new Error(VerifiableConstants.ERRORS.CREDENTIAL_WALLET_ALL_CREDENTIALS_ARE_REVOKED);
    }
}
