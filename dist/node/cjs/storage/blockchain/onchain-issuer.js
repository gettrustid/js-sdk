"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnchainIssuer = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const ethers_1 = require("ethers");
const onchain_non_merklized_issuer_base_abi_1 = require("@iden3/onchain-non-merklized-issuer-base-abi");
const onchain_non_merklized_issuer_adapter_1 = require("./onchain-issuer-adapter/non-merklized/version/v0.0.1/onchain-non-merklized-issuer-adapter");
/**
 * Represents an adapter for interacting with on-chain issuers.
 *
 * @public
 * @beta
 * @class OnchainIssuer
 */
class OnchainIssuer {
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
                const adapter = new onchain_non_merklized_issuer_adapter_1.OnchainNonMerklizedIssuerAdapter(connection, issuerDID, {
                    merklizationOptions: this._onchainIssuerOptions?.merklizationOptions
                });
                await adapter.isInterfaceSupported();
                const { credentialData, coreClaimBigInts, credentialSubjectFields } = await adapter.getCredential(js_iden3_core_custom_1.DID.idFromDID(userDID), credentialId);
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
                const adapter = new onchain_non_merklized_issuer_adapter_1.OnchainNonMerklizedIssuerAdapter(connection, issuerDID, {
                    merklizationOptions: this._onchainIssuerOptions?.merklizationOptions
                });
                await adapter.isInterfaceSupported();
                return await adapter.getUserCredentialsIds(js_iden3_core_custom_1.DID.idFromDID(userDID));
            }
            default:
                throw new Error(`Unsupported adapter version ${response}`);
        }
    }
    getContractConnection(did) {
        const issuerId = js_iden3_core_custom_1.DID.idFromDID(did);
        const chainId = (0, js_iden3_core_custom_1.chainIDfromDID)(did);
        const contractAddress = ethers_1.ethers.getAddress(ethers_1.ethers.hexlify(js_iden3_core_custom_1.Id.ethAddressFromId(issuerId)));
        const connection = this._ethConnectionConfig.find((c) => c.chainId === chainId);
        if (!connection) {
            throw new Error(`No connection found for chain ID ${chainId}`);
        }
        if (!connection.url) {
            throw new Error(`No URL found for chain ID ${chainId}`);
        }
        const contract = new ethers_1.Contract(contractAddress, onchain_non_merklized_issuer_base_abi_1.INonMerklizedIssuerABI, new ethers_1.ethers.JsonRpcProvider(connection.url));
        return { contract, connection };
    }
}
exports.OnchainIssuer = OnchainIssuer;
