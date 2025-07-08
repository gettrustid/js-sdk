"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareZkpProof = exports.packZkpProof = void 0;
const ethers_1 = require("ethers");
const packZkpProof = (inputs, a, b, c) => {
    return new ethers_1.ethers.AbiCoder().encode(['uint256[] inputs', 'uint256[2]', 'uint256[2][2]', 'uint256[2]'], [inputs, a, b, c]);
};
exports.packZkpProof = packZkpProof;
const prepareZkpProof = (proof) => {
    return {
        a: proof.pi_a.slice(0, 2),
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        c: proof.pi_c.slice(0, 2)
    };
};
exports.prepareZkpProof = prepareZkpProof;
