"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlainPacker = void 0;
const constants_1 = require("../constants");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
/**
 * Plain packer just serializes bytes to JSON and adds media type
 *
 * @public
 * @class PlainPacker
 * @implements implements IPacker interface
 */
class PlainPacker {
    constructor() {
        this.supportedProtocolVersions = [constants_1.ProtocolVersion.V1];
    }
    /**
     * Packs a basic message using the specified parameters.
     *
     * @param msg - The basic message to pack.
     * @param param - The packer parameters.
     * @returns A promise that resolves to a Uint8Array representing the packed message.
     * @throws An error if the method is not implemented.
     */
    packMessage(msg) {
        msg.typ = constants_1.MediaType.PlainMessage;
        return Promise.resolve(utils_1.byteEncoder.encode(JSON.stringify(msg)));
    }
    /**
     * Pack returns packed message to transport envelope
     *
     * @param {Uint8Array} payload - json message serialized
     * @param {PlainPackerParams} _params - not used here
     * @returns `Promise<Uint8Array>`
     */
    async pack(payload) {
        const msg = JSON.parse(utils_1.byteDecoder.decode(payload));
        msg.typ = constants_1.MediaType.PlainMessage;
        return Promise.resolve(utils_1.byteEncoder.encode(JSON.stringify(msg)));
    }
    /**
     * Unpack returns unpacked message from transport envelope
     *
     * @param {Uint8Array} envelope - packed envelope (serialized json with media type)
     * @returns `Promise<BasicMessage>`
     */
    async unpack(envelope) {
        return JSON.parse(utils_1.byteDecoder.decode(envelope));
    }
    /**
     * returns media type for plain message
     *
     * @returns MediaType
     */
    mediaType() {
        return constants_1.MediaType.PlainMessage;
    }
    /** {@inheritDoc IPacker.getSupportedProfiles} */
    getSupportedProfiles() {
        return this.supportedProtocolVersions.map((v) => `${v};env=${this.mediaType()}`);
    }
    /** {@inheritDoc IPacker.isProfileSupported} */
    isProfileSupported(profile) {
        const { protocolVersion, env, circuits, alg } = (0, utils_2.parseAcceptProfile)(profile);
        if (!this.supportedProtocolVersions.includes(protocolVersion)) {
            return false;
        }
        if (env !== this.mediaType()) {
            return false;
        }
        if (circuits) {
            throw new Error(`Circuits are not supported for ${env} media type`);
        }
        if (alg) {
            throw new Error(`Algorithms are not supported for ${env} media type`);
        }
        return true;
    }
}
exports.PlainPacker = PlainPacker;
