"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getERC20Decimals = exports.getPermitSignature = void 0;
const ethers_1 = require("ethers");
const ERC20Permit_json_1 = __importDefault(require("./abi/ERC20Permit.json"));
const ERC20_json_1 = __importDefault(require("./abi/ERC20.json"));
/**
 * @beta
 * getPermitSignature is a function to create EIP712 Permit signature
 * @param {Signer} signer - User who owns the tokens
 * @param {string} tokenAddress - EIP-2612 contract address
 * @param {string} spender -  The contract address that will spend tokens
 * @param {bigint} value - Amount of tokens to approve
 * @param {number} deadline - Timestamp when the permit expires
 * @returns {Promise<PaymentRequestMessage>}
 */
async function getPermitSignature(signer, tokenAddress, spender, value, deadline) {
    const erc20PermitContract = new ethers_1.Contract(tokenAddress, ERC20Permit_json_1.default, signer);
    const nonce = await erc20PermitContract.nonces(await signer.getAddress());
    const domainData = await erc20PermitContract.eip712Domain();
    const domain = {
        name: domainData[1],
        version: domainData[2],
        chainId: domainData[3],
        verifyingContract: tokenAddress
    };
    const types = {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
        ]
    };
    const message = {
        owner: await signer.getAddress(),
        spender: spender,
        value: value,
        nonce: nonce,
        deadline: deadline
    };
    return signer.signTypedData(domain, types, message);
}
exports.getPermitSignature = getPermitSignature;
/**
 * @beta
 * getERC20Decimals is a function to retrieve the number of decimals of an ERC20 token
 * @param {string} tokenAddress - Token address
 * @param {ethers.ContractRunner} runner - Contract runner
 */
async function getERC20Decimals(tokenAddress, runner) {
    const erc20Contract = new ethers_1.Contract(tokenAddress, ERC20_json_1.default, runner);
    return erc20Contract.decimals();
}
exports.getERC20Decimals = getERC20Decimals;
