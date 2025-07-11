/**
 * Implementation of the IIdentityStorage with KV data source
 *
 * @public
 * @class IdentityStorage
 * @implements implements IIdentityStorage interface
 */
export class IdentityStorage {
    /**
     * Creates an instance of IdentityStorage.
     * @param {IDataSource<Identity>} _identityDataSource - data source for identities
     * @param {IDataSource<Profile>} _profileDataSource - data source for profiles
     */
    constructor(_identityDataSource, _profileDataSource) {
        this._identityDataSource = _identityDataSource;
        this._profileDataSource = _profileDataSource;
    }
    async saveProfile(profile) {
        const profiles = await this._profileDataSource.load();
        const identityProfiles = profiles.filter((p) => p.genesisIdentifier === profile.genesisIdentifier);
        const toSave = identityProfiles.length ? [...identityProfiles, profile] : [profile];
        for (let index = 0; index < toSave.length; index++) {
            const element = toSave[index];
            await this._profileDataSource.save(element.id, element);
        }
    }
    /**
     *  @deprecated The method should not be used. It returns only one profile per verifier, which can potentially restrict business use cases
     *   Use getProfilesByVerifier instead.
     */
    async getProfileByVerifier(verifier) {
        return this._profileDataSource.get(verifier, 'verifier');
    }
    async getProfilesByVerifier(verifier, tags) {
        return (await this._profileDataSource.load()).filter((p) => p.verifier === verifier && (!tags || tags.every((tag) => p.tags?.includes(tag))));
    }
    async getProfileById(profileId) {
        return this._profileDataSource.get(profileId);
    }
    async getProfilesByGenesisIdentifier(genesisIdentifier) {
        return (await this._profileDataSource.load()).filter((p) => p.genesisIdentifier === genesisIdentifier);
    }
    async getAllIdentities() {
        return this._identityDataSource.load();
    }
    async saveIdentity(identity) {
        return this._identityDataSource.save(identity.did, identity, 'did');
    }
    async getIdentity(identifier) {
        return this._identityDataSource.get(identifier, 'did');
    }
}
/**
 * storage key for identities
 *
 * @static
 */
IdentityStorage.identitiesStorageKey = 'identities';
/**
 * storage key for profiles
 *
 * @static
 */
IdentityStorage.profilesStorageKey = 'profiles';
