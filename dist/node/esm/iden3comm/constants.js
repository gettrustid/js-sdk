const IDEN3_PROTOCOL = 'https://iden3-communication.io/';
const DIDCOMM_PROTOCOL = 'https://didcomm.org/';
/**
 * Constants for Iden3 protocol
 */
export const PROTOCOL_MESSAGE_TYPE = Object.freeze({
    // AuthorizationV2RequestMessageType defines auth request type of the communication protocol
    AUTHORIZATION_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}authorization/1.0/request`,
    // AuthorizationResponseMessageType defines auth response type of the communication protocol
    AUTHORIZATION_RESPONSE_MESSAGE_TYPE: `${IDEN3_PROTOCOL}authorization/1.0/response`,
    // CredentialIssuanceRequestMessageType accepts request for credential creation
    CREDENTIAL_ISSUANCE_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/1.0/issuance-request`,
    // CredentialFetchRequestMessageType is type for request of credential generation
    CREDENTIAL_FETCH_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/1.0/fetch-request`,
    // CredentialOfferMessageType is type of message with credential offering
    CREDENTIAL_OFFER_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/1.0/offer`,
    // CredentialIssuanceResponseMessageType is type for message with a credential issuance
    CREDENTIAL_ISSUANCE_RESPONSE_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/1.0/issuance-response`,
    // CredentialRefreshMessageType is type for message with a credential issuance
    CREDENTIAL_REFRESH_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/1.0/refresh`,
    // DeviceRegistrationRequestMessageType defines device registration request type of the communication protocol
    DEVICE_REGISTRATION_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}devices/1.0/registration`,
    // MessageFetMessageFetchRequestMessageType defines message fetch request type of the communication protocol.
    MESSAGE_FETCH_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}messages/1.0/fetch`,
    // ProofGenerationRequestMessageType is type for request of proof generation
    PROOF_GENERATION_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}proofs/1.0/request`,
    // ProofGenerationResponseMessageType is type for response of proof generation
    PROOF_GENERATION_RESPONSE_MESSAGE_TYPE: `${IDEN3_PROTOCOL}proofs/1.0/response`,
    // RevocationStatusRequestMessageType is type for request of revocation status
    REVOCATION_STATUS_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}revocation/1.0/request-status`,
    // RevocationStatusResponseMessageType is type for response with a revocation status
    REVOCATION_STATUS_RESPONSE_MESSAGE_TYPE: `${IDEN3_PROTOCOL}revocation/1.0/status`,
    // ContractInvokeRequestMessageType is type for request of contract invoke request
    CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}proofs/1.0/contract-invoke-request`,
    // ContractInvokeResponseMessageType is type for response of contract invoke request
    CONTRACT_INVOKE_RESPONSE_MESSAGE_TYPE: `${IDEN3_PROTOCOL}proofs/1.0/contract-invoke-response`,
    // CredentialOnchainOfferMessageType is type of message with credential onchain offering
    CREDENTIAL_ONCHAIN_OFFER_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/1.0/onchain-offer`,
    // ProposalRequestMessageType is type for proposal-request message
    PROPOSAL_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/0.1/proposal-request`,
    // ProposalMessageType is type for proposal message
    PROPOSAL_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/0.1/proposal`,
    // PaymentRequestMessageType is type for payment-request message
    PAYMENT_REQUEST_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/0.1/payment-request`,
    // PaymentMessageType is type for payment message
    PAYMENT_MESSAGE_TYPE: `${IDEN3_PROTOCOL}credentials/0.1/payment`,
    // DiscoveryProtocolQueriesMessageType is type for didcomm discovery protocol queries
    DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE: `${DIDCOMM_PROTOCOL}discover-features/2.0/queries`,
    // DiscoveryProtocolDiscloseMessageType is type for didcomm discovery protocol disclose
    DISCOVERY_PROTOCOL_DISCLOSE_MESSAGE_TYPE: `${DIDCOMM_PROTOCOL}discover-features/2.0/disclose`,
    // ProblemReportMessageType is type for didcomm problem report
    PROBLEM_REPORT_MESSAGE_TYPE: `${DIDCOMM_PROTOCOL}report-problem/2.0/problem-report`
});
/**
 * Media types for iden3 comm communication protocol
 *
 * @enum {number}
 */
export var MediaType;
(function (MediaType) {
    MediaType["ZKPMessage"] = "application/iden3-zkp-json";
    MediaType["PlainMessage"] = "application/iden3comm-plain-json";
    MediaType["SignedMessage"] = "application/iden3comm-signed-json";
})(MediaType || (MediaType = {}));
export const SUPPORTED_PUBLIC_KEY_TYPES = {
    ES256K: [
        'EcdsaSecp256k1VerificationKey2019',
        /**
         * Equivalent to EcdsaSecp256k1VerificationKey2019 when key is an ethereumAddress
         */
        'EcdsaSecp256k1RecoveryMethod2020',
        'JsonWebKey2020'
    ],
    'ES256K-R': [
        'EcdsaSecp256k1VerificationKey2019',
        /**
         * Equivalent to EcdsaSecp256k1VerificationKey2019 when key is an ethereumAddress
         */
        'EcdsaSecp256k1RecoveryMethod2020',
        'JsonWebKey2020'
    ]
};
export var ProtocolVersion;
(function (ProtocolVersion) {
    ProtocolVersion["V1"] = "iden3comm/v1";
})(ProtocolVersion || (ProtocolVersion = {}));
export var AcceptAuthCircuits;
(function (AcceptAuthCircuits) {
    AcceptAuthCircuits["AuthV2"] = "authV2";
    AcceptAuthCircuits["AuthV3"] = "authV3";
})(AcceptAuthCircuits || (AcceptAuthCircuits = {}));
export var AcceptJwzAlgorithms;
(function (AcceptJwzAlgorithms) {
    AcceptJwzAlgorithms["Groth16"] = "groth16";
})(AcceptJwzAlgorithms || (AcceptJwzAlgorithms = {}));
export var AcceptJwsAlgorithms;
(function (AcceptJwsAlgorithms) {
    AcceptJwsAlgorithms["ES256K"] = "ES256K";
    AcceptJwsAlgorithms["ES256KR"] = "ES256K-R";
})(AcceptJwsAlgorithms || (AcceptJwsAlgorithms = {}));
export const defaultAcceptProfile = {
    protocolVersion: ProtocolVersion.V1,
    env: MediaType.ZKPMessage,
    circuits: [AcceptAuthCircuits.AuthV2],
    alg: [AcceptJwzAlgorithms.Groth16]
};
export const DEFAULT_PROOF_VERIFY_DELAY = 1 * 60 * 60 * 1000; // 1 hour
export const DEFAULT_AUTH_VERIFY_DELAY = 5 * 60 * 1000; // 5 minutes
