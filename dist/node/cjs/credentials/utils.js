"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKMSIdByAuthCredential = exports.getUserDIDFromCredential = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const js_crypto_1 = require("@iden3/js-crypto");
const kms_1 = require("../kms");
/**
 * Retrieves the user DID from a given credential.
 * If the credential does not have a credentialSubject.id property, the issuer DID is returned.
 * If the credentialSubject.id is not a string, an error is thrown.
 * @param issuerDID The DID of the issuer.
 * @param credential The credential object.
 * @returns The user DID parsed from the credential.
 * @throws Error if the credentialSubject.id is not a string.
 */
const getUserDIDFromCredential = (issuerDID, credential) => {
    if (!credential.credentialSubject.id) {
        return issuerDID;
    }
    if (typeof credential.credentialSubject.id !== 'string') {
        throw new Error('credential subject `id` is not a string');
    }
    return js_iden3_core_custom_1.DID.parse(credential.credentialSubject.id);
};
exports.getUserDIDFromCredential = getUserDIDFromCredential;
const getKMSIdByAuthCredential = (credential) => {
    if (!credential.type.includes('AuthBJJCredential')) {
        throw new Error("can't sign with not AuthBJJCredential credential");
    }
    const x = credential.credentialSubject['x'];
    const y = credential.credentialSubject['y'];
    const pb = new js_crypto_1.PublicKey([BigInt(x), BigInt(y)]);
    const kp = (0, kms_1.keyPath)(kms_1.KmsKeyType.BabyJubJub, pb.hex());
    return { type: kms_1.KmsKeyType.BabyJubJub, id: kp };
};
exports.getKMSIdByAuthCredential = getKMSIdByAuthCredential;
