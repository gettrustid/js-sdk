"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDIDFromEthPubKey = exports.resolveDidDocument = exports.resolveDIDDocumentAuth = exports.validateDIDDocumentAuth = exports.buildVerifierId = exports.isEthereumIdentity = exports.isGenesisState = exports.DIDDocumentSignature = void 0;
const js_crypto_1 = require("@iden3/js-crypto");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const js_merkletree_1 = require("@iden3/js-merkletree");
const js_sha3_1 = require("js-sha3");
const encoding_1 = require("./encoding");
/**
 * Supported DID Document Signatures
 */
var DIDDocumentSignature;
(function (DIDDocumentSignature) {
    DIDDocumentSignature["EthereumEip712Signature2021"] = "EthereumEip712Signature2021";
})(DIDDocumentSignature = exports.DIDDocumentSignature || (exports.DIDDocumentSignature = {}));
/**
 * Checks if state is genesis state
 *
 * @param {DID} did - did
 * @param {bigint|string} state  - hash on bigInt or hex string format
 * @returns boolean
 */
function isGenesisState(did, state) {
    if (typeof state === 'string') {
        state = js_merkletree_1.Hash.fromHex(state).bigInt();
    }
    const id = js_iden3_core_custom_1.DID.idFromDID(did);
    const { method, blockchain, networkId } = js_iden3_core_custom_1.DID.decodePartsFromId(id);
    const type = (0, js_iden3_core_custom_1.buildDIDType)(method, blockchain, networkId);
    const idFromState = js_iden3_core_custom_1.Id.idGenesisFromIdenState(type, state);
    return id.bigInt().toString() === idFromState.bigInt().toString();
}
exports.isGenesisState = isGenesisState;
/**
 * Checks if DID is an ethereum identity
 *
 * @param {DID} did - did
 * @returns boolean
 */
function isEthereumIdentity(did) {
    const issuerId = js_iden3_core_custom_1.DID.idFromDID(did);
    try {
        js_iden3_core_custom_1.Id.ethAddressFromId(issuerId);
        // is an ethereum identity
        return true;
    }
    catch {
        // not an ethereum identity (BabyJubJub or other)
        return false;
    }
}
exports.isEthereumIdentity = isEthereumIdentity;
const buildVerifierId = (address, info) => {
    address = address.replace('0x', '');
    const ethAddrBytes = js_crypto_1.Hex.decodeString(address);
    const ethAddr = ethAddrBytes.slice(0, 20);
    const genesis = (0, js_iden3_core_custom_1.genesisFromEthAddress)(ethAddr);
    const tp = (0, js_iden3_core_custom_1.buildDIDType)(info.method, info.blockchain, info.networkId);
    return new js_iden3_core_custom_1.Id(tp, genesis);
};
exports.buildVerifierId = buildVerifierId;
const validateDIDDocumentAuth = async (did, resolverURL, state) => {
    const vm = await (0, exports.resolveDIDDocumentAuth)(did, resolverURL, state);
    if (!vm) {
        throw new Error(`can't resolve DID document`);
    }
    // published or genesis
    if (!vm.published &&
        !isGenesisState(did, state.bigInt())) {
        throw new Error(`issuer state not published and not genesis`);
    }
};
exports.validateDIDDocumentAuth = validateDIDDocumentAuth;
const resolveDIDDocumentAuth = async (did, resolveURL, state) => {
    let url = `${resolveURL}/${encodeURIComponent(did.string())}`;
    if (state) {
        url += `?state=${state.hex()}`;
    }
    const resp = await fetch(url);
    const didResolutionRes = (await resp.json());
    return didResolutionRes.didDocument?.verificationMethod?.find((i) => i.type === 'Iden3StateInfo2023');
};
exports.resolveDIDDocumentAuth = resolveDIDDocumentAuth;
function emptyStateDID(did) {
    const id = js_iden3_core_custom_1.DID.idFromDID(did);
    const didType = (0, js_iden3_core_custom_1.buildDIDType)(js_iden3_core_custom_1.DID.methodFromId(id), js_iden3_core_custom_1.DID.blockchainFromId(id), js_iden3_core_custom_1.DID.networkIdFromId(id));
    const identifier = js_iden3_core_custom_1.Id.idGenesisFromIdenState(didType, 0n);
    const emptyDID = js_iden3_core_custom_1.DID.parseFromId(identifier);
    return emptyDID;
}
const resolveDidDocument = async (did, resolverUrl, opts) => {
    let didString = encodeURIComponent(did.string());
    // for gist resolve we have to `hide` user did (look into resolver implementation)
    const isGistRequest = opts?.gist && !opts.state;
    if (isGistRequest) {
        didString = encodeURIComponent(emptyStateDID(did).string());
    }
    let url = `${resolverUrl}/1.0/identifiers/${didString}`;
    if (opts?.signature) {
        url += `?signature=${opts.signature}`;
    }
    if (opts?.state) {
        url += `${url.includes('?') ? '&' : '?'}state=${opts.state.hex()}`;
    }
    if (opts?.gist) {
        url += `${url.includes('?') ? '&' : '?'}gist=${opts.gist.hex()}`;
    }
    try {
        const resp = await fetch(url);
        const data = await resp.json();
        return data;
    }
    catch (e) {
        throw new Error(`Failed to resolve DID document for ${did} ${e}`);
    }
};
exports.resolveDidDocument = resolveDidDocument;
const buildDIDFromEthPubKey = (didType, pubKeyEth) => {
    // Use Keccak-256 hash function to get public key hash
    const hashOfPublicKey = (0, js_sha3_1.keccak256)((0, encoding_1.hexToBytes)(pubKeyEth));
    // Convert hash to buffer
    const ethAddressBuffer = (0, encoding_1.hexToBytes)(hashOfPublicKey);
    // Ethereum Address is '0x' concatenated with last 20 bytes
    // of the public key hash
    const ethAddr = ethAddressBuffer.slice(-20);
    const genesis = (0, js_iden3_core_custom_1.genesisFromEthAddress)(ethAddr);
    const identifier = new js_iden3_core_custom_1.Id(didType, genesis);
    return js_iden3_core_custom_1.DID.parseFromId(identifier);
};
exports.buildDIDFromEthPubKey = buildDIDFromEthPubKey;
