import { Hex } from '@iden3/js-crypto';
import { Id, buildDIDType, genesisFromEthAddress, DID } from 'js-iden3-core-custom';
import { Hash } from '@iden3/js-merkletree';
import { keccak256 } from 'js-sha3';
import { hexToBytes } from './encoding';
/**
 * Supported DID Document Signatures
 */
export var DIDDocumentSignature;
(function (DIDDocumentSignature) {
    DIDDocumentSignature["EthereumEip712Signature2021"] = "EthereumEip712Signature2021";
})(DIDDocumentSignature || (DIDDocumentSignature = {}));
/**
 * Checks if state is genesis state
 *
 * @param {DID} did - did
 * @param {bigint|string} state  - hash on bigInt or hex string format
 * @returns boolean
 */
export function isGenesisState(did, state) {
    if (typeof state === 'string') {
        state = Hash.fromHex(state).bigInt();
    }
    const id = DID.idFromDID(did);
    const { method, blockchain, networkId } = DID.decodePartsFromId(id);
    const type = buildDIDType(method, blockchain, networkId);
    const idFromState = Id.idGenesisFromIdenState(type, state);
    return id.bigInt().toString() === idFromState.bigInt().toString();
}
/**
 * Checks if DID is an ethereum identity
 *
 * @param {DID} did - did
 * @returns boolean
 */
export function isEthereumIdentity(did) {
    const issuerId = DID.idFromDID(did);
    try {
        Id.ethAddressFromId(issuerId);
        // is an ethereum identity
        return true;
    }
    catch {
        // not an ethereum identity (BabyJubJub or other)
        return false;
    }
}
export const buildVerifierId = (address, info) => {
    address = address.replace('0x', '');
    const ethAddrBytes = Hex.decodeString(address);
    const ethAddr = ethAddrBytes.slice(0, 20);
    const genesis = genesisFromEthAddress(ethAddr);
    const tp = buildDIDType(info.method, info.blockchain, info.networkId);
    return new Id(tp, genesis);
};
export const validateDIDDocumentAuth = async (did, resolverURL, state) => {
    const vm = await resolveDIDDocumentAuth(did, resolverURL, state);
    if (!vm) {
        throw new Error(`can't resolve DID document`);
    }
    // published or genesis
    if (!vm.published &&
        !isGenesisState(did, state.bigInt())) {
        throw new Error(`issuer state not published and not genesis`);
    }
};
export const resolveDIDDocumentAuth = async (did, resolveURL, state) => {
    let url = `${resolveURL}/${encodeURIComponent(did.string())}`;
    if (state) {
        url += `?state=${state.hex()}`;
    }
    const resp = await fetch(url);
    const didResolutionRes = (await resp.json());
    return didResolutionRes.didDocument?.verificationMethod?.find((i) => i.type === 'Iden3StateInfo2023');
};
function emptyStateDID(did) {
    const id = DID.idFromDID(did);
    const didType = buildDIDType(DID.methodFromId(id), DID.blockchainFromId(id), DID.networkIdFromId(id));
    const identifier = Id.idGenesisFromIdenState(didType, 0n);
    const emptyDID = DID.parseFromId(identifier);
    return emptyDID;
}
export const resolveDidDocument = async (did, resolverUrl, opts) => {
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
export const buildDIDFromEthPubKey = (didType, pubKeyEth) => {
    // Use Keccak-256 hash function to get public key hash
    const hashOfPublicKey = keccak256(hexToBytes(pubKeyEth));
    // Convert hash to buffer
    const ethAddressBuffer = hexToBytes(hashOfPublicKey);
    // Ethereum Address is '0x' concatenated with last 20 bytes
    // of the public key hash
    const ethAddr = ethAddressBuffer.slice(-20);
    const genesis = genesisFromEthAddress(ethAddr);
    const identifier = new Id(didType, genesis);
    return DID.parseFromId(identifier);
};
