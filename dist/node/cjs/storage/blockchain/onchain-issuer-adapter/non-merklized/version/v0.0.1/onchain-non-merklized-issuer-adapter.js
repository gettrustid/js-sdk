"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnchainNonMerklizedIssuerAdapter = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const onchain_non_merklized_issuer_base_abi_1 = require("@iden3/onchain-non-merklized-issuer-base-abi");
const verifiable_1 = require("../../../../../../verifiable");
const js_jsonld_merklization_1 = require("@iden3/js-jsonld-merklization");
const circuits_1 = require("../../../../../../circuits");
const js_merkletree_1 = require("@iden3/js-merkletree");
const ethers_1 = require("ethers");
const js_iden3_core_custom_2 = require("js-iden3-core-custom");
var NonMerklizedIssuerInterfaces;
(function (NonMerklizedIssuerInterfaces) {
    NonMerklizedIssuerInterfaces["InterfaceDetection"] = "0x01ffc9a7";
    NonMerklizedIssuerInterfaces["InterfaceNonMerklizedIssuer"] = "0x58874949";
    NonMerklizedIssuerInterfaces["InterfaceGetCredential"] = "0x5d1ca631";
})(NonMerklizedIssuerInterfaces || (NonMerklizedIssuerInterfaces = {}));
var ValueHashes;
(function (ValueHashes) {
    ValueHashes["BooleanTrue"] = "18586133768512220936620570745912940619677854269274689475585506675881198879027";
    ValueHashes["BooleanFalse"] = "19014214495641488759237505126948346942972912379615652741039992445865937985820";
})(ValueHashes || (ValueHashes = {}));
/**
 * `OnchainNonMerklizedIssuerAdapter` provides functionality to interact with a non-merklized on-chain credential issuer.
 * This adapter enables interface detection, credential retrieval, and conversion to the W3C Verifiable Credential format.
 *
 * @public
 * @beta
 * @class OnchainNonMerklizedIssuerAdapter
 */
class OnchainNonMerklizedIssuerAdapter {
    /**
     * Initializes an instance of `OnchainNonMerklizedIssuerAdapter`.
     *
     * @param ethConnectionConfig The configuration for the Ethereum connection.
     * @param issuerDid The decentralized identifier (DID) of the issuer.
     * @param merklizationOptions Optional settings for merklization.
     */
    constructor(ethConnectionConfig, issuerDid, options) {
        if (!ethConnectionConfig.chainId) {
            throw new Error('Chain ID is required');
        }
        this._chainId = ethConnectionConfig.chainId;
        this._contractAddress = ethers_1.ethers.getAddress(ethers_1.ethers.hexlify(js_iden3_core_custom_1.Id.ethAddressFromId(js_iden3_core_custom_1.DID.idFromDID(issuerDid))));
        this._contract = onchain_non_merklized_issuer_base_abi_1.NonMerklizedIssuerBase__factory.connect(this._contractAddress, new ethers_1.ethers.JsonRpcProvider(ethConnectionConfig.url));
        this._issuerDid = issuerDid;
        this._merklizationOptions = options?.merklizationOptions;
    }
    /**
     * Checks if the contract supports required interfaces.
     * Throws an error if any required interface is unsupported.
     *
     * @throws Error - If required interfaces are not supported.
     */
    async isInterfaceSupported() {
        const supportedInterfaces = [
            {
                name: 'Interface detection ERC-165',
                value: NonMerklizedIssuerInterfaces.InterfaceDetection
            },
            {
                name: 'Interface non-merklized issuer',
                value: NonMerklizedIssuerInterfaces.InterfaceNonMerklizedIssuer
            },
            {
                name: 'Interface get credential',
                value: NonMerklizedIssuerInterfaces.InterfaceGetCredential
            }
        ];
        const unsupportedInterfaces = await Promise.all(supportedInterfaces.map(async (interfaceObj) => {
            const isSupported = await this._contract.supportsInterface(interfaceObj.value);
            return isSupported ? null : interfaceObj.name;
        }));
        const unsupportedInterfacesFiltered = unsupportedInterfaces.filter((interfaceName) => interfaceName !== null);
        if (unsupportedInterfacesFiltered.length > 0) {
            throw new Error(`Unsupported interfaces: ${unsupportedInterfacesFiltered.join(', ')}`);
        }
    }
    /**
     * Retrieves a credential from the on-chain non-merklized contract.
     * @param userId The user's core.Id.
     * @param credentialId The unique identifier of the credential.
     */
    async getCredential(userId, credentialId) {
        const [credentialData, coreClaimBigInts, credentialSubjectFields] = await this._contract.getCredential(userId.bigInt(), credentialId);
        return { credentialData, coreClaimBigInts, credentialSubjectFields };
    }
    /**
     * Retrieves the credential IDs of a user.
     * @param userId The user's core.Id.
     * @returns An array of credential IDs.
     */
    async getUserCredentialsIds(userId) {
        return this._contract.getUserCredentialIds(userId.bigInt());
    }
    /**
     * Converts on-chain credential to a verifiable credential.
     *
     * @param credentialData Data structure of the credential from the contract.
     * @param coreClaimBigInts Claim data in bigint format.
     * @param credentialSubjectFields Subject fields of the credential.
     */
    async convertOnChainInfoToW3CCredential(credentialData, coreClaimBigInts, credentialSubjectFields) {
        const c = new js_iden3_core_custom_1.Claim().unMarshalJson(JSON.stringify(coreClaimBigInts.map((b) => b.toString())));
        const credentialSubject = await this.convertCredentialSubject(c, credentialData.context, credentialData._type, credentialSubjectFields);
        const credentialRequest = {
            id: this.credentialId(credentialData.id),
            credentialSchema: credentialData.credentialSchema.id,
            type: credentialData._type,
            credentialSubject: credentialSubject,
            expiration: c.getExpirationDate()?.getTime(),
            displayMethod: this.convertDisplayMethod(credentialData.displayMethod),
            context: credentialData.context,
            revocationOpts: {
                id: this._contractAddress,
                nonce: Number(c.getRevocationNonce()),
                type: verifiable_1.CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023
            },
            issuanceDate: (0, js_iden3_core_custom_2.getDateFromUnixTimestamp)(Number(credentialData.issuanceDate)).getTime()
        };
        const existenceProof = await this.existenceProof(c);
        const w3c = verifiable_1.W3CCredential.fromCredentialRequest(this._issuerDid, credentialRequest);
        w3c.proof = [existenceProof];
        return w3c;
    }
    credentialId(id) {
        return `urn:iden3:onchain:${this._chainId}:${this._contractAddress}:${id}`;
    }
    async convertCredentialSubject(coreClaim, contractContexts, credentialType, credentialSubjectFields) {
        const contractContextsStr = JSON.stringify({
            '@context': contractContexts
        });
        const credentialSubject = {};
        for (const f of credentialSubjectFields) {
            const dataType = await js_jsonld_merklization_1.Path.newTypeFromContext(contractContextsStr, `${credentialType}.${f.key}`, this._merklizationOptions);
            switch (dataType) {
                case circuits_1.XSDNS.Boolean: {
                    switch (f.rawValue.toString()) {
                        case ValueHashes.BooleanTrue:
                            credentialSubject[f.key] = true;
                            break;
                        case ValueHashes.BooleanFalse:
                            credentialSubject[f.key] = false;
                            break;
                    }
                    break;
                }
                case (circuits_1.XSDNS.NonNegativeInteger,
                    circuits_1.XSDNS.NonPositiveInteger,
                    circuits_1.XSDNS.NegativeInteger,
                    circuits_1.XSDNS.PositiveInteger):
                    {
                        credentialSubject[f.key] = f.value.toString();
                        break;
                    }
                case circuits_1.XSDNS.Integer: {
                    credentialSubject[f.key] = Number(f.value);
                    break;
                }
                case circuits_1.XSDNS.String: {
                    this.validateSourceValue(dataType, f.value, f.rawValue);
                    credentialSubject[f.key] = f.rawValue;
                    break;
                }
                case circuits_1.XSDNS.DateTime: {
                    const timestamp = BigInt(f.rawValue);
                    const sourceTimestamp = (0, js_iden3_core_custom_2.getDateFromUnixTimestamp)(Number(timestamp)).toISOString();
                    this.validateSourceValue(dataType, f.value, sourceTimestamp);
                    credentialSubject[f.key] = sourceTimestamp;
                    break;
                }
                case circuits_1.XSDNS.Double: {
                    const rawFloat = Number(f.rawValue);
                    this.validateSourceValue(dataType, f.value, rawFloat);
                    credentialSubject[f.key] = rawFloat;
                    break;
                }
                default: {
                    throw new Error(`Unsupported data type ${dataType}`);
                }
            }
        }
        credentialSubject['type'] = credentialType;
        const subjectId = coreClaim.getId();
        const subjectDid = js_iden3_core_custom_1.DID.parseFromId(subjectId);
        credentialSubject['id'] = subjectDid.string();
        return credentialSubject;
    }
    async existenceProof(coreClaim) {
        const [mtpProof, stateInfo] = await this._contract.getClaimProofWithStateInfo(coreClaim.hIndex());
        if (!mtpProof.existence) {
            throw new Error('Claim does not exist');
        }
        const latestStateHash = js_merkletree_1.Hash.fromBigInt(stateInfo.state);
        const latestClaimsOfRootHash = js_merkletree_1.Hash.fromBigInt(stateInfo.claimsRoot);
        const latestRevocationOfRootHash = js_merkletree_1.Hash.fromBigInt(stateInfo.revocationsRoot);
        const latestRootsOfRootHash = js_merkletree_1.Hash.fromBigInt(stateInfo.rootsRoot);
        const p = new js_merkletree_1.Proof({
            siblings: mtpProof.siblings.map((s) => js_merkletree_1.Hash.fromBigInt(s)),
            existence: mtpProof.existence,
            nodeAux: mtpProof.auxExistence
                ? {
                    key: js_merkletree_1.Hash.fromBigInt(mtpProof.auxIndex),
                    value: js_merkletree_1.Hash.fromBigInt(mtpProof.auxValue)
                }
                : undefined
        });
        return new verifiable_1.Iden3SparseMerkleTreeProof({
            issuerData: {
                id: this._issuerDid,
                state: {
                    value: latestStateHash,
                    claimsTreeRoot: latestClaimsOfRootHash,
                    revocationTreeRoot: latestRevocationOfRootHash,
                    rootOfRoots: latestRootsOfRootHash
                }
            },
            mtp: p,
            coreClaim: coreClaim
        });
    }
    async validateSourceValue(dataType, originHash, source) {
        const sourceHash = await js_jsonld_merklization_1.Merklizer.hashValue(dataType, source);
        if (sourceHash !== originHash) {
            throw new Error(`Invalid source value for ${dataType} type`);
        }
    }
    convertDisplayMethod(onchainDisplayMethod) {
        if (!onchainDisplayMethod.id || !onchainDisplayMethod._type) {
            return undefined;
        }
        switch (onchainDisplayMethod._type) {
            case verifiable_1.DisplayMethodType.Iden3BasicDisplayMethodV1: {
                return {
                    id: onchainDisplayMethod.id,
                    type: verifiable_1.DisplayMethodType.Iden3BasicDisplayMethodV1
                };
            }
            default: {
                throw new Error(`Unsupported display method type ${onchainDisplayMethod._type}`);
            }
        }
    }
}
exports.OnchainNonMerklizedIssuerAdapter = OnchainNonMerklizedIssuerAdapter;
