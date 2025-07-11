"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentialSubjectKey = exports.fillSlot = exports.createSchemaHash = exports.checkDataInField = exports.dataFillsSlot = exports.fieldToByteArray = exports.swapEndianness = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const verifiable_1 = require("../verifiable");
/**
 * SwapEndianness swaps the endianness of the value encoded in buf. If buf is
 * Big-Endian, the result will be Little-Endian and vice-versa.
 *
 * @param {Uint8Array} buf - bytes to swap
 * @returns Uint8Array - swapped bytes
 */
const swapEndianness = (buf) => buf.reverse();
exports.swapEndianness = swapEndianness;
/**
 * FieldToByteArray convert fields to byte representation based on type
 *
 * @param {unknown} field - field to convert
 * @returns Uint8Array
 */
function fieldToByteArray(field) {
    let bigIntField;
    if (typeof field === 'string') {
        bigIntField = BigInt(field);
    }
    else if (typeof field === 'number') {
        bigIntField = BigInt(Math.trunc(field));
    }
    else {
        throw new Error('field type is not supported');
    }
    return js_iden3_core_custom_1.BytesHelper.intToBytes(bigIntField);
}
exports.fieldToByteArray = fieldToByteArray;
/**
 * checks if data fills into slot capacity ()
 *
 * @param {Uint8Array} slot - current slot data
 * @param {Uint8Array} newData - new slot data
 * @returns boolean
 */
function dataFillsSlot(slot, newData) {
    return (0, js_iden3_core_custom_1.checkBigIntInField)(js_iden3_core_custom_1.BytesHelper.bytesToInt(Uint8Array.from([...slot, ...newData])));
}
exports.dataFillsSlot = dataFillsSlot;
/**
 * check if byte data is in Q field
 *
 * @param {Uint8Array} data - bytes payload
 * @returns boolean
 */
function checkDataInField(data) {
    return (0, js_iden3_core_custom_1.checkBigIntInField)(js_iden3_core_custom_1.BytesHelper.bytesToInt(data));
}
exports.checkDataInField = checkDataInField;
/**
 *
 * @deprecated The method should not be used. Use calculateCoreSchemaHash from verifiable.
 * Calculates schema hash
 *
 * @param {Uint8Array} schemaId
 * @returns {*}  {SchemaHash}
 */
const createSchemaHash = (schemaId) => {
    return (0, verifiable_1.calculateCoreSchemaHash)(schemaId);
};
exports.createSchemaHash = createSchemaHash;
/**
 *
 * @deprecated The method should not be used. Use fillCoreClaimSlot from verifiable.
 * checks if data can fill the slot
 *
 * @param {Uint8Array} slotData - slot data
 * @param {Merklizer} mz - merklizer
 * @param {string} path - path
 * @returns {void}
 */
const fillSlot = async (slotData, mz, path) => {
    return (0, verifiable_1.fillCoreClaimSlot)(slotData, mz, path);
};
exports.fillSlot = fillSlot;
exports.credentialSubjectKey = 'credentialSubject';
