"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthStateStorage = exports.defaultEthConnectionConfig = void 0;
const ethers_1 = require("ethers");
const circuits_1 = require("../../circuits");
const utils_1 = require("../../utils");
const State_json_1 = __importDefault(require("./abi/State.json"));
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const blockchain_1 = require("../../blockchain");
const common_1 = require("./common");
const memory_1 = require("../memory");
const iden3comm_1 = require("../../iden3comm");
const verifiable_1 = require("../../verifiable");
exports.defaultEthConnectionConfig = {
    url: 'http://localhost:8545',
    defaultGasLimit: 600000,
    minGasPrice: '0',
    maxGasPrice: '100000000000',
    confirmationBlockCount: 5,
    confirmationTimeout: 600000,
    contractAddress: '',
    receiptTimeout: 600000,
    rpcResponseTimeout: 5000,
    waitReceiptCycleTime: 30000,
    waitBlockCycleTime: 3000
};
/**
 *
 *
 * @public
 * @class EthStateStorage
 * @implements implements IStateStorage interface
 */
class EthStateStorage {
    /**
     * Creates an instance of EthStateStorage.
     * @param {EthConnectionConfig} [ethConfig=defaultEthConnectionConfig]
     */
    constructor(ethConfig, options) {
        this.ethConfig = ethConfig;
        this._disableCache = false;
        const config = Array.isArray(ethConfig) ? ethConfig[0] : ethConfig;
        this.provider = new ethers_1.JsonRpcProvider(config.url);
        this.stateContract = new ethers_1.Contract(config.contractAddress, State_json_1.default, this.provider);
        this._transactionService = new blockchain_1.TransactionService(this.getRpcProvider());
        // Store cache options for later use
        this._latestStateCacheOptions = {
            ttl: options?.latestStateCacheOptions?.ttl ?? iden3comm_1.PROTOCOL_CONSTANTS.DEFAULT_PROOF_VERIFY_DELAY / 2,
            maxSize: options?.latestStateCacheOptions?.maxSize ?? verifiable_1.DEFAULT_CACHE_MAX_SIZE
        };
        this._stateCacheOptions = {
            notReplacedTtl: options?.stateCacheOptions?.notReplacedTtl ??
                iden3comm_1.PROTOCOL_CONSTANTS.DEFAULT_PROOF_VERIFY_DELAY / 2,
            replacedTtl: options?.stateCacheOptions?.replacedTtl ?? iden3comm_1.PROTOCOL_CONSTANTS.DEFAULT_PROOF_VERIFY_DELAY,
            maxSize: options?.stateCacheOptions?.maxSize ?? verifiable_1.DEFAULT_CACHE_MAX_SIZE
        };
        this._rootCacheOptions = {
            replacedTtl: options?.rootCacheOptions?.replacedTtl ?? iden3comm_1.PROTOCOL_CONSTANTS.DEFAULT_AUTH_VERIFY_DELAY,
            notReplacedTtl: options?.rootCacheOptions?.notReplacedTtl ??
                iden3comm_1.PROTOCOL_CONSTANTS.DEFAULT_AUTH_VERIFY_DELAY / 2,
            maxSize: options?.rootCacheOptions?.maxSize ?? verifiable_1.DEFAULT_CACHE_MAX_SIZE
        };
        this._gistProofCacheOptions = {
            ttl: iden3comm_1.PROTOCOL_CONSTANTS.DEFAULT_AUTH_VERIFY_DELAY / 2,
            maxSize: options?.gistProofCacheOptions?.maxSize ?? verifiable_1.DEFAULT_CACHE_MAX_SIZE
        };
        // Initialize cache instances
        this._latestStateResolveCache =
            options?.latestStateCacheOptions?.cache ??
                (0, memory_1.createInMemoryCache)({
                    maxSize: this._latestStateCacheOptions.maxSize,
                    ttl: this._latestStateCacheOptions.ttl
                });
        this._stateResolveCache =
            options?.stateCacheOptions?.cache ??
                (0, memory_1.createInMemoryCache)({
                    maxSize: this._stateCacheOptions.maxSize,
                    ttl: this._stateCacheOptions.replacedTtl
                });
        this._rootResolveCache =
            options?.rootCacheOptions?.cache ??
                (0, memory_1.createInMemoryCache)({
                    maxSize: this._rootCacheOptions.maxSize,
                    ttl: this._rootCacheOptions.replacedTtl
                });
        this._gistProofResolveCache =
            options?.gistProofCacheOptions?.cache ??
                (0, memory_1.createInMemoryCache)({
                    maxSize: this._gistProofCacheOptions.maxSize,
                    ttl: this._gistProofCacheOptions.ttl
                });
        this._disableCache = options?.disableCache ?? false;
    }
    /** {@inheritdoc IStateStorage.getLatestStateById} */
    async getLatestStateById(id) {
        const cacheKey = this.getLatestStateCacheKey(id);
        if (!this._disableCache) {
            // Check cache first
            const cachedResult = await this._latestStateResolveCache?.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
        }
        const { stateContract } = this.getStateContractAndProviderForId(id);
        const rawData = await stateContract.getStateInfoById(id);
        const stateInfo = {
            id: BigInt(rawData[0]),
            state: BigInt(rawData[1]),
            replacedByState: BigInt(rawData[2]),
            createdAtTimestamp: BigInt(rawData[3]),
            replacedAtTimestamp: BigInt(rawData[4]),
            createdAtBlock: BigInt(rawData[5]),
            replacedAtBlock: BigInt(rawData[6])
        };
        !this._disableCache &&
            (await this._latestStateResolveCache?.set(cacheKey, stateInfo, this._latestStateCacheOptions.ttl));
        return stateInfo;
    }
    /** {@inheritdoc IStateStorage.getStateInfoByIdAndState} */
    async getStateInfoByIdAndState(id, state) {
        const cacheKey = this.getStateCacheKey(id, state);
        if (!this._disableCache) {
            // Check cache first
            const cachedResult = await this._stateResolveCache?.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
        }
        const { stateContract } = this.getStateContractAndProviderForId(id);
        const rawData = await stateContract.getStateInfoByIdAndState(id, state);
        const stateInfo = {
            id: BigInt(rawData[0]),
            state: BigInt(rawData[1]),
            replacedByState: BigInt(rawData[2]),
            createdAtTimestamp: BigInt(rawData[3]),
            replacedAtTimestamp: BigInt(rawData[4]),
            createdAtBlock: BigInt(rawData[5]),
            replacedAtBlock: BigInt(rawData[6])
        };
        const ttl = stateInfo.replacedAtTimestamp === 0n
            ? this._stateCacheOptions.notReplacedTtl
            : this._stateCacheOptions.replacedTtl;
        !this._disableCache && (await this._stateResolveCache?.set(cacheKey, stateInfo, ttl));
        return stateInfo;
    }
    /** {@inheritdoc IStateStorage.publishState} */
    async publishState(proof, signer) {
        const stateTransitionPubSig = new circuits_1.StateTransitionPubSignals();
        stateTransitionPubSig.pubSignalsUnmarshal(utils_1.byteEncoder.encode(JSON.stringify(proof.pub_signals)));
        const { userId, oldUserState, newUserState, isOldStateGenesis } = stateTransitionPubSig;
        const { stateContract, provider } = this.getStateContractAndProviderForId(userId.bigInt());
        const contract = stateContract.connect(signer);
        const preparedZkpProof = (0, common_1.prepareZkpProof)(proof.proof);
        const payload = [
            userId.bigInt().toString(),
            oldUserState.bigInt().toString(),
            newUserState.bigInt().toString(),
            isOldStateGenesis,
            preparedZkpProof.a,
            preparedZkpProof.b,
            preparedZkpProof.c
        ];
        const feeData = await provider.getFeeData();
        const maxFeePerGas = exports.defaultEthConnectionConfig.maxFeePerGas
            ? BigInt(exports.defaultEthConnectionConfig.maxFeePerGas)
            : feeData.maxFeePerGas;
        const maxPriorityFeePerGas = exports.defaultEthConnectionConfig.maxPriorityFeePerGas
            ? BigInt(exports.defaultEthConnectionConfig.maxPriorityFeePerGas)
            : feeData.maxPriorityFeePerGas;
        const gasLimit = await contract.transitState.estimateGas(...payload);
        const txData = await contract.transitState.populateTransaction(...payload);
        const request = {
            to: txData.to,
            data: txData.data,
            gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas
        };
        const { txnHash } = await this._transactionService.sendTransactionRequest(signer, request);
        return txnHash;
    }
    /** {@inheritdoc IStateStorage.publishStateGeneric} */
    async publishStateGeneric(signer, userStateTransitionInfo) {
        const { userId, oldUserState, newUserState, isOldStateGenesis, methodId, methodParams } = userStateTransitionInfo;
        const { stateContract, provider } = this.getStateContractAndProviderForId(userId.bigInt());
        const contract = stateContract.connect(signer);
        const feeData = await provider.getFeeData();
        const maxFeePerGas = exports.defaultEthConnectionConfig.maxFeePerGas
            ? BigInt(exports.defaultEthConnectionConfig.maxFeePerGas)
            : feeData.maxFeePerGas;
        const maxPriorityFeePerGas = exports.defaultEthConnectionConfig.maxPriorityFeePerGas
            ? BigInt(exports.defaultEthConnectionConfig.maxPriorityFeePerGas)
            : feeData.maxPriorityFeePerGas;
        const payload = [
            userId.bigInt().toString(),
            oldUserState.bigInt().toString(),
            newUserState.bigInt().toString(),
            isOldStateGenesis,
            methodId,
            methodParams //'0x'
        ];
        const gasLimit = await contract.transitStateGeneric.estimateGas(...payload);
        const txData = await contract.transitStateGeneric.populateTransaction(...payload);
        const request = {
            to: txData.to,
            data: txData.data,
            gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas
        };
        const { txnHash } = await this._transactionService.sendTransactionRequest(signer, request);
        return txnHash;
    }
    /** {@inheritdoc IStateStorage.getGISTProof} */
    async getGISTProof(id) {
        const cacheKey = this.getGistProofCacheKey(id);
        if (!this._disableCache) {
            // Check cache first
            const cachedResult = await this._gistProofResolveCache?.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
        }
        const { stateContract } = this.getStateContractAndProviderForId(id);
        const data = await stateContract.getGISTProof(id);
        const stateProof = {
            root: BigInt(data.root.toString()),
            existence: data.existence,
            siblings: data.siblings?.map((sibling) => BigInt(sibling.toString())),
            index: BigInt(data.index.toString()),
            value: BigInt(data.value.toString()),
            auxExistence: data.auxExistence,
            auxIndex: BigInt(data.auxIndex.toString()),
            auxValue: BigInt(data.auxValue.toString())
        };
        !this._disableCache &&
            (await this._gistProofResolveCache?.set(cacheKey, stateProof, this._gistProofCacheOptions.ttl));
        return stateProof;
    }
    /** {@inheritdoc IStateStorage.getGISTRootInfo} */
    async getGISTRootInfo(root, id) {
        const cacheKey = this.getRootCacheKey(root);
        if (!this._disableCache) {
            // Check cache first
            const cachedResult = await this._rootResolveCache?.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }
        }
        const { stateContract } = this.getStateContractAndProviderForId(id);
        const data = await stateContract.getGISTRootInfo(root);
        const rootInfo = {
            root: BigInt(data.root.toString()),
            replacedByRoot: BigInt(data.replacedByRoot.toString()),
            createdAtTimestamp: BigInt(data.createdAtTimestamp.toString()),
            replacedAtTimestamp: BigInt(data.replacedAtTimestamp.toString()),
            createdAtBlock: BigInt(data.createdAtBlock.toString()),
            replacedAtBlock: BigInt(data.replacedAtBlock.toString())
        };
        const ttl = rootInfo.replacedAtTimestamp == 0n
            ? this._rootCacheOptions.notReplacedTtl
            : this._rootCacheOptions.replacedTtl;
        !this._disableCache && (await this._rootResolveCache?.set(cacheKey, rootInfo, ttl));
        return rootInfo;
    }
    /** {@inheritdoc IStateStorage.getRpcProvider} */
    getRpcProvider() {
        return this.provider;
    }
    /** enable caching */
    enableCache() {
        this._disableCache = false;
    }
    /** disable caching */
    disableCache() {
        this._disableCache = true;
    }
    getStateContractAndProviderForId(id) {
        const idTyped = js_iden3_core_custom_1.Id.fromBigInt(id);
        const chainId = (0, js_iden3_core_custom_1.getChainId)(js_iden3_core_custom_1.DID.blockchainFromId(idTyped), js_iden3_core_custom_1.DID.networkIdFromId(idTyped));
        const config = this.networkByChainId(chainId);
        const provider = new ethers_1.JsonRpcProvider(config.url);
        const stateContract = new ethers_1.Contract(config.contractAddress, State_json_1.default, provider);
        return { stateContract, provider };
    }
    networkByChainId(chainId) {
        const config = Array.isArray(this.ethConfig) ? this.ethConfig : [this.ethConfig];
        const network = config.find((c) => c.chainId === chainId);
        if (!network) {
            throw new Error(`chainId "${chainId}" not supported`);
        }
        return network;
    }
    getGistProofCacheKey(id) {
        return `gist-${id.toString()}`;
    }
    getLatestStateCacheKey(id) {
        return `latest-${id.toString()}`;
    }
    getStateCacheKey(id, state) {
        return `${id.toString()}-${state.toString()}`;
    }
    getRootCacheKey(root) {
        return root.toString();
    }
}
exports.EthStateStorage = EthStateStorage;
