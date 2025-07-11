import { DID, Id, chainIDfromDID } from 'js-iden3-core-custom';
import { Contract, ethers } from 'ethers';
import { INonMerklizedIssuerABI as abi } from '@iden3/onchain-non-merklized-issuer-base-abi';
import { OnchainNonMerklizedIssuerAdapter } from './onchain-issuer-adapter/non-merklized/version/v0.0.1/onchain-non-merklized-issuer-adapter';
/**
 * Represents an adapter for interacting with on-chain issuers.
 *
 * @public
 * @beta
 * @class OnchainIssuer
 */
export class OnchainIssuer {
    /**
     * Initializes an instance of `Adapter`.
     * @param config The configuration for the Ethereum connection.
     * @param merklizationOptions Optional settings for merklization.
     */
    constructor(config, options) {
        this._ethConnectionConfig = config;
        this._onchainIssuerOptions = options;
    }
    /**
     * Retrieves a credential from the on-chain issuer.
     * @param issuerDID The issuer's core.DID.
     * @param userId The user's core.Id.
     * @param credentialId The unique identifier of the credential.
     */
    async getCredential(issuerDID, userDID, credentialId) {
        const { contract, connection } = this.getContractConnection(issuerDID);
        const response = await contract.getCredentialAdapterVersion();
        switch (response) {
            case '0.0.1': {
                const adapter = new OnchainNonMerklizedIssuerAdapter(connection, issuerDID, {
                    merklizationOptions: this._onchainIssuerOptions?.merklizationOptions
                });
                await adapter.isInterfaceSupported();
                const { credentialData, coreClaimBigInts, credentialSubjectFields } = await adapter.getCredential(DID.idFromDID(userDID), credentialId);
                return await adapter.convertOnChainInfoToW3CCredential(credentialData, coreClaimBigInts, credentialSubjectFields);
            }
            default:
                throw new Error(`Unsupported adapter version ${response}`);
        }
    }
    /**
     * Retrieves the credential identifiers for a user from the on-chain issuer.
     * @param issuerDID The issuer's core.DID.
     * @param userId The user's core.Id.
     */
    async getUserCredentialIds(issuerDID, userDID) {
        const { contract, connection } = this.getContractConnection(issuerDID);
        const response = await contract.getCredentialAdapterVersion();
        switch (response) {
            case '0.0.1': {
                const adapter = new OnchainNonMerklizedIssuerAdapter(connection, issuerDID, {
                    merklizationOptions: this._onchainIssuerOptions?.merklizationOptions
                });
                await adapter.isInterfaceSupported();
                return await adapter.getUserCredentialsIds(DID.idFromDID(userDID));
            }
            default:
                throw new Error(`Unsupported adapter version ${response}`);
        }
    }
    getContractConnection(did) {
        const issuerId = DID.idFromDID(did);
        const chainId = chainIDfromDID(did);
        const contractAddress = ethers.getAddress(ethers.hexlify(Id.ethAddressFromId(issuerId)));
        const connection = this._ethConnectionConfig.find((c) => c.chainId === chainId);
        if (!connection) {
            throw new Error(`No connection found for chain ID ${chainId}`);
        }
        if (!connection.url) {
            throw new Error(`No URL found for chain ID ${chainId}`);
        }
        const contract = new Contract(contractAddress, abi, new ethers.JsonRpcProvider(connection.url));
        return { contract, connection };
    }
}
