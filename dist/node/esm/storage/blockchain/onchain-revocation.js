import { Contract, JsonRpcProvider } from 'ethers';
import { Proof, Hash } from '@iden3/js-merkletree';
import abi from '../blockchain/abi/CredentialStatusResolver.json';
import { TransactionService } from '../../blockchain';
/**
 * OnChainRevocationStore is a class that allows to interact with the onchain contract
 * and build the revocation status.
 *
 * @public
 * @class OnChainIssuer
 */
export class OnChainRevocationStorage {
    /**
     *
     * Creates an instance of OnChainIssuer.
     * @public
     * @param {string} - onchain contract address
     * @param {string} - rpc url to connect to the blockchain
     */
    constructor(_config, contractAddress, _signer) {
        this._config = _config;
        this._signer = _signer;
        this._provider = new JsonRpcProvider(_config.url);
        let contract = new Contract(contractAddress, abi, this._provider);
        if (this._signer) {
            this._signer = this._signer.connect(this._provider);
            contract = contract.connect(this._signer);
        }
        this._contract = contract;
        this._transactionService = new TransactionService(this._provider);
    }
    /**
     * Get revocation status by issuerId, issuerState and nonce from the onchain.
     * @public
     * @returns Promise<RevocationStatus>
     */
    async getRevocationStatusByIdAndState(issuerID, state, nonce) {
        const response = await this._contract.getRevocationStatusByIdAndState(issuerID, state, nonce);
        const issuer = OnChainRevocationStorage.convertIssuerInfo(response.issuer);
        const mtp = OnChainRevocationStorage.convertSmtProofToProof(response.mtp);
        return {
            issuer,
            mtp
        };
    }
    /**
     * Get revocation status by nonce from the onchain contract.
     * @public
     * @returns Promise<RevocationStatus>
     */
    async getRevocationStatus(issuerID, nonce) {
        const response = await this._contract.getRevocationStatus(issuerID, nonce);
        const issuer = OnChainRevocationStorage.convertIssuerInfo(response.issuer);
        const mtp = OnChainRevocationStorage.convertSmtProofToProof(response.mtp);
        return {
            issuer,
            mtp
        };
    }
    async saveNodes(payload) {
        if (!this._signer) {
            throw new Error('No signer provided');
        }
        const feeData = await this._provider.getFeeData();
        const maxFeePerGas = this._config.maxFeePerGas
            ? BigInt(this._config.maxFeePerGas)
            : feeData.maxFeePerGas;
        const maxPriorityFeePerGas = this._config.maxPriorityFeePerGas
            ? BigInt(this._config.maxPriorityFeePerGas)
            : feeData.maxPriorityFeePerGas;
        const gasLimit = await this._contract.saveNodes.estimateGas(payload);
        const txData = await this._contract.saveNodes.populateTransaction(payload);
        const request = {
            to: txData.to,
            data: txData.data,
            gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas
        };
        const { txnReceipt } = await this._transactionService.sendTransactionRequest(this._signer, request);
        return txnReceipt;
    }
    static convertIssuerInfo(issuer) {
        const [state, claimsTreeRoot, revocationTreeRoot, rootOfRoots] = issuer.map((i) => Hash.fromBigInt(i).hex());
        return {
            state,
            claimsTreeRoot,
            revocationTreeRoot,
            rootOfRoots
        };
    }
    static convertSmtProofToProof(mtp) {
        let nodeAux = undefined;
        const siblings = mtp.siblings?.map((s) => s.toString());
        if (mtp.auxExistence) {
            nodeAux = {
                key: mtp.auxIndex.toString(),
                value: mtp.auxValue.toString()
            };
        }
        return Proof.fromJSON({ existence: mtp.existence, node_aux: nodeAux, siblings });
    }
}
