import { PROTOCOL_MESSAGE_TYPE } from '../constants';
import { MediaType } from '../constants';
import { DID, getUnixTimestamp } from 'js-iden3-core-custom';
import * as uuid from 'uuid';
import { proving } from '@iden3/js-jwz';
import { byteEncoder } from '../../utils';
import { AbstractMessageHandler } from './message-handler';
import { PaymentFeatures, PaymentRequestDataType, PaymentType, SupportedPaymentProofType } from '../../verifiable';
import { ethers } from 'ethers';
import { verifyExpiresTime } from './common';
/**
 * @beta
 * createPaymentRequest is a function to create protocol payment-request message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {string} agent - agent URL
 * @param {PaymentRequestInfo[]} payments - payments
 * @returns `PaymentRequestMessage`
 */
export function createPaymentRequest(sender, receiver, agent, payments, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.PAYMENT_REQUEST_MESSAGE_TYPE,
        body: {
            agent,
            payments
        },
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time ? getUnixTimestamp(opts.expires_time) : undefined
    };
    return request;
}
export async function verifyEIP712TypedData(data, resolver) {
    const paymentData = data.type === PaymentRequestDataType.Iden3PaymentRailsRequestV1
        ? {
            recipient: data.recipient,
            amount: data.amount,
            expirationDate: getUnixTimestamp(new Date(data.expirationDate)),
            nonce: data.nonce,
            metadata: '0x'
        }
        : {
            tokenAddress: data.tokenAddress,
            recipient: data.recipient,
            amount: data.amount,
            expirationDate: getUnixTimestamp(new Date(data.expirationDate)),
            nonce: data.nonce,
            metadata: '0x'
        };
    const proof = Array.isArray(data.proof) ? data.proof[0] : data.proof;
    const typesFetchResult = await fetch(proof.eip712.types);
    const types = await typesFetchResult.json();
    delete types.EIP712Domain;
    const recovered = ethers.verifyTypedData(proof.eip712.domain, types, paymentData, proof.proofValue);
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
/**
 * @beta
 * createPayment is a function to create protocol payment message
 * @param {DID} sender - sender did
 * @param {DID} receiver - receiver did
 * @param {PaymentMessageBody} body - payments
 * @returns `PaymentMessage`
 */
export function createPayment(sender, receiver, payments, opts) {
    const uuidv4 = uuid.v4();
    const request = {
        id: uuidv4,
        thid: uuidv4,
        from: sender.string(),
        to: receiver.string(),
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.PAYMENT_MESSAGE_TYPE,
        body: {
            payments
        },
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time ? getUnixTimestamp(opts.expires_time) : undefined
    };
    return request;
}
/**
 *
 * Allows to process PaymentRequest protocol message
 * @beta
 * @class PaymentHandler
 * @implements implements IPaymentHandler interface
 */
export class PaymentHandler extends AbstractMessageHandler {
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
            case PROTOCOL_MESSAGE_TYPE.PAYMENT_REQUEST_MESSAGE_TYPE:
                return await this.handlePaymentRequestMessage(message, context);
            case PROTOCOL_MESSAGE_TYPE.PAYMENT_MESSAGE_TYPE:
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
        if (message.type !== PROTOCOL_MESSAGE_TYPE.PAYMENT_REQUEST_MESSAGE_TYPE) {
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
        const senderDID = DID.parse(paymentRequest.to);
        const receiverDID = DID.parse(paymentRequest.from);
        const payments = [];
        for (let i = 0; i < paymentRequest.body.payments.length; i++) {
            const { data } = paymentRequest.body.payments[i];
            const selectedPayment = Array.isArray(data)
                ? data.find((p) => {
                    return p.type === PaymentRequestDataType.Iden3PaymentRequestCryptoV1
                        ? p.id === ctx.nonce
                        : p.nonce === ctx.nonce;
                })
                : data;
            if (!selectedPayment) {
                throw new Error(`failed request. no payment in request for nonce ${ctx.nonce}`);
            }
            switch (selectedPayment.type) {
                case PaymentRequestDataType.Iden3PaymentRequestCryptoV1:
                    payments.push(await this.handleIden3PaymentRequestCryptoV1(selectedPayment, ctx.paymentHandler));
                    break;
                case PaymentRequestDataType.Iden3PaymentRailsRequestV1:
                    payments.push(await this.handleIden3PaymentRailsRequestV1(selectedPayment, ctx.paymentHandler));
                    break;
                case PaymentRequestDataType.Iden3PaymentRailsERC20RequestV1:
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
        if (this._params.packerParams.mediaType === MediaType.SignedMessage &&
            !this._params.packerParams.packerOptions) {
            throw new Error(`jws packer options are required for ${MediaType.SignedMessage}`);
        }
        const paymentRequest = await this.parsePaymentRequest(request);
        if (!paymentRequest.from) {
            throw new Error(`failed request. empty 'from' field`);
        }
        if (!paymentRequest.to) {
            throw new Error(`failed request. empty 'to' field`);
        }
        if (!opts?.allowExpiredMessages) {
            verifyExpiresTime(paymentRequest);
        }
        const agentMessage = await this.handlePaymentRequestMessage(paymentRequest, opts);
        if (!agentMessage) {
            return null;
        }
        const senderDID = DID.parse(paymentRequest.to);
        return this.packMessage(agentMessage, senderDID);
    }
    /**
     * @inheritdoc IPaymentHandler#handlePayment
     */
    async handlePayment(payment, params) {
        if (!params?.allowExpiredMessages) {
            verifyExpiresTime(payment);
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
            const nonce = p.type === PaymentType.Iden3PaymentCryptoV1 ? p.id : p.nonce;
            const requestDataArr = params.paymentRequest.body.payments
                .map((r) => (Array.isArray(r.data) ? r.data : [r.data]))
                .flat();
            const requestData = requestDataArr.find((r) => r.type === PaymentRequestDataType.Iden3PaymentRequestCryptoV1
                ? r.id === nonce
                : r.nonce === nonce);
            if (!requestData) {
                throw new Error(`can't find payment request for payment ${p.type === PaymentType.Iden3PaymentCryptoV1 ? 'id' : 'nonce'} ${nonce}`);
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
                if (option.type === PaymentRequestDataType.Iden3PaymentRailsERC20RequestV1 &&
                    !option.contractAddress) {
                    throw new Error(`failed request. no token address for option id ${optionId}`);
                }
                const expirationDateRequired = expirationDate ?? new Date(new Date().setHours(new Date().getHours() + 1));
                const typeUrl = `https://schema.iden3.io/core/json/${option.type}.json`;
                const typesFetchResult = await fetch(typeUrl);
                const types = await typesFetchResult.json();
                delete types.EIP712Domain;
                const paymentData = option.type === PaymentRequestDataType.Iden3PaymentRailsRequestV1
                    ? {
                        recipient,
                        amount: amount,
                        expirationDate: getUnixTimestamp(expirationDateRequired),
                        nonce,
                        metadata: '0x'
                    }
                    : {
                        tokenAddress: option.contractAddress,
                        recipient,
                        amount: amount,
                        expirationDate: getUnixTimestamp(expirationDateRequired),
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
                        type: SupportedPaymentProofType.EthereumEip712Signature2021,
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
                    type: PaymentRequestDataType.Iden3PaymentRailsRequestV1,
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
                dataArr.push(option.type === PaymentRequestDataType.Iden3PaymentRailsRequestV1
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
        const responseEncoded = byteEncoder.encode(JSON.stringify(message));
        const packerOpts = this._params.packerParams.mediaType === MediaType.SignedMessage
            ? this._params.packerParams.packerOptions
            : {
                provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
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
            type: PaymentType.Iden3PaymentCryptoV1,
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
            type: PaymentType.Iden3PaymentRailsV1,
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
        if (!data.features?.includes(PaymentFeatures.EIP_2612) && !approveHandler) {
            throw new Error(`please provide erc20TokenApproveHandler in context for ERC-20 payment type`);
        }
        if (approveHandler) {
            await approveHandler(data);
        }
        const txId = await paymentHandler(data);
        const proof = Array.isArray(data.proof) ? data.proof[0] : data.proof;
        return {
            nonce: data.nonce,
            type: PaymentType.Iden3PaymentRailsERC20V1,
            '@context': 'https://schema.iden3.io/core/jsonld/payment.jsonld#Iden3PaymentRailsERC20V1',
            paymentData: {
                txId,
                chainId: proof.eip712.domain.chainId,
                tokenAddress: data.tokenAddress
            }
        };
    }
}
