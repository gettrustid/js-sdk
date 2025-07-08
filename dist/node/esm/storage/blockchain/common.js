import { ethers } from 'ethers';
export const packZkpProof = (inputs, a, b, c) => {
    return new ethers.AbiCoder().encode(['uint256[] inputs', 'uint256[2]', 'uint256[2][2]', 'uint256[2]'], [inputs, a, b, c]);
};
export const prepareZkpProof = (proof) => {
    return {
        a: proof.pi_a.slice(0, 2),
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        c: proof.pi_c.slice(0, 2)
    };
};
