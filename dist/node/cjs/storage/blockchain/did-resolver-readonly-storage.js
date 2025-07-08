"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DidResolverStateReadonlyStorage = void 0;
const js_merkletree_1 = require("@iden3/js-merkletree");
const utils_1 = require("../../utils");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const ethers_1 = require("ethers");
class DidResolverStateReadonlyStorage {
    constructor(resolverUrl) {
        this.resolverUrl = resolverUrl;
    }
    async getLatestStateById(id) {
        return this.getStateInfo(id);
    }
    async getStateInfoByIdAndState(id, state) {
        return this.getStateInfo(id, state);
    }
    async getGISTProof(id) {
        const { didDocument } = await (0, utils_1.resolveDidDocument)(js_iden3_core_custom_1.DID.parseFromId(js_iden3_core_custom_1.Id.fromBigInt(id)), this.resolverUrl);
        const { global } = this.getIden3StateInfo2023(didDocument);
        if (!global) {
            throw new Error('GIST root not found');
        }
        const { proof } = global;
        if (!proof) {
            throw new Error('GIST proof not found');
        }
        return {
            root: global.root,
            existence: proof.existence,
            siblings: proof.siblings?.map((sibling) => BigInt(sibling)),
            index: BigInt(0),
            value: BigInt(0),
            auxExistence: !!proof.node_aux,
            auxIndex: proof.node_aux ? BigInt(proof.node_aux.key) : BigInt(0),
            auxValue: proof.node_aux ? BigInt(proof.node_aux.value) : BigInt(0)
        };
    }
    async getGISTRootInfo(root, userId) {
        const { didDocument } = await (0, utils_1.resolveDidDocument)(js_iden3_core_custom_1.DID.parseFromId(js_iden3_core_custom_1.Id.fromBigInt(userId)), this.resolverUrl, {
            gist: js_merkletree_1.Hash.fromBigInt(root)
        });
        const { global } = this.getIden3StateInfo2023(didDocument);
        if (!global) {
            throw new Error('GIST root not found');
        }
        return global;
    }
    getRpcProvider() {
        return new ethers_1.JsonRpcProvider();
    }
    publishState() {
        throw new Error('publishState method not implemented.');
    }
    publishStateGeneric() {
        throw new Error('publishStateGeneric method not implemented.');
    }
    async getStateInfo(id, state) {
        const opts = state ? { state: js_merkletree_1.Hash.fromBigInt(state) } : undefined;
        const { didDocument } = await (0, utils_1.resolveDidDocument)(js_iden3_core_custom_1.DID.parseFromId(js_iden3_core_custom_1.Id.fromBigInt(id)), this.resolverUrl, opts);
        const { info } = this.getIden3StateInfo2023(didDocument);
        return { ...info };
    }
    getIden3StateInfo2023(didDocument) {
        const vm = didDocument.verificationMethod?.find((i) => i.type === 'Iden3StateInfo2023');
        if (!vm) {
            throw new Error('Iden3StateInfo2023 verification method not found');
        }
        return vm;
    }
}
exports.DidResolverStateReadonlyStorage = DidResolverStateReadonlyStorage;
