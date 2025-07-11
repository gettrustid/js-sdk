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
exports.calculateCoreSchemaHash = exports.parseCoreClaimSlots = exports.findCredentialType = exports.parseSerializationAttr = exports.getSerializationAttrFromParsedContext = exports.getSerializationAttrFromContext = exports.fillCoreClaimSlot = exports.getFieldSlotIndex = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const js_jsonld_merklization_1 = require("@iden3/js-jsonld-merklization");
const utils_1 = require("../utils");
const jsonld = __importStar(require("jsonld/lib"));
const ldcontext = __importStar(require("jsonld/lib/context"));
const js_crypto_1 = require("@iden3/js-crypto");
const js_sha3_1 = require("js-sha3");
const credentialSubjectKey = 'credentialSubject';
const contextFullKey = '@context';
const serializationFullKey = 'iden3_serialization';
const fieldPrefix = 'iden3:v1:';
const credentialSubjectFullKey = 'https://www.w3.org/2018/credentials#credentialSubject';
const verifiableCredentialFullKey = 'https://www.w3.org/2018/credentials#VerifiableCredential';
const typeFullKey = '@type';
/**
 * GetFieldSlotIndex return index of slot from 0 to 7 (each claim has by default 8 slots) for non-merklized claims
 *
 * @param {string} field - field name
 * @param {Uint8Array} schemaBytes -json schema bytes
 * @returns `number`
 */
const getFieldSlotIndex = async (field, typeName, schemaBytes) => {
    let ctxDoc = JSON.parse(utils_1.byteDecoder.decode(schemaBytes));
    ctxDoc = ctxDoc[contextFullKey];
    if (ctxDoc === undefined) {
        throw new Error('document has no @context');
    }
    const ldCtx = await jsonld.processContext(ldcontext.getInitialContext({}), ctxDoc, {});
    const serAttr = await (0, exports.getSerializationAttrFromParsedContext)(ldCtx, typeName);
    if (!serAttr) {
        throw new Error('serialization attribute is not set');
    }
    const sPaths = (0, exports.parseSerializationAttr)(serAttr);
    switch (field) {
        case sPaths.indexAPath:
            return 2;
        case sPaths.indexBPath:
            return 3;
        case sPaths.valueAPath:
            return 6;
        case sPaths.valueBPath:
            return 7;
        default:
            throw new Error(`field ${field} not specified in serialization info`);
    }
};
exports.getFieldSlotIndex = getFieldSlotIndex;
/**
 * checks if data can fill the slot
 *
 * @param {Uint8Array} slotData - slot data
 * @param {Merklizer} mz - merklizer
 * @param {string} path - path
 * @returns {void}
 */
const fillCoreClaimSlot = async (slotData, mz, path) => {
    if (!path) {
        return;
    }
    path = credentialSubjectKey + '.' + path;
    try {
        const p = await mz.resolveDocPath(path, mz.options);
        const entry = await mz.entry(p);
        const intVal = await entry.getValueMtEntry();
        const bytesVal = js_iden3_core_custom_1.BytesHelper.intToBytes(intVal);
        slotData.set(bytesVal, 0);
    }
    catch (err) {
        if (err.toString().includes('entry not found')) {
            throw new Error(`field not found in credential ${path}`);
        }
        throw err;
    }
};
exports.fillCoreClaimSlot = fillCoreClaimSlot;
// Get `iden3_serialization` attr definition from context document either using
// type name like DeliverAddressMultiTestForked or by type id like
// urn:uuid:ac2ede19-b3b9-454d-b1a9-a7b3d5763100.
const getSerializationAttrFromContext = async (context, opts, tp) => {
    const ldCtx = await jsonld.processContext(ldcontext.getInitialContext({}), context, opts);
    return (0, exports.getSerializationAttrFromParsedContext)(ldCtx, tp);
};
exports.getSerializationAttrFromContext = getSerializationAttrFromContext;
const getSerializationAttrFromParsedContext = async (ldCtx, tp) => {
    const termDef = ldCtx.mappings;
    if (!termDef) {
        throw new Error('terms definitions is not of correct type');
    }
    const term = termDef.get(tp) ?? [...termDef.values()].find((value) => value['@id'] === tp);
    if (!term) {
        return '';
    }
    const termCtx = term[contextFullKey];
    if (!termCtx) {
        throw new Error('type @context is not of correct type');
    }
    const serStr = termCtx[serializationFullKey] ?? '';
    return serStr;
};
exports.getSerializationAttrFromParsedContext = getSerializationAttrFromParsedContext;
const parseSerializationAttr = (serAttr) => {
    if (!serAttr.startsWith(fieldPrefix)) {
        throw new Error('serialization attribute does not have correct prefix');
    }
    const parts = serAttr.slice(fieldPrefix.length).split('&');
    if (parts.length > 4) {
        throw new Error('serialization attribute has too many parts');
    }
    const paths = {};
    for (const part of parts) {
        const kv = part.split('=');
        if (kv.length !== 2) {
            throw new Error('serialization attribute part does not have correct format');
        }
        switch (kv[0]) {
            case 'slotIndexA':
                paths.indexAPath = kv[1];
                break;
            case 'slotIndexB':
                paths.indexBPath = kv[1];
                break;
            case 'slotValueA':
                paths.valueAPath = kv[1];
                break;
            case 'slotValueB':
                paths.valueBPath = kv[1];
                break;
            default:
                throw new Error('unknown serialization attribute slot');
        }
    }
    return paths;
};
exports.parseSerializationAttr = parseSerializationAttr;
const findCredentialType = (mz) => {
    const opts = mz.options;
    try {
        // try to look into credentialSubject.@type to get type of credentials
        const path1 = new js_jsonld_merklization_1.Path([credentialSubjectFullKey, typeFullKey], opts.hasher);
        const e = mz.rawValue(path1);
        return e;
    }
    catch (err) {
        // if type of credentials not found in credentialSubject.@type, loop at
        // top level @types if it contains two elements: type we are looking for
        // and "VerifiableCredential" type.
        const path2 = new js_jsonld_merklization_1.Path([typeFullKey], opts.hasher);
        const topLevelTypes = mz.rawValue(path2);
        if (!Array.isArray(topLevelTypes)) {
            throw new Error('top level @type expected to be an array');
        }
        if (topLevelTypes.length !== 2) {
            throw new Error('top level @type expected to be of length 2');
        }
        switch (verifiableCredentialFullKey) {
            case topLevelTypes[0]:
                return topLevelTypes[1];
            case topLevelTypes[1]:
                return topLevelTypes[0];
            default:
                throw new Error('@type(s) are expected to contain VerifiableCredential type');
        }
    }
};
exports.findCredentialType = findCredentialType;
/**
 * parseCoreClaimSlots converts payload to claim slots using provided schema
 *
 * @param { { mappings: Map<string, Record<string, unknown>> } } ldCtx - ldCtx
 * @param {Merklizer} mz - Merklizer
 * @param {string} credentialType - credential type
 * @returns `Promise<{ slots: ParsedSlots; nonMerklized: boolean }>`
 */
const parseCoreClaimSlots = async (ldCtx, mz, credentialType) => {
    // parseSlots converts payload to claim slots using provided schema
    const slots = {
        indexA: new Uint8Array(32),
        indexB: new Uint8Array(32),
        valueA: new Uint8Array(32),
        valueB: new Uint8Array(32)
    };
    const serAttr = await (0, exports.getSerializationAttrFromParsedContext)(ldCtx, credentialType);
    if (!serAttr) {
        return { slots, nonMerklized: false };
    }
    const sPaths = (0, exports.parseSerializationAttr)(serAttr);
    const isSPathEmpty = !Object.values(sPaths).some(Boolean);
    if (isSPathEmpty) {
        return { slots, nonMerklized: true };
    }
    await (0, exports.fillCoreClaimSlot)(slots.indexA, mz, sPaths.indexAPath);
    await (0, exports.fillCoreClaimSlot)(slots.indexB, mz, sPaths.indexBPath);
    await (0, exports.fillCoreClaimSlot)(slots.valueA, mz, sPaths.valueAPath);
    await (0, exports.fillCoreClaimSlot)(slots.valueB, mz, sPaths.valueBPath);
    return { slots, nonMerklized: true };
};
exports.parseCoreClaimSlots = parseCoreClaimSlots;
/**
 * Calculates core schema hash
 *
 * @param {Uint8Array} schemaId
 * @returns {*}  {SchemaHash}
 */
const calculateCoreSchemaHash = (schemaId) => {
    const sHash = js_crypto_1.Hex.decodeString((0, js_sha3_1.keccak256)(schemaId));
    return new js_iden3_core_custom_1.SchemaHash(sHash.slice(sHash.length - 16, sHash.length));
};
exports.calculateCoreSchemaHash = calculateCoreSchemaHash;
