import { BytesHelper, checkBigIntInField, SchemaHash } from 'js-iden3-core-custom';
import { Merklizer } from '@iden3/js-jsonld-merklization';
import { calculateCoreSchemaHash, fillCoreClaimSlot } from '../verifiable';

/**
 * SwapEndianness swaps the endianness of the value encoded in buf. If buf is
 * Big-Endian, the result will be Little-Endian and vice-versa.
 *
 * @param {Uint8Array} buf - bytes to swap
 * @returns Uint8Array - swapped bytes
 */
export const swapEndianness = (buf: Uint8Array): Uint8Array => buf.reverse();

/**
 * FieldToByteArray convert fields to byte representation based on type
 *
 * @param {unknown} field - field to convert
 * @returns Uint8Array
 */
export function fieldToByteArray(field: unknown): Uint8Array {
  let bigIntField: bigint;

  if (typeof field === 'string') {
    bigIntField = BigInt(field);
  } else if (typeof field === 'number') {
    bigIntField = BigInt(Math.trunc(field));
  } else {
    throw new Error('field type is not supported');
  }
  return BytesHelper.intToBytes(bigIntField);
}

/**
 * checks if data fills into slot capacity ()
 *
 * @param {Uint8Array} slot - current slot data
 * @param {Uint8Array} newData - new slot data
 * @returns boolean
 */
export function dataFillsSlot(slot: Uint8Array, newData: Uint8Array): boolean {
  return checkBigIntInField(BytesHelper.bytesToInt(Uint8Array.from([...slot, ...newData])));
}

/**
 * check if byte data is in Q field
 *
 * @param {Uint8Array} data - bytes payload
 * @returns boolean
 */
export function checkDataInField(data: Uint8Array): boolean {
  return checkBigIntInField(BytesHelper.bytesToInt(data));
}

/**
 *
 * @deprecated The method should not be used. Use calculateCoreSchemaHash from verifiable.
 * Calculates schema hash
 *
 * @param {Uint8Array} schemaId
 * @returns {*}  {SchemaHash}
 */
export const createSchemaHash = (schemaId: Uint8Array): SchemaHash => {
  return calculateCoreSchemaHash(schemaId);
};

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
export const fillSlot = async (
  slotData: Uint8Array,
  mz: Merklizer,
  path: string
): Promise<void> => {
  return fillCoreClaimSlot(slotData, mz, path);
};

export const credentialSubjectKey = 'credentialSubject';
