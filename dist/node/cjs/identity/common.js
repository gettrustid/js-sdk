"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateProfileDID = exports.defineMerklizedRootPosition = exports.subjectPositionIndex = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const verifiable_1 = require("../verifiable");
/**
 * Determines subject position
 *
 * @param {IdPosition} idPosition - index / none / value
 * @returns {SubjectPosition}
 */
const subjectPositionIndex = (idPosition) => {
    switch (idPosition) {
        case js_iden3_core_custom_1.IdPosition.Index:
            return verifiable_1.SubjectPosition.Index;
        case js_iden3_core_custom_1.IdPosition.Value:
            return verifiable_1.SubjectPosition.Value;
        default:
            return verifiable_1.SubjectPosition.None;
    }
};
exports.subjectPositionIndex = subjectPositionIndex;
/**
 * Returns merklized root position based on schema serialization metadata and expected position
 *
 * @param {SchemaMetadata} [metadata] - schema metadata
 * @param {MerklizedRootPosition} [position] - expected mt root position
 * @returns {MerklizedRootPosition}
 */
const defineMerklizedRootPosition = (metadata, position) => {
    if (!metadata?.serialization) {
        return js_iden3_core_custom_1.MerklizedRootPosition.None;
    }
    if (position != null && position !== js_iden3_core_custom_1.MerklizedRootPosition.None) {
        return position;
    }
    return js_iden3_core_custom_1.MerklizedRootPosition.Index;
};
exports.defineMerklizedRootPosition = defineMerklizedRootPosition;
/**
 * Returns profile DID based on did and profile nonce
 *
 * @param {DID} [did] - did from which profile will be derived
 * @param {number | string} [profileNonce] - profile nonce
 * @returns {DID}
 */
const generateProfileDID = (did, profileNonce) => {
    const id = js_iden3_core_custom_1.DID.idFromDID(did);
    profileNonce = profileNonce ?? 0;
    if (!isBigInt(profileNonce)) {
        throw new Error('profile must be number or decimal string');
    }
    const profile = js_iden3_core_custom_1.Id.profileId(id, BigInt(profileNonce));
    return js_iden3_core_custom_1.DID.parseFromId(profile);
};
exports.generateProfileDID = generateProfileDID;
const isBigInt = (x) => {
    try {
        return BigInt(x).toString() === x.toString();
    }
    catch {
        return false; // conversion to BigInt failed, surely it is not a BigInt
    }
};
