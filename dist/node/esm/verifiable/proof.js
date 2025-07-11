import { Hash, Proof } from '@iden3/js-merkletree';
import { ProofType } from './constants';
import { Hex, Signature } from '@iden3/js-crypto';
import { Claim, DID } from 'js-iden3-core-custom';
/**
 * Iden3SparseMerkleProof is a iden3 protocol merkle tree proof
 *
 * @public
 * @class Iden3SparseMerkleTreeProof
 */
export class Iden3SparseMerkleTreeProof {
    /**
     * Creates an instance of Iden3SparseMerkleTreeProof.
     * @param {object} obj
     */
    constructor(obj) {
        this.coreClaim = obj.coreClaim;
        this.issuerData = obj.issuerData;
        this.type = ProofType.Iden3SparseMerkleTreeProof;
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
            const siblingsHashes = obj?.mtp?.siblings.map((h) => Hash.fromString(JSON.stringify(h)));
            const allSiblings = Proof.buildAllSiblings(obj?.mtp?.depth, notEmpties, siblingsHashes);
            let nodeAux = obj.mtp.nodeAux || obj.mtp.node_aux;
            if (nodeAux) {
                nodeAux = {
                    key: Hash.fromString(JSON.stringify(nodeAux.key)),
                    value: Hash.fromString(JSON.stringify(nodeAux.value))
                };
            }
            mtp = new Proof({ existence: obj?.mtp.existence, nodeAux: nodeAux, siblings: allSiblings });
        }
        else {
            mtp = Proof.fromJSON(obj.mtp);
        }
        return new Iden3SparseMerkleTreeProof({
            coreClaim: new Claim().fromHex(obj.coreClaim),
            mtp,
            issuerData: {
                id: DID.parse(obj.issuerData.id),
                state: {
                    ...obj.issuerData.state,
                    rootOfRoots: Hash.fromHex(obj.issuerData.state.rootOfRoots),
                    claimsTreeRoot: Hash.fromHex(obj.issuerData.state.claimsTreeRoot),
                    revocationTreeRoot: Hash.fromHex(obj.issuerData.state.revocationTreeRoot),
                    value: Hash.fromHex(obj.issuerData.state.value)
                }
            }
        });
    }
}
/**
 *
 * BJJSignatureProof2021 is a signature of core claim by BJJ key
 * @public
 * @class BJJSignatureProof2021
 */
export class BJJSignatureProof2021 {
    constructor(obj) {
        this.type = ProofType.BJJSignature;
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
            signature: Hex.encodeString(this.signature.compress())
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
                id: DID.parse(obj.issuerData.id),
                mtp: Proof.fromJSON(obj.issuerData.mtp),
                state: {
                    ...obj.issuerData.state,
                    rootOfRoots: Hash.fromHex(obj.issuerData.state.rootOfRoots),
                    claimsTreeRoot: Hash.fromHex(obj.issuerData.state.claimsTreeRoot),
                    revocationTreeRoot: Hash.fromHex(obj.issuerData.state.revocationTreeRoot),
                    value: Hash.fromHex(obj.issuerData.state.value)
                },
                credentialStatus: obj.issuerData.credentialStatus,
                authCoreClaim: new Claim().fromHex(obj.issuerData.authCoreClaim)
            },
            coreClaim: new Claim().fromHex(obj.coreClaim),
            signature: Signature.newFromCompressed(Uint8Array.from(Hex.decodeString(obj.signature)).slice(0, 64))
        });
    }
}
