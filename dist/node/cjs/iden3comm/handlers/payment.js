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
exports.PaymentHandler = exports.createPayment = exports.verifyEIP712TypedData = exports.createPaymentRequest = void 0;
const constants_1 = require("../constants");
const constants_2 = require("../constants");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const uuid = __importStar(require("uuid"));
const js_jwz_1 = require("@iden3/js-jwz");
const utils_1 = require("../../utils");
const message_handler_1 = require("./message-handler");
const verifiable_1 = require("../../verifiable");
const ethers_1 = require("ethers");
const common_1 = require("./common");
/**
 * @beta
 * createPaymentRequest is a function to create protocol payment-request message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {string} agent - agent URL
 * @param {PaymentRequestInfo[]} payments - payments
 * @returns `PaymentRequestMessage`
 */
function createPaymentRequest(sender, receiver, agent, payments, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: constants_2.MediaType.PlainMessage,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.PAYMENT_REQUEST_MESSAGE_TYPE,
        body: {
            agent,
            payments
        },
        created_time: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date()),
        expires_time: opts?.expires_time ? (0, js_iden3_core_custom_1.getUnixTimestamp)(opts.expires_time) : undefined
    };
    return request;
}
exports.createPaymentRequest = createPaymentRequest;
async function verifyEIP712TypedData(data, resolver) {
    const paymentData = data.type === verifiable_1.PaymentRequestDataType.Iden3PaymentRailsRequestV1
        ? {
            recipient: data.recipient,
            amount: data.amount,
            expirationDate: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date(data.expirationDate)),
            nonce: data.nonce,
            metadata: '0x'
        }
        : {
            tokenAddress: data.tokenAddress,
            recipient: data.recipient,
            amount: data.amount,
            expirationDate: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date(data.expirationDate)),
            nonce: data.nonce,
            metadata: '0x'
        };
    const proof = Array.isArray(data.proof) ? data.proof[0] : data.proof;
    const typesFetchResult = await fetch(proof.eip712.types);
    const types = await typesFetchResult.json();
    delete types.EIP712Domain;
    const recovered = ethers_1.ethers.verifyTypedData(proof.eip712.domain, types, paymentData, proof.proofValue);
    const { didDocument } = await resolver.resolve(proof.verificationMethod);
    if (didDocument?.verificationMethod) {
        for (const verificationMethod of didDocument.verificationMethod) {
            if (verificationMethod.blockchainAccountId?.split(':').slice(-1)[0].toLowerCase() ===
                recovered.toLowerCase()) {
                return recovered;
            }
        }
    }
    else {
        throw new Error('failed request. issuer DIDDocument does not contain any verificationMethods');
    }
    throw new Error(`failed request. no matching verificationMethod`);
}
exports.verifyEIP712TypedData = verifyEIP712TypedData;
/**
 * @beta
 * createPayment is a function to create protocol payment message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {PaymentMessageBody} body - payments
 * @returns `PaymentMessage`
 */
function createPayment(sender, receiver, payments, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: constants_2.MediaType.PlainMessage,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.PAYMENT_MESSAGE_TYPE,
        body: {
            payments
        },
        created_time: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date()),
        expires_time: opts?.expires_time ? (0, js_iden3_core_custom_1.getUnixTimestamp)(opts.expires_time) : undefined
    };
    return request;
}
exports.createPayment = createPayment;
/**
 *
 * Allows to process PaymentRequest protocol message
 * @beta
 * @class PaymentHandler
 * @implements implements IPaymentHandler interface
 */
class PaymentHandler extends message_handler_1.AbstractMessageHandler {
    /**
     * @beta Creates an instance of PaymentHandler.
     * @param {IPackageManager} _packerMgr - package manager to unpack message envelope
     * @param {PaymentHandlerParams} _params - payment handler params
     *
     */
    constructor(_packerMgr, _params) {
        super();
        this._packerMgr = _packerMgr;
        this._params = _params;
    }
    async handle(message, context) {
        switch (message.type) {
            case constants_1.PROTOCOL_MESSAGE_TYPE.PAYMENT_REQUEST_MESSAGE_TYPE:
                return await this.handlePaymentRequestMessage(message, context);
            case constants_1.PROTOCOL_MESSAGE_TYPE.PAYMENT_MESSAGE_TYPE:
                await this.handlePayment(message, context);
                return null;
            default:
                return super.handle(message, context);
        }
    }
    /**
     * @inheritdoc IPaymentHandler#parsePaymentRequest
     */
    async parsePaymentRequest(request) {
        const { unpackedMessage: message } = await this._packerMgr.unpack(request);
        const paymentRequest = message;
        if (message.type !== constants_1.PROTOCOL_MESSAGE_TYPE.PAYMENT_REQUEST_MESSAGE_TYPE) {
            throw new Error('Invalid media type');
        }
        return paymentRequest;
    }
    async handlePaymentRequestMessage(paymentRequest, ctx) {
        if (!paymentRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        if (!paymentRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!paymentRequest.body.payments?.length) {
            throw new Error(`failed request. no 'payments' in body`);
        }
        if (!ctx.paymentHandler) {
            throw new Error(`please provide payment handler in context`);
        }
        const senderDID = js_iden3_core_custom_1.DID.parse(paymentRequest.to);
        const receiverDID = js_iden3_core_custom_1.DID.parse(paymentRequest.from);
        const payments = [];
        for (let i = 0; i < paymentRequest.body.payments.length; i++) {
            const { data } = paymentRequest.body.payments[i];
            const selectedPayment = Array.isArray(data)
                ? data.find((p) => {
                    return p.type === verifiable_1.PaymentRequestDataType.Iden3PaymentRequestCryptoV1
                        ? p.id === ctx.nonce
                        : p.nonce === ctx.nonce;
                })
                : data;
            if (!selectedPayment) {
                throw new Error(`failed request. no payment in request for nonce ${ctx.nonce}`);
            }
            switch (selectedPayment.type) {
                case verifiable_1.PaymentRequestDataType.Iden3PaymentRequestCryptoV1:
                    payments.push(await this.handleIden3PaymentRequestCryptoV1(selectedPayment, ctx.paymentHandler));
                    break;
                case verifiable_1.PaymentRequestDataType.Iden3PaymentRailsRequestV1:
                    payments.push(await this.handleIden3PaymentRailsRequestV1(selectedPayment, ctx.paymentHandler));
                    break;
                case verifiable_1.PaymentRequestDataType.Iden3PaymentRailsERC20RequestV1:
                    payments.push(await this.handleIden3PaymentRailsERC20RequestV1(selectedPayment, ctx.paymentHandler, ctx.erc20TokenApproveHandler));
                    break;
            }
        }
        const paymentMessage = createPayment(senderDID, receiverDID, payments);
        const response = await this.packMessage(paymentMessage, senderDID);
        const agentResult = await fetch(paymentRequest.body.agent, {
            method: 'POST',
            body: response,
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        });
        const arrayBuffer = await agentResult.arrayBuffer();
        if (!arrayBuffer.byteLength) {
            return null;
        }
        const { unpackedMessage } = await this._packerMgr.unpack(new Uint8Array(arrayBuffer));
        return unpackedMessage;
    }
    /**
     * @inheritdoc IPaymentHandler#handlePaymentRequest
     */
    async handlePaymentRequest(request, opts) {
        if (this._params.packerParams.mediaType === constants_2.MediaType.SignedMessage &&
            !this._params.packerParams.packerOptions) {
            throw new Error(`jws packer options are required for ${constants_2.MediaType.SignedMessage}`);
        }
        const paymentRequest = await this.parsePaymentRequest(request);
        if (!paymentRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!paymentRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        if (!opts?.allowExpiredMessages) {
            (0, common_1.verifyExpiresTime)(paymentRequest);
        }
        const agentMessage = await this.handlePaymentRequestMessage(paymentRequest, opts);
        if (!agentMessage) {
            return null;
        }
        const senderDID = js_iden3_core_custom_1.DID.parse(paymentRequest.to);
        return this.packMessage(agentMessage, senderDID);
    }
    /**
     * @inheritdoc IPaymentHandler#handlePayment
     */
    async handlePayment(payment, params) {
        if (!params?.allowExpiredMessages) {
            (0, common_1.verifyExpiresTime)(payment);
        }
        if (params.paymentRequest.from !== payment.to) {
            throw new Error(`sender of the request is not a target of response - expected ${params.paymentRequest.from}, given ${payment.to}`);
        }
        if (!payment.body.payments.length) {
            throw new Error(`failed request. empty 'payments' field in body`);
        }
        if (!params.paymentValidationHandler) {
            throw new Error(`please provide payment validation handler in options`);
        }
        for (let i = 0; i < payment.body.payments.length; i++) {
            const p = payment.body.payments[i];
            const nonce = p.type === verifiable_1.PaymentType.Iden3PaymentCryptoV1 ? p.id : p.nonce;
            const requestDataArr = params.paymentRequest.body.payments
                .map((r) => (Array.isArray(r.data) ? r.data : [r.data]))
                .flat();
            const requestData = requestDataArr.find((r) => r.type === verifiable_1.PaymentRequestDataType.Iden3PaymentRequestCryptoV1
                ? r.id === nonce
                : r.nonce === nonce);
            if (!requestData) {
                throw new Error(`can't find payment request for payment ${p.type === verifiable_1.PaymentType.Iden3PaymentCryptoV1 ? 'id' : 'nonce'} ${nonce}`);
            }
            await params.paymentValidationHandler(p.paymentData.txId, requestData);
        }
    }
    /**
     * @inheritdoc IPaymentHandler#createPaymentRailsV1
     */
    async createPaymentRailsV1(sender, receiver, agent, signer, payments) {
        const paymentRequestInfo = [];
        for (let i = 0; i < payments.length; i++) {
            const { credentials, description } = payments[i];
            const dataArr = [];
            for (let j = 0; j < payments[i].options.length; j++) {
                const { nonce, amount, chainId, optionId, expirationDate } = payments[i].options[j];
                const multiChainConfig = this._params.multiChainPaymentConfig?.find((c) => c.chainId === chainId);
                if (!multiChainConfig) {
                    throw new Error(`failed request. no config for chain ${chainId}`);
                }
                const { recipient, paymentRails, options } = multiChainConfig;
                const option = options.find((t) => t.id === optionId);
                if (!option) {
                    throw new Error(`failed request. no option for id ${optionId}`);
                }
                if (option.type === verifiable_1.PaymentRequestDataType.Iden3PaymentRailsERC20RequestV1 &&
                    !option.contractAddress) {
                    throw new Error(`failed request. no token address for option id ${optionId}`);
                }
                const expirationDateRequired = expirationDate ?? new Date(new Date().setHours(new Date().getHours() + 1));
                const typeUrl = `https://schema.iden3.io/core/json/${option.type}.json`;
                const typesFetchResult = await fetch(typeUrl);
                const types = await typesFetchResult.json();
                delete types.EIP712Domain;
                const paymentData = option.type === verifiable_1.PaymentRequestDataType.Iden3PaymentRailsRequestV1
                    ? {
                        recipient,
                        amount: amount,
                        expirationDate: (0, js_iden3_core_custom_1.getUnixTimestamp)(expirationDateRequired),
                        nonce,
                        metadata: '0x'
                    }
                    : {
                        tokenAddress: option.contractAddress,
                        recipient,
                        amount: amount,
                        expirationDate: (0, js_iden3_core_custom_1.getUnixTimestamp)(expirationDateRequired),
                        nonce,
                        metadata: '0x'
                    };
                const domain = {
                    name: 'MCPayment',
                    version: '1.0.0',
                    chainId,
                    verifyingContract: paymentRails
                };
                const signature = await signer.signTypedData(domain, types, paymentData);
                const proof = [
                    {
                        type: verifiable_1.SupportedPaymentProofType.EthereumEip712Signature2021,
                        proofPurpose: 'assertionMethod',
                        proofValue: signature,
                        verificationMethod: `did:pkh:eip155:${chainId}:${await signer.getAddress()}`,
                        created: new Date().toISOString(),
                        eip712: {
                            types: typeUrl,
                            primaryType: 'Iden3PaymentRailsRequestV1',
                            domain
                        }
                    }
                ];
                const d = {
                    type: verifiable_1.PaymentRequestDataType.Iden3PaymentRailsRequestV1,
                    '@context': [
                        `https://schema.iden3.io/core/jsonld/payment.jsonld#${option.type}`,
                        'https://w3id.org/security/suites/eip712sig-2021/v1'
                    ],
                    recipient,
                    amount: amount.toString(),
                    expirationDate: expirationDateRequired.toISOString(),
                    nonce: nonce.toString(),
                    metadata: '0x',
                    proof
                };
                dataArr.push(option.type === verifiable_1.PaymentRequestDataType.Iden3PaymentRailsRequestV1
                    ? d
                    : {
                        ...d,
                        type: option.type,
                        tokenAddress: option.contractAddress || '',
                        features: option.features || []
                    });
            }
            paymentRequestInfo.push({
                data: dataArr,
                credentials,
                description
            });
        }
        return createPaymentRequest(sender, receiver, agent, paymentRequestInfo);
    }
    async packMessage(message, senderDID) {
        const responseEncoded = utils_1.byteEncoder.encode(JSON.stringify(message));
        const packerOpts = this._params.packerParams.mediaType === constants_2.MediaType.SignedMessage
            ? this._params.packerParams.packerOptions
            : {
                provingMethodAlg: js_jwz_1.proving.provingMethodGroth16AuthV2Instance.methodAlg
            };
        return await this._packerMgr.pack(this._params.packerParams.mediaType, responseEncoded, {
            senderDID,
            ...packerOpts
        });
    }
    async handleIden3PaymentRequestCryptoV1(data, paymentHandler) {
        if (data.expiration && new Date(data.expiration) < new Date()) {
            throw new Error(`failed request. expired request`);
        }
        const txId = await paymentHandler(data);
        return {
            id: data.id,
            '@context': 'https://schema.iden3.io/core/jsonld/payment.jsonld#Iden3PaymentCryptoV1',
            type: verifiable_1.PaymentType.Iden3PaymentCryptoV1,
            paymentData: {
                txId
            }
        };
    }
    async handleIden3PaymentRailsRequestV1(data, paymentHandler) {
        if (data.expirationDate && new Date(data.expirationDate) < new Date()) {
            throw new Error(`failed request. expired request`);
        }
        const signer = await verifyEIP712TypedData(data, this._params.documentResolver);
        if (this._params.allowedSigners && !this._params.allowedSigners.includes(signer)) {
            throw new Error(`failed request. signer is not in the allowed signers list`);
        }
        const txId = await paymentHandler(data);
        const proof = Array.isArray(data.proof) ? data.proof[0] : data.proof;
        return {
            nonce: data.nonce,
            type: verifiable_1.PaymentType.Iden3PaymentRailsV1,
            '@context': 'https://schema.iden3.io/core/jsonld/payment.jsonld#Iden3PaymentRailsV1',
            paymentData: {
                txId,
                chainId: proof.eip712.domain.chainId
            }
        };
    }
    async handleIden3PaymentRailsERC20RequestV1(data, paymentHandler, approveHandler) {
        if (data.expirationDate && new Date(data.expirationDate) < new Date()) {
            throw new Error(`failed request. expired request`);
        }
        const signer = await verifyEIP712TypedData(data, this._params.documentResolver);
        if (this._params.allowedSigners && !this._params.allowedSigners.includes(signer)) {
            throw new Error(`failed request. signer is not in the allowed signers list`);
        }
        if (!data.features?.includes(verifiable_1.PaymentFeatures.EIP_2612) && !approveHandler) {
            throw new Error(`please provide erc20TokenApproveHandler in context for ERC-20 payment type`);
        }
        if (approveHandler) {
            await approveHandler(data);
        }
        const txId = await paymentHandler(data);
        const proof = Array.isArray(data.proof) ? data.proof[0] : data.proof;
        return {
            nonce: data.nonce,
            type: verifiable_1.PaymentType.Iden3PaymentRailsERC20V1,
            '@context': 'https://schema.iden3.io/core/jsonld/payment.jsonld#Iden3PaymentRailsERC20V1',
            paymentData: {
                txId,
                chainId: proof.eip712.domain.chainId,
                tokenAddress: data.tokenAddress
            }
        };
    }
}
exports.PaymentHandler = PaymentHandler;
