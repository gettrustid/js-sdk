"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BJJSignatureProof2021 = exports.Iden3SparseMerkleTreeProof = void 0;
const js_merkletree_1 = require("@iden3/js-merkletree");
const constants_1 = require("./constants");
const js_crypto_1 = require("@iden3/js-crypto");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
/**
 * Iden3SparseMerkleProof is a iden3 protocol merkle tree proof
 *
 * @public
 * @class Iden3SparseMerkleTreeProof
 */
class Iden3SparseMerkleTreeProof {
    /**
     * Creates an instance of Iden3SparseMerkleTreeProof.
     * @param {object} obj
     */
    constructor(obj) {
        this.coreClaim = obj.coreClaim;
        this.issuerData = obj.issuerData;
        this.type = constants_1.ProofType.Iden3SparseMerkleTreeProof;
        this.mtp = obj.mtp;
    }
    /**
     *
     *
     * @returns `json object in serialized presentation`
     */
    toJSON() {
        const issuerId = this.issuerData.id;
        return {
            issuerData: {
                id: issuerId.string(),
                state: {
                    ...this.issuerData.state,
                    rootOfRoots: this.issuerData.state.rootOfRoots.hex(),
                    claimsTreeRoot: this.issuerData.state.claimsTreeRoot.hex(),
                    revocationTreeRoot: this.issuerData.state.revocationTreeRoot.hex(),
                    value: this.issuerData.state.value.hex()
                }
            },
            type: this.type,
            coreClaim: this.coreClaim.hex(),
            mtp: this.mtp.toJSON()
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromJSON(obj) {
        let mtp;
        if (obj?.mtp?.notEmpties && obj?.mtp?.depth && obj?.mtp?.siblings) {
            // legacy
            const ne = obj?.mtp?.notEmpties;
            const notEmpties = ne instanceof Uint8Array ? ne : new Uint8Array(Object.values(ne));
            const siblingsHashes = obj?.mtp?.siblings.map((h) => js_merkletree_1.Hash.fromString(JSON.stringify(h)));
            const allSiblings = js_merkletree_1.Proof.buildAllSiblings(obj?.mtp?.depth, notEmpties, siblingsHashes);
            let nodeAux = obj.mtp.nodeAux || obj.mtp.node_aux;
            if (nodeAux) {
                nodeAux = {
                    key: js_merkletree_1.Hash.fromString(JSON.stringify(nodeAux.key)),
                    value: js_merkletree_1.Hash.fromString(JSON.stringify(nodeAux.value))
                };
            }
            mtp = new js_merkletree_1.Proof({ existence: obj?.mtp.existence, nodeAux: nodeAux, siblings: allSiblings });
        }
        else {
            mtp = js_merkletree_1.Proof.fromJSON(obj.mtp);
        }
        return new Iden3SparseMerkleTreeProof({
            coreClaim: new js_iden3_core_custom_1.Claim().fromHex(obj.coreClaim),
            mtp,
            issuerData: {
                id: js_iden3_core_custom_1.DID.parse(obj.issuerData.id),
                state: {
                    ...obj.issuerData.state,
                    rootOfRoots: js_merkletree_1.Hash.fromHex(obj.issuerData.state.rootOfRoots),
                    claimsTreeRoot: js_merkletree_1.Hash.fromHex(obj.issuerData.state.claimsTreeRoot),
                    revocationTreeRoot: js_merkletree_1.Hash.fromHex(obj.issuerData.state.revocationTreeRoot),
                    value: js_merkletree_1.Hash.fromHex(obj.issuerData.state.value)
                }
            }
        });
    }
}
exports.Iden3SparseMerkleTreeProof = Iden3SparseMerkleTreeProof;
/**
 *
 * BJJSignatureProof2021 is a signature of core claim by BJJ key
 * @public
 * @class BJJSignatureProof2021
 */
class BJJSignatureProof2021 {
    constructor(obj) {
        this.type = constants_1.ProofType.BJJSignature;
        this.issuerData = obj.issuerData;
        this.coreClaim = obj.coreClaim;
        this.signature = obj.signature;
    }
    /**
     * toJSON is a method to serialize BJJSignatureProof2021 to json
     *
     * @returns `json object in serialized presentation`
     */
    toJSON() {
        return {
            issuerData: {
                id: this.issuerData.id.string(),
                state: {
                    ...this.issuerData.state,
                    rootOfRoots: this.issuerData.state.rootOfRoots.hex(),
                    claimsTreeRoot: this.issuerData.state.claimsTreeRoot.hex(),
                    revocationTreeRoot: this.issuerData.state.revocationTreeRoot.hex(),
                    value: this.issuerData.state.value.hex()
                },
                mtp: this.issuerData.mtp.toJSON(),
                authCoreClaim: this.issuerData.authCoreClaim.hex(),
                credentialStatus: this.issuerData.credentialStatus
            },
            type: this.type,
            coreClaim: this.coreClaim.hex(),
            signature: js_crypto_1.Hex.encodeString(this.signature.compress())
        };
    }
    /**
     * fromJSON is a method to deserialize BJJSignatureProof2021 from json
     * @param obj
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromJSON(obj) {
        return new BJJSignatureProof2021({
            issuerData: {
                id: js_iden3_core_custom_1.DID.parse(obj.issuerData.id),
                mtp: js_merkletree_1.Proof.fromJSON(obj.issuerData.mtp),
                state: {
                    ...obj.issuerData.state,
                    rootOfRoots: js_merkletree_1.Hash.fromHex(obj.issuerData.state.rootOfRoots),
                    claimsTreeRoot: js_merkletree_1.Hash.fromHex(obj.issuerData.state.claimsTreeRoot),
                    revocationTreeRoot: js_merkletree_1.Hash.fromHex(obj.issuerData.state.revocationTreeRoot),
                    value: js_merkletree_1.Hash.fromHex(obj.issuerData.state.value)
                },
                credentialStatus: obj.issuerData.credentialStatus,
                authCoreClaim: new js_iden3_core_custom_1.Claim().fromHex(obj.issuerData.authCoreClaim)
            },
            coreClaim: new js_iden3_core_custom_1.Claim().fromHex(obj.coreClaim),
            signature: js_crypto_1.Signature.newFromCompressed(Uint8Array.from(js_crypto_1.Hex.decodeString(obj.signature)).slice(0, 64))
        });
    }
}
exports.BJJSignatureProof2021 = BJJSignatureProof2021;
