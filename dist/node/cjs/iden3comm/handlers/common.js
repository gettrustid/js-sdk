"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyExpiresTime = exports.packMetadatas = exports.calcChallengeAuthV2 = exports.processProofResponse = exports.processProofAuth = exports.processZeroKnowledgeProofRequests = void 0;
const js_crypto_1 = require("@iden3/js-crypto");
const types_1 = require("../types");
const utils_1 = require("../../utils");
const verifiable_1 = require("../../verifiable");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const constants_1 = require("../constants");
const ethers_1 = require("ethers");
const common_1 = require("../../storage/blockchain/common");
/**
 * Groups the ZeroKnowledgeProofRequest objects based on their groupId.
 * Returns a Map where the key is the groupId and the value is an object containing the query and linkNonce.
 *
 * @param requestScope - An array of ZeroKnowledgeProofRequest objects.
 * @returns A Map<number, { query: ZeroKnowledgeProofQuery; linkNonce: number }> representing the grouped queries.
 */
const getGroupedQueries = (requestScope) => requestScope.reduce((acc, proofReq) => {
    const groupId = proofReq.query.groupId;
    if (!groupId) {
        return acc;
    }
    const existedData = acc.get(groupId);
    if (!existedData) {
        const seed = (0, js_crypto_1.getRandomBytes)(12);
        const dataView = new DataView(seed.buffer);
        const linkNonce = dataView.getUint32(0);
        acc.set(groupId, { query: proofReq.query, linkNonce });
        return acc;
    }
    const credentialSubject = (0, utils_1.mergeObjects)(existedData.query.credentialSubject, proofReq.query.credentialSubject);
    acc.set(groupId, {
        ...existedData,
        query: {
            skipClaimRevocationCheck: existedData.query.skipClaimRevocationCheck || proofReq.query.skipClaimRevocationCheck,
            ...existedData.query,
            credentialSubject
        }
    });
    return acc;
}, new Map());
/**
 * Processes zero knowledge proof requests.
 *
 * @param to - The identifier of the recipient.
 * @param requests - An array of zero knowledge proof requests.
 * @param from - The identifier of the sender.
 * @param proofService - The proof service.
 * @param opts - Additional options for processing the requests.
 * @returns A promise that resolves to an array of zero knowledge proof responses.
 */
const processZeroKnowledgeProofRequests = async (to, requests, from, proofService, opts) => {
    const requestScope = requests ?? [];
    const combinedQueries = getGroupedQueries(requestScope);
    const groupedCredentialsCache = new Map();
    const zkpResponses = [];
    for (const proofReq of requestScope) {
        let zkpRes;
        try {
            const isCircuitSupported = opts.supportedCircuits.includes(proofReq.circuitId);
            if (!isCircuitSupported) {
                if (proofReq.optional) {
                    continue;
                }
                throw new Error(`Circuit ${proofReq.circuitId} is not allowed`);
            }
            const query = proofReq.query;
            const groupId = query.groupId;
            const combinedQueryData = combinedQueries.get(groupId);
            if (groupId) {
                if (!combinedQueryData) {
                    throw new Error(`Invalid group id ${query.groupId}`);
                }
                const combinedQuery = combinedQueryData.query;
                if (!groupedCredentialsCache.has(groupId)) {
                    const credWithRevStatus = await proofService.findCredentialByProofQuery(to, combinedQueryData.query);
                    if (!credWithRevStatus.cred) {
                        if (proofReq.optional) {
                            continue;
                        }
                        throw new Error(verifiable_1.VerifiableConstants.ERRORS.PROOF_SERVICE_NO_CREDENTIAL_FOR_QUERY +
                            `${JSON.stringify(combinedQuery)}`);
                    }
                    groupedCredentialsCache.set(groupId, credWithRevStatus);
                }
            }
            const credWithRevStatus = groupedCredentialsCache.get(groupId);
            zkpRes = await proofService.generateProof(proofReq, to, {
                verifierDid: from,
                challenge: opts.challenge,
                skipRevocation: Boolean(query.skipClaimRevocationCheck),
                credential: credWithRevStatus?.cred,
                credentialRevocationStatus: credWithRevStatus?.revStatus,
                linkNonce: combinedQueryData?.linkNonce ? BigInt(combinedQueryData.linkNonce) : undefined
            });
        }
        catch (error) {
            const expectedErrors = [
                verifiable_1.VerifiableConstants.ERRORS.PROOF_SERVICE_NO_CREDENTIAL_FOR_IDENTITY_OR_PROFILE,
                verifiable_1.VerifiableConstants.ERRORS.ID_WALLET_NO_CREDENTIAL_SATISFIED_QUERY,
                verifiable_1.VerifiableConstants.ERRORS.CREDENTIAL_WALLET_ALL_CREDENTIALS_ARE_REVOKED
            ];
            // handle only errors in case credential is not found and it is optional proof request - otherwise throw
            if (error instanceof Error &&
                (expectedErrors.includes(error.message) ||
                    error.message.includes(verifiable_1.VerifiableConstants.ERRORS.PROOF_SERVICE_NO_CREDENTIAL_FOR_QUERY)) &&
                proofReq.optional) {
                continue;
            }
            throw error;
        }
        zkpResponses.push(zkpRes);
    }
    return zkpResponses;
};
exports.processZeroKnowledgeProofRequests = processZeroKnowledgeProofRequests;
/**
 * Processes auth proof requests.
 *
 * @param to - The identifier of the recipient.
 * @param proofService - The proof service.
 * @param opts - Additional options for processing the requests.
 * @returns A promise that resolves to an auth proof response.
 */
const processProofAuth = async (to, proofService, opts) => {
    if (!opts.acceptProfile) {
        opts.acceptProfile = constants_1.defaultAcceptProfile;
    }
    switch (opts.acceptProfile.env) {
        case constants_1.MediaType.ZKPMessage:
            if (!opts.acceptProfile.circuits) {
                throw new Error('Circuit not specified in accept profile');
            }
            for (const circuitId of opts.acceptProfile.circuits) {
                if (!opts.supportedCircuits.includes(circuitId)) {
                    throw new Error(`Circuit ${circuitId} is not supported`);
                }
                if (!opts.senderAddress) {
                    throw new Error('Sender address is not provided');
                }
                const challengeAuth = (0, exports.calcChallengeAuthV2)(opts.senderAddress, opts.zkpResponses);
                const zkpRes = await proofService.generateAuthProof(circuitId, to, { challenge: challengeAuth });
                return {
                    authProof: {
                        authMethod: types_1.AuthMethod.AUTHV2,
                        zkp: zkpRes
                    }
                };
            }
            throw new Error(`Auth method is not supported`);
        case constants_1.MediaType.SignedMessage:
            if (!opts.acceptProfile.alg || opts.acceptProfile.alg.length === 0) {
                throw new Error('Algorithm not specified');
            }
            if (opts.acceptProfile.alg[0] === constants_1.AcceptJwsAlgorithms.ES256KR) {
                return {
                    authProof: {
                        authMethod: types_1.AuthMethod.ETH_IDENTITY,
                        userDid: to
                    }
                };
            }
            throw new Error(`Algorithm ${opts.acceptProfile.alg[0]} not supported`);
        default:
            throw new Error('Accept env not supported');
    }
};
exports.processProofAuth = processProofAuth;
/**
 * Processes a ZeroKnowledgeProofResponse object and prepares it for further use.
 * @param zkProof - The ZeroKnowledgeProofResponse object containing the proof data.
 * @returns An object containing the requestId, zkProofEncoded, and metadata.
 */
const processProofResponse = (zkProof) => {
    const requestId = zkProof.id;
    const inputs = zkProof.pub_signals;
    const emptyBytes = '0x';
    if (inputs.length === 0) {
        return { requestId, zkProofEncoded: emptyBytes, metadata: emptyBytes };
    }
    const preparedZkpProof = (0, common_1.prepareZkpProof)(zkProof.proof);
    const zkProofEncoded = (0, common_1.packZkpProof)(inputs, preparedZkpProof.a, preparedZkpProof.b, preparedZkpProof.c);
    const metadata = emptyBytes;
    return { requestId, zkProofEncoded, metadata };
};
exports.processProofResponse = processProofResponse;
/**
 * Calculates the challenge authentication V2 value.
 * @param senderAddress - The address of the sender.
 * @param zkpResponses - An array of ZeroKnowledgeProofResponse objects.
 * @returns A bigint representing the challenge authentication value.
 */
const calcChallengeAuthV2 = (senderAddress, zkpResponses) => {
    const responses = zkpResponses.map((zkpResponse) => {
        const response = (0, exports.processProofResponse)(zkpResponse);
        return {
            requestId: response.requestId,
            proof: response.zkProofEncoded,
            metadata: response.metadata
        };
    });
    return (BigInt(ethers_1.ethers.keccak256(new ethers_1.ethers.AbiCoder().encode(['address', '(uint256 requestId,bytes proof,bytes metadata)[]'], [senderAddress, responses]))) & BigInt('0x0fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'));
};
exports.calcChallengeAuthV2 = calcChallengeAuthV2;
/**
 * Packs metadata into a string format suitable for encoding in a transaction.
 * @param metas - An array of objects containing key-value pairs to be packed.
 * @returns A string representing the packed metadata.
 */
const packMetadatas = (metas) => {
    return new ethers_1.ethers.AbiCoder().encode(['tuple(' + 'string key,' + 'bytes value' + ')[]'], [metas]);
};
exports.packMetadatas = packMetadatas;
/**
 * Verifies that the expires_time field of a message is not in the past. Throws an error if it is.
 *
 * @param message - Basic message to verify.
 */
const verifyExpiresTime = (message) => {
    if (message?.expires_time && message.expires_time < (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date())) {
        throw new Error('Message expired');
    }
};
exports.verifyExpiresTime = verifyExpiresTime;
