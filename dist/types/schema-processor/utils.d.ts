import { SchemaHash } from 'js-iden3-core-custom';
import { Merklizer } from '@iden3/js-jsonld-merklization';
/**
 * SwapEndianness swaps the endianness of the value encoded in buf. If buf is
 * Big-Endian, the result will be Little-Endian and vice-versa.
 *
 * @param {Uint8Array} buf - bytes to swap
 * @returns Uint8Array - swapped bytes
 */
export declare const swapEndianness: (buf: Uint8Array) => Uint8Array;
/**
 * FieldToByteArray convert fields to byte representation based on type
 *
 * @param {unknown} field - field to convert
 * @returns Uint8Array
 */
export declare function fieldToByteArray(field: unknown): Uint8Array;
/**
 * checks if data fills into slot capacity ()
 *
 * @param {Uint8Array} slot - current slot data
 * @param {Uint8Array} newData - new slot data
 * @returns boolean
 */
export declare function dataFillsSlot(slot: Uint8Array, newData: Uint8Array): boolean;
/**
 * check if byte data is in Q field
 *
 * @param {Uint8Array} data - bytes payload
 * @returns boolean
 */
export declare function checkDataInField(data: Uint8Array): boolean;
/**
 *
 * @deprecated The method should not be used. Use calculateCoreSchemaHash from verifiable.
 * Calculates schema hash
 *
 * @param {Uint8Array} schemaId
 * @returns {*}  {SchemaHash}
 */
export declare const createSchemaHash: (schemaId: Uint8Array) => SchemaHash;
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
export declare const fillSlot: (slotData: Uint8Array, mz: Merklizer, path: string) => Promise<void>;
export declare const credentialSubjectKey = "credentialSubject";
