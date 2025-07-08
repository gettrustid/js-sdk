"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packEthIdentityProof = exports.OnChainZKPVerifier = exports.toTxDataArgs = exports.FunctionSignatures = void 0;
const ethers_1 = require("ethers");
const iden3comm_1 = require("../../iden3comm");
const ZkpVerifier_json_1 = __importDefault(require("./abi/ZkpVerifier.json"));
const universal_verifier_v2_abi_1 = require("@iden3/universal-verifier-v2-abi");
const blockchain_1 = require("../../blockchain");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const circuits_1 = require("../../circuits");
const utils_1 = require("../../utils");
const js_merkletree_1 = require("@iden3/js-merkletree");
const common_1 = require("./common");
const maxGasLimit = 10000000n;
/**
 * Supported function signature for SubmitZKPResponse
 */
var FunctionSignatures;
(function (FunctionSignatures) {
    /**
     * solidity identifier for function signature:
     * function submitZKPResponse(uint64 requestId, uint256[] calldata inputs,
     * uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c) public
     */
    FunctionSignatures["SubmitZKPResponseV1"] = "b68967e2";
    //function submitZKPResponseV2(tuple[](uint64 requestId,bytes zkProof,bytes data),bytes crossChainProof)
    FunctionSignatures["SubmitZKPResponseV2"] = "ade09fcd";
    //function submitResponse(tuple(string authMethod,bytes proof),tuple(uint256 requestId,bytes proof,bytes metadata)[],bytes crossChainProof)
    FunctionSignatures["SubmitResponse"] = "06c86a91";
})(FunctionSignatures = exports.FunctionSignatures || (exports.FunctionSignatures = {}));
const toTxDataArgs = function (res) {
    return [
        {
            authMethod: res.authProof.raw.authMethod,
            proof: res.authProof.encoded
        },
        res.proofs.map((p) => {
            return {
                requestId: p.requestId,
                proof: p.encoded,
                metadata: p.metadata
            };
        }),
        res.crossChainProof.encoded
    ];
};
exports.toTxDataArgs = toTxDataArgs;
/**
 * OnChainZKPVerifier is a class that allows to interact with the OnChainZKPVerifier contract
 * and submitZKPResponse.
 *
 * @beta
 * @class OnChainZKPVerifier
 */
class OnChainZKPVerifier {
    /**
     *
     * Creates an instance of OnChainZKPVerifier.
     * @beta
     * @param {EthConnectionConfig[]} - array of ETH configs
     */
    constructor(_configs, _opts) {
        this._configs = _configs;
        this._opts = _opts;
    }
    static async prepareTxArgsSubmitV1(txData, zkProofResponse) {
        if (txData.method_id.replace('0x', '') !== FunctionSignatures.SubmitZKPResponseV1) {
            throw new Error(`prepareTxArgsSubmitV1 function doesn't implement requested method id. Only '0x${FunctionSignatures.SubmitZKPResponseV1}' is supported.`);
        }
        const requestID = zkProofResponse.id;
        const inputs = zkProofResponse.pub_signals;
        const preparedZkpProof = (0, common_1.prepareZkpProof)(zkProofResponse.proof);
        const payload = [requestID, inputs, preparedZkpProof.a, preparedZkpProof.b, preparedZkpProof.c];
        return payload;
    }
    /**
     * {@inheritDoc IOnChainZKPVerifier.prepareTxArgsSubmitV1}
     */
    async prepareTxArgsSubmitV1(txData, zkProofResponse) {
        return OnChainZKPVerifier.prepareTxArgsSubmitV1(txData, zkProofResponse);
    }
    /**
     * {@inheritDoc IOnChainZKPVerifier.submitZKPResponse}
     */
    async submitZKPResponse(ethSigner, txData, zkProofResponses) {
        const chainConfig = this._configs.find((i) => i.chainId == txData.chain_id);
        if (!chainConfig) {
            throw new Error(`config for chain id ${txData.chain_id} was not found`);
        }
        if (txData.method_id.replace('0x', '') !== FunctionSignatures.SubmitZKPResponseV1) {
            throw new Error(`submitZKPResponse function doesn't implement requested method id. Only '0x${FunctionSignatures.SubmitZKPResponseV1}' is supported.`);
        }
        const provider = new ethers_1.JsonRpcProvider(chainConfig.url, chainConfig.chainId);
        ethSigner = ethSigner.connect(provider);
        const response = new Map();
        const feeData = await provider.getFeeData();
        const maxFeePerGas = chainConfig.maxFeePerGas
            ? BigInt(chainConfig.maxFeePerGas)
            : feeData.maxFeePerGas;
        const maxPriorityFeePerGas = chainConfig.maxPriorityFeePerGas
            ? BigInt(chainConfig.maxPriorityFeePerGas)
            : feeData.maxPriorityFeePerGas;
        const verifierContract = new ethers_1.Contract(txData.contract_address, ZkpVerifier_json_1.default);
        for (const zkProofResponse of zkProofResponses) {
            const txArgs = await this.prepareTxArgsSubmitV1(txData, zkProofResponse);
            const payload = await verifierContract.submitZKPResponse.populateTransaction(...txArgs);
            const request = {
                to: txData.contract_address,
                data: payload.data,
                maxFeePerGas,
                maxPriorityFeePerGas
            };
            let gasLimit;
            try {
                gasLimit = await ethSigner.estimateGas(request);
            }
            catch (e) {
                gasLimit = maxGasLimit;
            }
            request.gasLimit = gasLimit;
            const transactionService = new blockchain_1.TransactionService(provider);
            const { txnHash } = await transactionService.sendTransactionRequest(ethSigner, request);
            response.set(txnHash, zkProofResponse);
        }
        return response;
    }
    /**
     * {@inheritDoc IOnChainZKPVerifier.submitZKPResponseV2}
     */
    async submitZKPResponseV2(ethSigner, txData, zkProofResponses) {
        const chainConfig = this._configs.find((i) => i.chainId == txData.chain_id);
        if (!chainConfig) {
            throw new Error(`config for chain id ${txData.chain_id} was not found`);
        }
        if (txData.method_id.replace('0x', '') !== FunctionSignatures.SubmitZKPResponseV2) {
            throw new Error(`submitZKPResponseV2 function doesn't implement requested method id. Only '0x${FunctionSignatures.SubmitZKPResponseV2}' is supported.`);
        }
        if (!this._opts?.didResolverUrl) {
            throw new Error(`did resolver url required for crosschain verification`);
        }
        const provider = new ethers_1.JsonRpcProvider(chainConfig.url, chainConfig.chainId);
        ethSigner = ethSigner.connect(provider);
        const txDataArgs = await this.prepareTxArgsSubmitV2(txData, zkProofResponses);
        const feeData = await provider.getFeeData();
        const maxFeePerGas = chainConfig.maxFeePerGas
            ? BigInt(chainConfig.maxFeePerGas)
            : feeData.maxFeePerGas;
        const maxPriorityFeePerGas = chainConfig.maxPriorityFeePerGas
            ? BigInt(chainConfig.maxPriorityFeePerGas)
            : feeData.maxPriorityFeePerGas;
        const verifierContract = new ethers_1.Contract(txData.contract_address, ZkpVerifier_json_1.default);
        const txRequestData = await verifierContract.submitZKPResponseV2.populateTransaction(...txDataArgs);
        const request = {
            to: txData.contract_address,
            data: txRequestData.data,
            maxFeePerGas,
            maxPriorityFeePerGas
        };
        let gasLimit;
        try {
            gasLimit = await ethSigner.estimateGas(request);
        }
        catch (e) {
            gasLimit = maxGasLimit;
        }
        request.gasLimit = gasLimit;
        const transactionService = new blockchain_1.TransactionService(provider);
        const { txnHash } = await transactionService.sendTransactionRequest(ethSigner, request);
        return new Map().set(txnHash, zkProofResponses);
    }
    /**
     * {@inheritDoc IOnChainVerifierMultiQuery.submitResponse}
     */
    async submitResponse(ethSigner, txData, responses, authProof) {
        const chainConfig = this._configs.find((i) => i.chainId == txData.chain_id);
        if (!chainConfig) {
            throw new Error(`config for chain id ${txData.chain_id} was not found`);
        }
        if (txData.method_id.replace('0x', '') !== FunctionSignatures.SubmitResponse) {
            throw new Error(`submitResponse function doesn't implement requested method id. Only '0x${FunctionSignatures.SubmitResponse}' is supported.`);
        }
        if (!this._opts?.didResolverUrl) {
            throw new Error(`did resolver url required for crosschain verification`);
        }
        const provider = new ethers_1.JsonRpcProvider(chainConfig.url, chainConfig.chainId);
        ethSigner = ethSigner.connect(provider);
        const txPreparationResult = await this.prepareTxArgsSubmit(txData, responses, authProof);
        const feeData = await provider.getFeeData();
        const maxFeePerGas = chainConfig.maxFeePerGas
            ? BigInt(chainConfig.maxFeePerGas)
            : feeData.maxFeePerGas;
        const maxPriorityFeePerGas = chainConfig.maxPriorityFeePerGas
            ? BigInt(chainConfig.maxPriorityFeePerGas)
            : feeData.maxPriorityFeePerGas;
        const verifierContract = new ethers_1.Contract(txData.contract_address, universal_verifier_v2_abi_1.IVerifierABI);
        const txRequestData = await verifierContract.submitResponse.populateTransaction(...txPreparationResult.txDataArgs);
        const request = {
            to: txData.contract_address,
            data: txRequestData.data,
            maxFeePerGas,
            maxPriorityFeePerGas
        };
        let gasLimit;
        try {
            gasLimit = await ethSigner.estimateGas(request);
        }
        catch (e) {
            gasLimit = maxGasLimit;
        }
        request.gasLimit = gasLimit;
        const transactionService = new blockchain_1.TransactionService(provider);
        const { txnHash } = await transactionService.sendTransactionRequest(ethSigner, request);
        // return multiple responses for all the responses (single and grouped)
        return new Map().set(txnHash, {
            authProof: txPreparationResult.result.authProof.raw,
            crossChainProof: txPreparationResult.result.crossChainProof.raw,
            responses: txPreparationResult.result.proofs.map((m) => m.proof)
        });
    }
    static async prepareTxArgsSubmit(resolverUrl, txData, responses, authProof) {
        if (txData.method_id.replace('0x', '') !== FunctionSignatures.SubmitResponse) {
            throw new Error(`submit cross chain doesn't implement requested method id. Only '0x${FunctionSignatures.SubmitResponse}' is supported.`);
        }
        const gistUpdatesArr = [];
        const stateUpdatesArr = [];
        const payloadResponses = [];
        const emptyBytes = '0x';
        let encodedAuthProof = '';
        switch (authProof.authMethod) {
            case iden3comm_1.AuthMethod.AUTHV2: {
                const preparedZkpProof = (0, common_1.prepareZkpProof)(authProof.zkp.proof);
                encodedAuthProof = (0, common_1.packZkpProof)(authProof.zkp.pub_signals, preparedZkpProof.a, preparedZkpProof.b, preparedZkpProof.c);
                break;
            }
            case iden3comm_1.AuthMethod.ETH_IDENTITY: {
                encodedAuthProof = (0, exports.packEthIdentityProof)(authProof.userDid);
                break;
            }
            default:
                throw new Error('auth proof must use method AuthV2 or ethIdentity');
        }
        // Process all the responses
        for (const zkProof of responses) {
            this.checkSupportedCircuit(zkProof.circuitId);
            const { requestId, zkProofEncoded, metadata } = (0, iden3comm_1.processProofResponse)(zkProof);
            payloadResponses.push({
                proof: zkProof,
                requestId: requestId,
                encoded: zkProofEncoded,
                metadata: metadata
            });
        }
        // Process all zkProofs and prepare cross chain proofs
        const allZkProofs = responses.map((zkProof) => ({
            circuitId: zkProof.circuitId,
            pub_signals: zkProof.pub_signals
        }));
        if (authProof.authMethod == iden3comm_1.AuthMethod.AUTHV2) {
            allZkProofs.push({
                circuitId: authProof.zkp.circuitId,
                pub_signals: authProof.zkp.pub_signals
            });
        }
        for (const zkProof of allZkProofs) {
            const { gistUpdateResolutions, stateUpdateResolutions } = this.getUpdateResolutions(resolverUrl, txData.chain_id, zkProof.circuitId, zkProof.pub_signals);
            if (gistUpdateResolutions.length > 0) {
                gistUpdatesArr.push(...(await Promise.all(gistUpdateResolutions)));
            }
            if (stateUpdateResolutions.length > 0) {
                stateUpdatesArr.push(...(await Promise.all(stateUpdateResolutions)));
            }
        }
        const encodedCrossChainProof = gistUpdatesArr.length || stateUpdatesArr.length
            ? this.packCrossChainProofs(gistUpdatesArr, stateUpdatesArr)
            : emptyBytes;
        const preparationResult = {
            authProof: { raw: authProof, encoded: encodedAuthProof },
            proofs: payloadResponses,
            crossChainProof: {
                raw: {
                    globalStateProofs: gistUpdatesArr || [],
                    identityStateProofs: stateUpdatesArr || []
                },
                encoded: encodedCrossChainProof
            }
        };
        return { result: preparationResult, txDataArgs: (0, exports.toTxDataArgs)(preparationResult) };
    }
    async prepareTxArgsSubmit(txData, responses, authProof) {
        if (!this._opts?.didResolverUrl) {
            throw new Error(`did resolver url required for crosschain verification`);
        }
        return OnChainZKPVerifier.prepareTxArgsSubmit(this._opts.didResolverUrl, txData, responses, authProof);
    }
    static checkSupportedCircuit(circuitId) {
        if (!this._supportedCircuits.includes(circuitId)) {
            throw new Error(`Circuit ${circuitId} not supported by OnChainZKPVerifier`);
        }
    }
    static getCrossChainResolvers(source, txDataChainId, type, didResolverUrl) {
        return [
            ...new Set(source.map((info) => JSON.stringify({
                id: info.id.string(),
                [type]: type === 'gist' ? info.root?.string() : info.state?.string()
            })))
        ].reduce((acc, s) => {
            const info = JSON.parse(s);
            const id = js_iden3_core_custom_1.Id.fromString(info.id);
            const chainId = (0, js_iden3_core_custom_1.chainIDfromDID)(js_iden3_core_custom_1.DID.parseFromId(id));
            if (txDataChainId === chainId) {
                return acc;
            }
            const promise = this.resolveDidDocumentEip712MessageAndSignature(js_iden3_core_custom_1.DID.parseFromId(js_iden3_core_custom_1.Id.fromString(info.id)), didResolverUrl, {
                [type]: js_merkletree_1.Hash.fromString(info[type])
            });
            return [...acc, promise];
        }, []);
    }
    static async prepareTxArgsSubmitV2(resolverUrl, txData, zkProofResponses) {
        if (txData.method_id.replace('0x', '') !== FunctionSignatures.SubmitZKPResponseV2) {
            throw new Error(`submit cross chain doesn't implement requested method id. Only '0x${FunctionSignatures.SubmitZKPResponseV2}' is supported.`);
        }
        const gistUpdatesArr = [];
        const stateUpdatesArr = [];
        const payloadResponses = [];
        const emptyBytes = '0x';
        for (const zkProof of zkProofResponses) {
            this.checkSupportedCircuit(zkProof.circuitId);
            const { requestId, zkProofEncoded, metadata } = (0, iden3comm_1.processProofResponse)(zkProof);
            payloadResponses.push({
                requestId: requestId,
                zkProof: zkProofEncoded,
                data: metadata
            });
            const { gistUpdateResolutions, stateUpdateResolutions } = this.getUpdateResolutions(resolverUrl, txData.chain_id, zkProof.circuitId, zkProof.pub_signals);
            if (gistUpdateResolutions.length > 0) {
                gistUpdatesArr.push(...(await Promise.all(gistUpdateResolutions)));
            }
            if (stateUpdateResolutions.length > 0) {
                stateUpdatesArr.push(...(await Promise.all(stateUpdateResolutions)));
            }
        }
        const crossChainProofEncoded = gistUpdatesArr.length || stateUpdatesArr.length
            ? this.packCrossChainProofs(gistUpdatesArr, stateUpdatesArr)
            : emptyBytes;
        return [payloadResponses, crossChainProofEncoded];
    }
    async prepareTxArgsSubmitV2(txData, zkProofResponses) {
        if (!this._opts?.didResolverUrl) {
            throw new Error(`did resolver url required for crosschain verification`);
        }
        return OnChainZKPVerifier.prepareTxArgsSubmitV2(this._opts.didResolverUrl, txData, zkProofResponses);
    }
    static getUpdateResolutions(resolverUrl, chainId, proofCircuitId, inputs) {
        const stateInfo = this.getOnChainGistRootStatePubSignals(proofCircuitId, inputs);
        const gistUpdateResolutions = this.getCrossChainResolvers(stateInfo.gists, chainId, 'gist', resolverUrl);
        const stateUpdateResolutions = this.getCrossChainResolvers(stateInfo.states, chainId, 'state', resolverUrl);
        return { gistUpdateResolutions, stateUpdateResolutions };
    }
    static packCrossChainProofs(gistUpdateArr, stateUpdateArr) {
        const proofs = [];
        for (const globalStateUpdate of gistUpdateArr) {
            proofs.push({
                proofType: 'globalStateProof',
                proof: this.packGlobalStateMsg(globalStateUpdate)
            });
        }
        for (const stateUpdate of stateUpdateArr) {
            proofs.push({
                proofType: 'stateProof',
                proof: this.packIdentityStateMsg(stateUpdate)
            });
        }
        return new ethers_1.ethers.AbiCoder().encode(['tuple(' + 'string proofType,' + 'bytes proof' + ')[]'], [proofs]);
    }
    static packGlobalStateMsg(msg) {
        return new ethers_1.ethers.AbiCoder().encode([
            'tuple(' +
                'tuple(' +
                'uint256 timestamp,' +
                'bytes2 idType,' +
                'uint256 root,' +
                'uint256 replacedAtTimestamp' +
                ') globalStateMsg,' +
                'bytes signature,' +
                ')'
        ], [msg]);
    }
    static packIdentityStateMsg(msg) {
        return new ethers_1.ethers.AbiCoder().encode([
            'tuple(' +
                'tuple(' +
                'uint256 timestamp,' +
                'uint256 id,' +
                'uint256 state,' +
                'uint256 replacedAtTimestamp' +
                ') idStateMsg,' +
                'bytes signature,' +
                ')'
        ], [msg]);
    }
    static getOnChainGistRootStatePubSignals(onChainCircuitId, inputs) {
        const PubSignals = this._supportedCircuitsPubSignalsMap[onChainCircuitId];
        if (!PubSignals) {
            throw new Error(`Circuit ${onChainCircuitId} not supported by OnChainZKPVerifier`);
        }
        const atomicQueryPubSignals = new PubSignals();
        const encodedInputs = utils_1.byteEncoder.encode(JSON.stringify(inputs));
        atomicQueryPubSignals.pubSignalsUnmarshal(encodedInputs);
        return atomicQueryPubSignals.getStatesInfo();
    }
    static async resolveDidDocumentEip712MessageAndSignature(did, resolverUrl, opts) {
        const didDoc = await (0, utils_1.resolveDidDocument)(did, resolverUrl, {
            ...opts,
            signature: utils_1.DIDDocumentSignature.EthereumEip712Signature2021
        });
        if (!didDoc.didResolutionMetadata.proof?.length) {
            throw new Error('No proof found in resolved DID document');
        }
        const message = didDoc.didResolutionMetadata.proof[0].eip712.message;
        const signature = didDoc.didResolutionMetadata.proof[0].proofValue;
        const isGistRequest = opts?.gist && !opts.state;
        if (isGistRequest) {
            return {
                globalStateMsg: {
                    timestamp: message.timestamp,
                    idType: message.idType,
                    root: message.root,
                    replacedAtTimestamp: message.replacedAtTimestamp
                },
                signature
            };
        }
        return {
            idStateMsg: {
                timestamp: message.timestamp,
                id: message.id,
                state: message.state,
                replacedAtTimestamp: message.replacedAtTimestamp
            },
            signature
        };
    }
}
exports.OnChainZKPVerifier = OnChainZKPVerifier;
/**
 * supported circuits
 */
OnChainZKPVerifier._supportedCircuits = [
    circuits_1.CircuitId.AuthV2,
    circuits_1.CircuitId.AtomicQueryMTPV2OnChain,
    circuits_1.CircuitId.AtomicQuerySigV2OnChain,
    circuits_1.CircuitId.AtomicQueryV3OnChain
];
OnChainZKPVerifier._supportedCircuitsPubSignalsMap = {
    [circuits_1.CircuitId.AtomicQueryMTPV2OnChain]: circuits_1.AtomicQueryMTPV2OnChainPubSignals,
    [circuits_1.CircuitId.AtomicQuerySigV2OnChain]: circuits_1.AtomicQuerySigV2OnChainPubSignals,
    [circuits_1.CircuitId.AtomicQueryV3OnChain]: circuits_1.AtomicQueryV3OnChainPubSignals,
    [circuits_1.CircuitId.AuthV2]: circuits_1.AuthV2PubSignals
};
/**
 * Packs an Ethereum identity proof from a Decentralized Identifier (DID).
 * @param did - Decentralized Identifier (DID) to pack.
 * @returns A hexadecimal string representing the packed DID identity proof.
 */
const packEthIdentityProof = (did) => {
    return `0x${(0, utils_1.bytesToHex)(js_iden3_core_custom_1.BytesHelper.intToBytes(js_iden3_core_custom_1.DID.idFromDID(did).bigInt()))}`;
};
exports.packEthIdentityProof = packEthIdentityProof;
