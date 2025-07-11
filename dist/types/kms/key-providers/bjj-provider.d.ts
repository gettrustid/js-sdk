import { IKeyProvider } from '../kms';
import { AbstractPrivateKeyStore, KmsKeyId, KmsKeyType } from '../store';
/**
 * Provider for Baby Jub Jub keys
 * @public
 * @class BjjProvider
 * @implements implements IKeyProvider interface
 */
export declare class BjjProvider implements IKeyProvider {
    /**
     * key type that is handled by BJJ Provider
     * @type {KmsKeyType}
     */
    keyType: KmsKeyType;
    private keyStore;
    /**
     * Creates an instance of BjjProvider.
     * @param {KmsKeyType} keyType - kms key type
     * @param {AbstractPrivateKeyStore} keyStore - key store for kms
     */
    constructor(keyType: KmsKeyType, keyStore: AbstractPrivateKeyStore);
    /**
     * get all keys
     * @returns list of keys
     */
    list(): Promise<{
        alias: string;
        key: string;
    }[]>;
    /**
     * generates a baby jub jub key from a seed phrase
     * @param {Uint8Array} seed - byte array seed
     * @returns kms key identifier
     */
    newPrivateKeyFromSeed(seed: Uint8Array): Promise<KmsKeyId>;
    /**
     * Gets public key by kmsKeyId
     *
     * @param {KmsKeyId} keyId - key identifier
     */
    publicKey(keyId: KmsKeyId): Promise<string>;
    /**
     * signs prepared payload of size,
     * with a key id
     *
     * @param {KmsKeyId} keyId  - key identifier
     * @param {Uint8Array} data - data to sign (32 bytes)
     * @returns Uint8Array signature
     */
    sign(keyId: KmsKeyId, data: Uint8Array): Promise<Uint8Array>;
    private privateKey;
    verify(message: Uint8Array, signatureHex: string, keyId: KmsKeyId): Promise<boolean>;
}
