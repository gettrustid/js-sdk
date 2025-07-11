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
exports.BjjProvider = void 0;
const js_crypto_1 = require("@iden3/js-crypto");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const store_1 = require("../store");
const providerHelpers = __importStar(require("../provider-helpers"));
const utils_1 = require("../../utils");
/**
 * Provider for Baby Jub Jub keys
 * @public
 * @class BjjProvider
 * @implements implements IKeyProvider interface
 */
class BjjProvider {
    /**
     * Creates an instance of BjjProvider.
     * @param {KmsKeyType} keyType - kms key type
     * @param {AbstractPrivateKeyStore} keyStore - key store for kms
     */
    constructor(keyType, keyStore) {
        if (keyType !== store_1.KmsKeyType.BabyJubJub) {
            throw new Error('Key type must be BabyJubJub');
        }
        this.keyType = keyType;
        this.keyStore = keyStore;
    }
    /**
     * get all keys
     * @returns list of keys
     */
    async list() {
        const allKeysFromKeyStore = await this.keyStore.list();
        return allKeysFromKeyStore.filter((key) => key.alias.startsWith(this.keyType));
    }
    /**
     * generates a baby jub jub key from a seed phrase
     * @param {Uint8Array} seed - byte array seed
     * @returns kms key identifier
     */
    async newPrivateKeyFromSeed(seed) {
        const newKey = new Uint8Array(32);
        newKey.set(Uint8Array.from(seed), 0);
        newKey.fill(seed.length, 32, 0);
        const privateKey = new js_crypto_1.PrivateKey(seed);
        const publicKey = privateKey.public();
        const kmsId = {
            type: this.keyType,
            id: providerHelpers.keyPath(this.keyType, publicKey.hex())
        };
        await this.keyStore.importKey({ alias: kmsId.id, key: privateKey.hex() });
        return kmsId;
    }
    /**
     * Gets public key by kmsKeyId
     *
     * @param {KmsKeyId} keyId - key identifier
     */
    async publicKey(keyId) {
        const privateKey = await this.privateKey(keyId);
        return privateKey.public().hex();
    }
    /**
     * signs prepared payload of size,
     * with a key id
     *
     * @param {KmsKeyId} keyId  - key identifier
     * @param {Uint8Array} data - data to sign (32 bytes)
     * @returns Uint8Array signature
     */
    async sign(keyId, data) {
        if (data.length != 32) {
            throw new Error('data to sign is too large');
        }
        const i = js_iden3_core_custom_1.BytesHelper.bytesToInt(data);
        if (!(0, js_iden3_core_custom_1.checkBigIntInField)(i)) {
            throw new Error('data to sign is too large');
        }
        const privateKey = await this.privateKey(keyId);
        const signature = privateKey.signPoseidon(i);
        return signature.compress();
    }
    async privateKey(keyId) {
        const privateKeyHex = await this.keyStore.get({ alias: keyId.id });
        return new js_crypto_1.PrivateKey(js_crypto_1.Hex.decodeString(privateKeyHex));
    }
    async verify(message, signatureHex, keyId) {
        const publicKey = await this.publicKey(keyId);
        return js_crypto_1.PublicKey.newFromCompressed((0, utils_1.hexToBytes)(publicKey)).verifyPoseidon(js_iden3_core_custom_1.BytesHelper.bytesToInt(message), js_crypto_1.Signature.newFromCompressed((0, utils_1.hexToBytes)(signatureHex)));
    }
}
exports.BjjProvider = BjjProvider;
