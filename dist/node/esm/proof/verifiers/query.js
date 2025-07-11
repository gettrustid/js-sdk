import { DID, getDateFromUnixTimestamp } from 'js-iden3-core-custom';
import { Merklizer, Path } from '@iden3/js-jsonld-merklization';
import { byteEncoder } from '../../utils';
import { getOperatorNameByValue, Operators, QueryOperators } from '../../circuits/comparer';
import { calculateCoreSchemaHash, VerifiableConstants } from '../../verifiable';
import { circuitValidator } from '../provers';
import { ethers } from 'ethers';
const defaultProofGenerationDelayOpts = 24 * 60 * 60 * 1000; // 24 hours
export async function checkQueryRequest(query, queriesMetadata, ldContext, outputs, circuitId, schemaLoader, opts) {
    // validate issuer
    const userDID = DID.parseFromId(outputs.issuerId);
    const issuerAllowed = !query.allowedIssuers ||
        query.allowedIssuers?.some((issuer) => issuer === '*' || issuer === userDID.string());
    if (!issuerAllowed) {
        throw new Error('issuer is not in allowed list');
    }
    if (!query.type) {
        throw new Error('query type is missing');
    }
    const schemaId = await Path.getTypeIDFromContext(JSON.stringify(ldContext), query.type, {
        documentLoader: schemaLoader
    });
    const schemaHash = calculateCoreSchemaHash(byteEncoder.encode(schemaId));
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
    const timeDiff = Date.now() - getDateFromUnixTimestamp(Number(outputs.timestamp)).getTime();
    if (timeDiff > acceptedProofGenerationDelay) {
        throw new Error('generated proof is outdated');
    }
    return;
}
export function checkCircuitQueriesLength(circuitId, queriesMetadata) {
    const circuitValidationData = circuitValidator[circuitId];
    if (queriesMetadata.length > circuitValidationData.maxQueriesCount) {
        throw new Error(`circuit ${circuitId} supports only ${circuitValidator[circuitId].maxQueriesCount} queries`);
    }
}
export function checkCircuitOperator(circuitId, operator) {
    const circuitValidationData = circuitValidator[circuitId];
    if (!circuitValidationData.supportedOperations.includes(operator)) {
        throw new Error(`circuit ${circuitId} not support ${getOperatorNameByValue(operator)} operator`);
    }
}
export function verifyFieldValueInclusionV2(outputs, metadata) {
    if (outputs.operator == QueryOperators.$noop) {
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
export function verifyFieldValueInclusionNativeExistsSupport(outputs, metadata) {
    if (outputs.operator == Operators.NOOP) {
        return;
    }
    if (outputs.operator === Operators.EXISTS && !outputs.merklized) {
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
export async function validateEmptyCredentialSubjectV2Circuit(cq, outputs) {
    if (outputs.operator !== Operators.EQ) {
        throw new Error('empty credentialSubject request available only for equal operation');
    }
    for (let index = 1; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`empty credentialSubject request not available for array of values`);
        }
    }
    const path = Path.newPath([VerifiableConstants.CREDENTIAL_SUBJECT_PATH]);
    const subjectEntry = await path.mtEntry();
    if (outputs.claimPathKey !== subjectEntry) {
        throw new Error(`proof doesn't contain credentialSubject in claimPathKey`);
    }
    return;
}
export async function validateOperators(cq, outputs) {
    if (outputs.operator !== cq.operator) {
        throw new Error(`operator that was used is not equal to request`);
    }
    if (outputs.operator === Operators.NOOP) {
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
export async function validateDisclosureV2Circuit(cq, outputs, verifiablePresentation, ldLoader) {
    const bi = await fieldValueFromVerifiablePresentation(cq.fieldName, verifiablePresentation, ldLoader);
    if (bi !== outputs.value[0]) {
        throw new Error(`value that was used is not equal to requested in query`);
    }
    if (outputs.operator !== Operators.EQ) {
        throw new Error(`operator for selective disclosure must be $eq`);
    }
    for (let index = 1; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`selective disclosure not available for array of values`);
        }
    }
}
export async function validateDisclosureNativeSDSupport(cq, outputs, verifiablePresentation, ldLoader) {
    const bi = await fieldValueFromVerifiablePresentation(cq.fieldName, verifiablePresentation, ldLoader);
    if (bi !== outputs.operatorOutput) {
        throw new Error(`operator output should be equal to disclosed value`);
    }
    if (outputs.operator !== Operators.SD) {
        throw new Error(`operator for selective disclosure must be $sd`);
    }
    for (let index = 0; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`public signal values must be zero`);
        }
    }
}
export async function validateEmptyCredentialSubjectNoopNativeSupport(outputs) {
    if (outputs.operator !== Operators.NOOP) {
        throw new Error('empty credentialSubject request available only for $noop operation');
    }
    for (let index = 1; index < outputs.value.length; index++) {
        if (outputs.value[index] !== 0n) {
            throw new Error(`empty credentialSubject request not available for array of values`);
        }
    }
}
export const fieldValueFromVerifiablePresentation = async (fieldName, verifiablePresentation, ldLoader) => {
    if (!verifiablePresentation) {
        throw new Error(`verifiablePresentation is required for selective disclosure request`);
    }
    let mz;
    const strVerifiablePresentation = JSON.stringify(verifiablePresentation);
    try {
        mz = await Merklizer.merklizeJSONLD(strVerifiablePresentation, {
            documentLoader: ldLoader
        });
    }
    catch (e) {
        throw new Error(`can't merklize verifiablePresentation`);
    }
    let merklizedPath;
    try {
        const p = `verifiableCredential.credentialSubject.${fieldName}`;
        merklizedPath = await Path.fromDocument(null, strVerifiablePresentation, p, {
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
export function calculateGroupId(requestIds) {
    const types = Array(requestIds.length).fill('uint256');
    const groupID = BigInt(ethers.keccak256(ethers.solidityPacked(types, requestIds))) &
        // It should fit in a field number in the circuit (max 253 bits). With this we truncate to 252 bits for the group ID
        BigInt('0x0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    return groupID;
}
export function calculateRequestId(requestParams, creatorAddress) {
    // 0x0000000000000000FFFF...FF. Reserved first 8 bytes for the request Id type and future use
    // 0x00010000000000000000...00. First 2 bytes for the request Id type
    //    - 0x0000... for old request Ids with uint64
    //    - 0x0001... for new request Ids with uint256
    const requestId = (BigInt(ethers.keccak256(ethers.solidityPacked(['bytes', 'address'], [requestParams, creatorAddress]))) &
        BigInt('0x0000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')) +
        BigInt('0x0001000000000000000000000000000000000000000000000000000000000000');
    return requestId;
}
export function calculateMultiRequestId(requestIds, groupIds, creatorAddress) {
    return BigInt(ethers.keccak256(ethers.solidityPacked(['uint256[]', 'uint256[]', 'address'], [requestIds, groupIds, creatorAddress])));
}
