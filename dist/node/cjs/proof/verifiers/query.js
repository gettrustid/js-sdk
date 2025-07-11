"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMultiRequestId = exports.calculateRequestId = exports.calculateGroupId = exports.fieldValueFromVerifiablePresentation = exports.validateEmptyCredentialSubjectNoopNativeSupport = exports.validateDisclosureNativeSDSupport = exports.validateDisclosureV2Circuit = exports.validateOperators = exports.validateEmptyCredentialSubjectV2Circuit = exports.verifyFieldValueInclusionNativeExistsSupport = exports.verifyFieldValueInclusionV2 = exports.checkCircuitOperator = exports.checkCircuitQueriesLength = exports.checkQueryRequest = void 0;
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const js_jsonld_merklization_1 = require("@iden3/js-jsonld-merklization");
const utils_1 = require("../../utils");
const comparer_1 = require("../../circuits/comparer");
const verifiable_1 = require("../../verifiable");
const provers_1 = require("../provers");
const ethers_1 = require("ethers");
const defaultProofGenerationDelayOpts = 24 * 60 * 60 * 1000; // 24 hours
async function checkQueryRequest(query, queriesMetadata, ldContext, outputs, circuitId, schemaLoader, opts) {
    // validate issuer
    const userDID = js_iden3_core_custom_1.DID.parseFromId(outputs.issuerId);
    const issuerAllowed = !query.allowedIssuers ||
        query.allowedIssuers?.some((issuer) => issuer === '*' || issuer === userDID.string());
    if (!issuerAllowed) {
        throw new Error('issuer is not in allowed list');
    }
    if (!query.type) {
        throw new Error('query type is missing');
    }
    const schemaId = await js_jsonld_merklization_1.Path.getTypeIDFromContext(JSON.stringify(ldContext), query.type, {
        documentLoader: schemaLoader
    });
    const schemaHash = (0, verifiable_1.calculateCoreSchemaHash)(utils_1.byteEncoder.encode(schemaId));
    if (schemaHash.bigInt() !== outputs.schemaHash.bigInt()) {
        throw new Error(`schema that was used is not equal to requested in query`);
    }
    if (!query.skipClaimRevocationCheck && outputs.isRevocationChecked === 0) {
        throw new Error(`check revocation is required`);
    }
    checkCircuitQueriesLength(circuitId, queriesMetadata);
    // verify timestamp
    let acceptedProofGenerationDelay = defaultProofGenerationDelayOpts;
    if (opts?.acceptedProofGenerationDelay) {
        acceptedProofGenerationDelay = opts.acceptedProofGenerationDelay;
    }
    const timeDiff = Date.now() - (0, js_iden3_core_custom_1.getDateFromUnixTimestamp)(Number(outputs.timestamp)).getTime();
    if (timeDiff > acceptedProofGenerationDelay) {
        throw new Error('generated proof is outdated');
    }
    return;
}
exports.checkQueryRequest = checkQueryRequest;
function checkCircuitQueriesLength(circuitId, queriesMetadata) {
    const circuitValidationData = provers_1.circuitValidator[circuitId];
    if (queriesMetadata.length > circuitValidationData.maxQueriesCount) {
        throw new Error(`circuit ${circuitId} supports only ${provers_1.circuitValidator[circuitId].maxQueriesCount} queries`);
    }
}
exports.checkCircuitQueriesLength = checkCircuitQueriesLength;
function checkCircuitOperator(circuitId, operator) {
    const circuitValidationData = provers_1.circuitValidator[circuitId];
    if (!circuitValidationData.supportedOperations.includes(operator)) {
        throw new Error(`circuit ${circuitId} not support ${(0, comparer_1.getOperatorNameByValue)(operator)} operator`);
    }
}
exports.checkCircuitOperator = checkCircuitOperator;
function verifyFieldValueInclusionV2(outputs, metadata) {
    if (outputs.operator == comparer_1.QueryOperators.$noop) {
        return;
    }
    if (outputs.merklized === 1) {
        if (outputs.claimPathNotExists === 1) {
            throw new Error(`proof doesn't contains target query key`);
        }
        if (outputs.claimPathKey !== metadata.claimPathKey) {
            throw new Error(`proof was generated for another path`);
        }
    }
    else {
        if (outputs.slotIndex !== metadata.slotIndex) {
            throw new Error(`wrong claim slot was used in claim`);
        }
    }
}
exports.verifyFieldValueInclusionV2 = verifyFieldValueInclusionV2;
function verifyFieldValueInclusionNativeExistsSupport(outputs, metadata) {
    if (outputs.operator == comparer_1.Operators.NOOP) {
        return;
    }
    if (outputs.operator === comparer_1.Operators.EXISTS && !outputs.merklized) {
        throw new Error('$exists operator is not supported for non-merklized credential');
    }
    if (outputs.merklized === 1) {
        if (outputs.claimPathKey !== metadata.claimPathKey) {
            throw new Error(`proof was generated for another path`);
        }
    }
    else {
        if (outputs.slotIndex !== metadata.slotIndex) {
            throw new Error(`wrong claim slot was used in claim`);
        }
    }
}
exports.verifyFieldValueInclusionNativeExistsSupport = verifyFieldValueInclusionNativeExistsSupport;
async function validateEmptyCredentialSubjectV2Circuit(cq, outputs) {
    if (outputs.operator !== comparer_1.Operators.EQ) {
        throw new Error('empty credentialSubject request available only for equal operation');
    }
    for (let index = 1; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`empty credentialSubject request not available for array of values`);
        }
    }
    const path = js_jsonld_merklization_1.Path.newPath([verifiable_1.VerifiableConstants.CREDENTIAL_SUBJECT_PATH]);
    const subjectEntry = await path.mtEntry();
    if (outputs.claimPathKey !== subjectEntry) {
        throw new Error(`proof doesn't contain credentialSubject in claimPathKey`);
    }
    return;
}
exports.validateEmptyCredentialSubjectV2Circuit = validateEmptyCredentialSubjectV2Circuit;
async function validateOperators(cq, outputs) {
    if (outputs.operator !== cq.operator) {
        throw new Error(`operator that was used is not equal to request`);
    }
    if (outputs.operator === comparer_1.Operators.NOOP) {
        // for noop operator slot and value are not used in this case
        return;
    }
    for (let index = 0; index < outputs.value.length; index++) {
        if (outputs.value[index] !== cq.values[index]) {
            if (outputs.value[index] === 0n && cq.values[index] === undefined) {
                continue;
            }
            throw new Error(`comparison value that was used is not equal to requested in query`);
        }
    }
}
exports.validateOperators = validateOperators;
async function validateDisclosureV2Circuit(cq, outputs, verifiablePresentation, ldLoader) {
    const bi = await (0, exports.fieldValueFromVerifiablePresentation)(cq.fieldName, verifiablePresentation, ldLoader);
    if (bi !== outputs.value[0]) {
        throw new Error(`value that was used is not equal to requested in query`);
    }
    if (outputs.operator !== comparer_1.Operators.EQ) {
        throw new Error(`operator for selective disclosure must be $eq`);
    }
    for (let index = 1; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`selective disclosure not available for array of values`);
        }
    }
}
exports.validateDisclosureV2Circuit = validateDisclosureV2Circuit;
async function validateDisclosureNativeSDSupport(cq, outputs, verifiablePresentation, ldLoader) {
    const bi = await (0, exports.fieldValueFromVerifiablePresentation)(cq.fieldName, verifiablePresentation, ldLoader);
    if (bi !== outputs.operatorOutput) {
        throw new Error(`operator output should be equal to disclosed value`);
    }
    if (outputs.operator !== comparer_1.Operators.SD) {
        throw new Error(`operator for selective disclosure must be $sd`);
    }
    for (let index = 0; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`public signal values must be zero`);
        }
    }
}
exports.validateDisclosureNativeSDSupport = validateDisclosureNativeSDSupport;
async function validateEmptyCredentialSubjectNoopNativeSupport(outputs) {
    if (outputs.operator !== comparer_1.Operators.NOOP) {
        throw new Error('empty credentialSubject request available only for $noop operation');
    }
    for (let index = 1; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`empty credentialSubject request not available for array of values`);
        }
    }
}
exports.validateEmptyCredentialSubjectNoopNativeSupport = validateEmptyCredentialSubjectNoopNativeSupport;
const fieldValueFromVerifiablePresentation = async (fieldName, verifiablePresentation, ldLoader) => {
    if (!verifiablePresentation) {
        throw new Error(`verifiablePresentation is required for selective disclosure request`);
    }
    let mz;
    const strVerifiablePresentation = JSON.stringify(verifiablePresentation);
    try {
        mz = await js_jsonld_merklization_1.Merklizer.merklizeJSONLD(strVerifiablePresentation, {
            documentLoader: ldLoader
        });
    }
    catch (e) {
        throw new Error(`can't merklize verifiablePresentation`);
    }
    let merklizedPath;
    try {
        const p = `verifiableCredential.credentialSubject.${fieldName}`;
        merklizedPath = await js_jsonld_merklization_1.Path.fromDocument(null, strVerifiablePresentation, p, {
            documentLoader: ldLoader
        });
    }
    catch (e) {
        throw new Error(`can't build path to '${fieldName}' key`);
    }
    let proof;
    let value;
    try {
        ({ proof, value } = await mz.proof(merklizedPath));
    }
    catch (e) {
        throw new Error(`can't get value by path '${fieldName}'`);
    }
    if (!value) {
        throw new Error(`can't get merkle value for field '${fieldName}'`);
    }
    if (!proof.existence) {
        throw new Error(`path [${merklizedPath.parts}] doesn't exist in verifiablePresentation document`);
    }
    return await value.mtEntry();
};
exports.fieldValueFromVerifiablePresentation = fieldValueFromVerifiablePresentation;
function calculateGroupId(requestIds) {
    const types = Array(requestIds.length).fill('uint256');
    const groupID = BigInt(ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(types, requestIds))) &
        // It should fit in a field number in the circuit (max 253 bits). With this we truncate to 252 bits for the group ID
        BigInt('0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    return groupID;
}
exports.calculateGroupId = calculateGroupId;
function calculateRequestId(requestParams, creatorAddress) {
    // 0x0000000000000000FFFF...FF. Reserved first 8 bytes for the request Id type and future use
    // 0x00010000000000000000...00. First 2 bytes for the request Id type
    //    - 0x0000... for old request Ids with uint64
    //    - 0x0001... for new request Ids with uint256
    const requestId = (BigInt(ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(['bytes', 'address'], [requestParams, creatorAddress]))) &
        BigInt('0x0000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')) +
        BigInt('0x0001000000000000000000000000000000000000000000000000000000000000');
    return requestId;
}
exports.calculateRequestId = calculateRequestId;
function calculateMultiRequestId(requestIds, groupIds, creatorAddress) {
    return BigInt(ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(['uint256[]', 'uint256[]', 'address'], [requestIds, groupIds, creatorAddress])));
}
exports.calculateMultiRequestId = calculateMultiRequestId;
