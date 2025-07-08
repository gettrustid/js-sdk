import { AcceptProfile } from './types';
/**
 * Constants for Iden3 protocol
 */
export declare const PROTOCOL_MESSAGE_TYPE: Readonly<{
    AUTHORIZATION_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/authorization/1.0/request";
    AUTHORIZATION_RESPONSE_MESSAGE_TYPE: "https://iden3-communication.io/authorization/1.0/response";
    CREDENTIAL_ISSUANCE_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/credentials/1.0/issuance-request";
    CREDENTIAL_FETCH_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/credentials/1.0/fetch-request";
    CREDENTIAL_OFFER_MESSAGE_TYPE: "https://iden3-communication.io/credentials/1.0/offer";
    CREDENTIAL_ISSUANCE_RESPONSE_MESSAGE_TYPE: "https://iden3-communication.io/credentials/1.0/issuance-response";
    CREDENTIAL_REFRESH_MESSAGE_TYPE: "https://iden3-communication.io/credentials/1.0/refresh";
    DEVICE_REGISTRATION_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/devices/1.0/registration";
    MESSAGE_FETCH_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/messages/1.0/fetch";
    PROOF_GENERATION_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/proofs/1.0/request";
    PROOF_GENERATION_RESPONSE_MESSAGE_TYPE: "https://iden3-communication.io/proofs/1.0/response";
    REVOCATION_STATUS_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/revocation/1.0/request-status";
    REVOCATION_STATUS_RESPONSE_MESSAGE_TYPE: "https://iden3-communication.io/revocation/1.0/status";
    CONTRACT_INVOKE_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/proofs/1.0/contract-invoke-request";
    CONTRACT_INVOKE_RESPONSE_MESSAGE_TYPE: "https://iden3-communication.io/proofs/1.0/contract-invoke-response";
    CREDENTIAL_ONCHAIN_OFFER_MESSAGE_TYPE: "https://iden3-communication.io/credentials/1.0/onchain-offer";
    PROPOSAL_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/credentials/0.1/proposal-request";
    PROPOSAL_MESSAGE_TYPE: "https://iden3-communication.io/credentials/0.1/proposal";
    PAYMENT_REQUEST_MESSAGE_TYPE: "https://iden3-communication.io/credentials/0.1/payment-request";
    PAYMENT_MESSAGE_TYPE: "https://iden3-communication.io/credentials/0.1/payment";
    DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE: "https://didcomm.org/discover-features/2.0/queries";
    DISCOVERY_PROTOCOL_DISCLOSE_MESSAGE_TYPE: "https://didcomm.org/discover-features/2.0/disclose";
    PROBLEM_REPORT_MESSAGE_TYPE: "https://didcomm.org/report-problem/2.0/problem-report";
}>;
/**
 * Media types for iden3 comm communication protocol
 *
 * @enum {number}
 */
export declare enum MediaType {
    ZKPMessage = "application/iden3-zkp-json",
    PlainMessage = "application/iden3comm-plain-json",
    SignedMessage = "application/iden3comm-signed-json"
}
export declare const SUPPORTED_PUBLIC_KEY_TYPES: {
    ES256K: string[];
    'ES256K-R': string[];
};
export declare enum ProtocolVersion {
    V1 = "iden3comm/v1"
}
export declare enum AcceptAuthCircuits {
    AuthV2 = "authV2",
    AuthV3 = "authV3"
}
export declare enum AcceptJwzAlgorithms {
    Groth16 = "groth16"
}
export declare enum AcceptJwsAlgorithms {
    ES256K = "ES256K",
    ES256KR = "ES256K-R"
}
export declare const defaultAcceptProfile: AcceptProfile;
export declare const DEFAULT_PROOF_VERIFY_DELAY: number;
export declare const DEFAULT_AUTH_VERIFY_DELAY: number;
