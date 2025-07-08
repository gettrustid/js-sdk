"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnChainResolver = void 0;
const onchain_revocation_1 = require("../../storage/blockchain/onchain-revocation");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const constants_1 = require("../../verifiable/constants");
const utils_1 = require("../../utils");
const state_1 = require("../../storage/blockchain/state");
const js_merkletree_1 = require("@iden3/js-merkletree");
/**
 * OnChainIssuer is a class that allows to interact with the onchain contract
 * and build the revocation status.
 *
 * @public
 * @class OnChainIssuer
 */
class OnChainResolver {
    /**
     *
     * Creates an instance of OnChainIssuer.
     * @public
     * @param {Array<EthConnectionConfig>} _configs - list of ethereum network connections
     */
    constructor(_configs, _opts) {
        this._configs = _configs;
        this._stateStorage = new state_1.EthStateStorage(_configs, _opts?.stateStorageOptions);
    }
    /**
     * resolve is a method to resolve a credential status from the blockchain.
     *
     * @public
     * @param {CredentialStatus} credentialStatus -  credential status to resolve
     * @param {CredentialStatusResolveOptions} credentialStatusResolveOptions -  options for resolver
     * @returns `{Promise<RevocationStatus>}`
     */
    async resolve(credentialStatus, credentialStatusResolveOptions) {
        if (!credentialStatusResolveOptions?.issuerDID) {
            throw new Error('IssuerDID is not set in options');
        }
        return this.getRevocationOnChain(credentialStatus, credentialStatusResolveOptions.issuerDID);
    }
    /**
     * Gets partial revocation status info from onchain issuer contract.
     *
     * @param {CredentialStatus} credentialStatus - credential status section of credential
     * @param {DID} issuerDid - issuer did
     * @returns `{Promise<RevocationStatus>}`
     */
    async getRevocationOnChain(credentialStatus, issuer) {
        const { contractAddress, chainId, revocationNonce, stateHex } = this.extractCredentialStatusInfo(credentialStatus);
        if (revocationNonce !== credentialStatus.revocationNonce) {
            throw new Error('revocationNonce does not match');
        }
        const issuerId = js_iden3_core_custom_1.DID.idFromDID(issuer);
        let latestIssuerState;
        try {
            const latestStateInfo = await this._stateStorage.getLatestStateById(issuerId.bigInt());
            if (!latestStateInfo.state) {
                throw new Error('state contract returned empty state');
            }
            latestIssuerState = latestStateInfo.state;
        }
        catch (e) {
            const errMsg = e?.reason ?? e.message ?? e;
            if (!errMsg.includes(constants_1.VerifiableConstants.ERRORS.IDENTITY_DOES_NOT_EXIST)) {
                throw e;
            }
            if (!stateHex) {
                throw new Error('latest state not found and state parameter is not present in credentialStatus.id');
            }
            const stateBigInt = js_merkletree_1.Hash.fromHex(stateHex).bigInt();
            if (!(0, utils_1.isGenesisState)(issuer, stateBigInt)) {
                throw new Error(`latest state not found and state parameter ${stateHex} is not genesis state`);
            }
            latestIssuerState = stateBigInt;
        }
        const id = js_iden3_core_custom_1.DID.idFromDID(issuer);
        const onChainCaller = this._getOnChainRevocationStorageForIssuer(chainId, contractAddress);
        const revocationStatus = await onChainCaller.getRevocationStatusByIdAndState(id.bigInt(), latestIssuerState, revocationNonce);
        return revocationStatus;
    }
    /**
     * Extract information about credential status
     *
     * @param {credentialStatus} CredentialStatus - credential status
     * @returns {{contractAddress: string, chainId: number, revocationNonce: number, issuer: string;}}
     */
    extractCredentialStatusInfo(credentialStatus) {
        if (!credentialStatus.id) {
            throw new Error('credentialStatus id is empty');
        }
        const idParts = credentialStatus.id.split('/');
        if (idParts.length !== 2) {
            throw new Error('invalid credentialStatus id');
        }
        const idURL = new URL(credentialStatus.id);
        const stateHex = idURL.searchParams.get('state') || '';
        const contractIdentifier = idURL.searchParams.get('contractAddress');
        if (!contractIdentifier) {
            throw new Error('contractAddress not found in credentialStatus.id field');
        }
        const parts = contractIdentifier.split(':');
        if (parts.length != 2) {
            throw new Error('invalid contract address encoding. should be chainId:contractAddress');
        }
        const chainId = parseInt(parts[0], 10);
        const contractAddress = parts[1];
        // if revocationNonce is not present in id as param, then it should be extract from credentialStatus
        const rv = idURL.searchParams.get('revocationNonce') || credentialStatus.revocationNonce;
        if (rv === undefined || rv === null) {
            throw new Error('revocationNonce not found in credentialStatus id field');
        }
        const revocationNonce = typeof rv === 'number' ? rv : parseInt(rv, 10);
        return { contractAddress, chainId, revocationNonce, stateHex };
    }
    networkByChainId(chainId) {
        const network = this._configs.find((c) => c.chainId === chainId);
        if (!network) {
            throw new Error(`chainId "${chainId}" not supported`);
        }
        return network;
    }
    _getOnChainRevocationStorageForIssuer(chainId, contractAddress) {
        const networkConfig = this.networkByChainId(chainId);
        const onChainCaller = new onchain_revocation_1.OnChainRevocationStorage(networkConfig, contractAddress);
        return onChainCaller;
    }
}
exports.OnChainResolver = OnChainResolver;
