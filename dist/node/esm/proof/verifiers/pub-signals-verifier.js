import { DID, getDateFromUnixTimestamp } from 'js-iden3-core-custom';
import { getDocumentLoader, Path } from '@iden3/js-jsonld-merklization';
import { byteEncoder, isGenesisState } from '../../utils';
import { calculateCoreSchemaHash, ProofType } from '../../verifiable';
import { AtomicQueryMTPV2PubSignals } from '../../circuits/atomic-query-mtp-v2';
import { AtomicQuerySigV2PubSignals } from '../../circuits/atomic-query-sig-v2';
import { AtomicQueryV3PubSignals } from '../../circuits/atomic-query-v3';
import { AuthV2PubSignals } from '../../circuits/auth-v2';
import { BaseConfig } from '../../circuits/common';
import { LinkedMultiQueryPubSignals, LinkedMultiQueryInputs } from '../../circuits/linked-multi-query';
import { CircuitId } from '../../circuits/models';
import { checkQueryRequest, fieldValueFromVerifiablePresentation, validateDisclosureV2Circuit, validateEmptyCredentialSubjectV2Circuit, validateOperators, verifyFieldValueInclusionV2, validateDisclosureNativeSDSupport, validateEmptyCredentialSubjectNoopNativeSupport, verifyFieldValueInclusionNativeExistsSupport, checkCircuitOperator } from './query';
import { parseQueriesMetadata } from '../common';
import { Operators } from '../../circuits';
import { calculateQueryHashV3 } from './query-hash';
import { PROTOCOL_CONSTANTS } from '../../iden3comm';
export const userStateError = new Error(`user state is not valid`);
const zeroInt = 0n;
/**
 * PubSignalsVerifier provides verify method
 * @public
 * @class PubSignalsVerifier
 */
export class PubSignalsVerifier {
    /**
     * Creates an instance of PubSignalsVerifier.
     * @param {DocumentLoader} _documentLoader document loader
     * @param {IStateStorage} _stateStorage state storage
     */
    constructor(_documentLoader, _stateStorage) {
        this._documentLoader = _documentLoader;
        this._stateStorage = _stateStorage;
        this.credentialAtomicQueryMTPV2Verify = async ({ query, verifiablePresentation, sender, challenge, pubSignals, opts }) => {
            let mtpv2PubSignals = new AtomicQueryMTPV2PubSignals();
            mtpv2PubSignals = mtpv2PubSignals.pubSignalsUnmarshal(byteEncoder.encode(JSON.stringify(pubSignals)));
            if (!mtpv2PubSignals.userID) {
                throw new Error('user id is not presented in proof public signals');
            }
            if (!mtpv2PubSignals.requestID) {
                throw new Error('requestId is not presented in proof public signals');
            }
            this.userId = mtpv2PubSignals.userID;
            this.challenge = mtpv2PubSignals.requestID;
            // verify query
            const outs = {
                issuerId: mtpv2PubSignals.issuerID,
                schemaHash: mtpv2PubSignals.claimSchema,
                slotIndex: mtpv2PubSignals.slotIndex,
                operator: mtpv2PubSignals.operator,
                value: mtpv2PubSignals.value,
                timestamp: mtpv2PubSignals.timestamp,
                merklized: mtpv2PubSignals.merklized,
                claimPathKey: mtpv2PubSignals.claimPathKey,
                claimPathNotExists: mtpv2PubSignals.claimPathNotExists,
                valueArraySize: mtpv2PubSignals.getValueArrSize(),
                isRevocationChecked: mtpv2PubSignals.isRevocationChecked
            };
            await this.checkQueryV2Circuits(CircuitId.AtomicQueryMTPV2, query, outs, opts, verifiablePresentation);
            // verify state
            await this.checkStateExistenceForId(mtpv2PubSignals.issuerID, mtpv2PubSignals.issuerClaimIdenState);
            if (mtpv2PubSignals.isRevocationChecked !== 0) {
                await this.checkRevocationState(mtpv2PubSignals.issuerID, mtpv2PubSignals.issuerClaimNonRevState, opts);
            }
            // verify ID ownership
            this.verifyIdOwnership(sender, challenge);
            return mtpv2PubSignals;
        };
        this.credentialAtomicQuerySigV2Verify = async ({ query, verifiablePresentation, sender, challenge, pubSignals, opts }) => {
            let sigV2PubSignals = new AtomicQuerySigV2PubSignals();
            sigV2PubSignals = sigV2PubSignals.pubSignalsUnmarshal(byteEncoder.encode(JSON.stringify(pubSignals)));
            this.userId = sigV2PubSignals.userID;
            this.challenge = sigV2PubSignals.requestID;
            // verify query
            const outs = {
                issuerId: sigV2PubSignals.issuerID,
                schemaHash: sigV2PubSignals.claimSchema,
                slotIndex: sigV2PubSignals.slotIndex,
                operator: sigV2PubSignals.operator,
                value: sigV2PubSignals.value,
                timestamp: sigV2PubSignals.timestamp,
                merklized: sigV2PubSignals.merklized,
                claimPathKey: sigV2PubSignals.claimPathKey,
                claimPathNotExists: sigV2PubSignals.claimPathNotExists,
                valueArraySize: sigV2PubSignals.getValueArrSize(),
                isRevocationChecked: sigV2PubSignals.isRevocationChecked
            };
            await this.checkQueryV2Circuits(CircuitId.AtomicQuerySigV2, query, outs, opts, verifiablePresentation);
            // verify state
            await this.checkStateExistenceForId(sigV2PubSignals.issuerID, sigV2PubSignals.issuerAuthState);
            if (sigV2PubSignals.isRevocationChecked !== 0) {
                await this.checkRevocationState(sigV2PubSignals.issuerID, sigV2PubSignals.issuerClaimNonRevState, opts);
            }
            // verify Id ownership
            this.verifyIdOwnership(sender, challenge);
            return sigV2PubSignals;
        };
        this.credentialAtomicQueryV3Verify = async ({ query, verifiablePresentation, sender, challenge, pubSignals, opts, params }) => {
            let v3PubSignals = new AtomicQueryV3PubSignals();
            v3PubSignals = v3PubSignals.pubSignalsUnmarshal(byteEncoder.encode(JSON.stringify(pubSignals)));
            this.userId = v3PubSignals.userID;
            this.challenge = v3PubSignals.requestID;
            // verify query
            const outs = {
                issuerId: v3PubSignals.issuerID,
                schemaHash: v3PubSignals.claimSchema,
                slotIndex: v3PubSignals.slotIndex,
                operator: v3PubSignals.operator,
                value: v3PubSignals.value,
                timestamp: v3PubSignals.timestamp,
                merklized: v3PubSignals.merklized,
                claimPathKey: v3PubSignals.claimPathKey,
                valueArraySize: v3PubSignals.getValueArrSize(),
                operatorOutput: v3PubSignals.operatorOutput,
                isRevocationChecked: v3PubSignals.isRevocationChecked
            };
            if (!query.type) {
                throw new Error(`proof query type is undefined`);
            }
            const loader = this._documentLoader ?? getDocumentLoader();
            // validate schema
            let context;
            try {
                context = (await loader(query.context ?? '')).document;
            }
            catch (e) {
                throw new Error(`can't load schema for request query`);
            }
            const queriesMetadata = await parseQueriesMetadata(query.type, JSON.stringify(context), query.credentialSubject, {
                documentLoader: loader
            });
            const circuitId = CircuitId.AtomicQueryV3;
            await checkQueryRequest(query, queriesMetadata, context, outs, circuitId, this._documentLoader, opts);
            const queryMetadata = queriesMetadata[0]; // only one query is supported
            checkCircuitOperator(circuitId, outs.operator);
            // validate selective disclosure
            if (queryMetadata.operator === Operators.SD) {
                try {
                    await validateDisclosureNativeSDSupport(queryMetadata, outs, verifiablePresentation, loader);
                }
                catch (e) {
                    throw new Error(`failed to validate selective disclosure: ${e.message}`);
                }
            }
            else if (!queryMetadata.fieldName && queryMetadata.operator == Operators.NOOP) {
                try {
                    await validateEmptyCredentialSubjectNoopNativeSupport(outs);
                }
                catch (e) {
                    throw new Error(`failed to validate operators: ${e.message}`);
                }
            }
            else {
                try {
                    await validateOperators(queryMetadata, outs);
                }
                catch (e) {
                    throw new Error(`failed to validate operators: ${e.message}`);
                }
            }
            // verify field inclusion / non-inclusion
            verifyFieldValueInclusionNativeExistsSupport(outs, queryMetadata);
            const { proofType, verifierID, nullifier, nullifierSessionID, linkID } = v3PubSignals;
            switch (query.proofType) {
                case ProofType.BJJSignature:
                    if (proofType !== 1) {
                        throw new Error('wrong proof type for BJJSignature');
                    }
                    break;
                case ProofType.Iden3SparseMerkleTreeProof:
                    if (proofType !== 2) {
                        throw new Error('wrong proof type for Iden3SparseMerkleTreeProof');
                    }
                    break;
                default:
                    throw new Error('invalid proof type');
            }
            const nSessionId = BigInt(params?.nullifierSessionId ?? 0);
            if (nSessionId !== 0n) {
                if (BigInt(nullifier ?? 0) === 0n) {
                    throw new Error('nullifier should be provided for nullification and should not be 0');
                }
                // verify nullifier information
                const verifierDIDParam = params?.verifierDid;
                if (!verifierDIDParam) {
                    throw new Error('verifierDid is required');
                }
                const id = DID.idFromDID(verifierDIDParam);
                if (verifierID.bigInt() != id.bigInt()) {
                    throw new Error('wrong verifier is used for nullification');
                }
                if (nullifierSessionID !== nSessionId) {
                    throw new Error(`wrong verifier session id is used for nullification, expected ${nSessionId}, got ${nullifierSessionID}`);
                }
            }
            else if (nullifierSessionID !== 0n) {
                throw new Error(`Nullifier id is generated but wasn't requested`);
            }
            if (!query.groupId && linkID !== 0n) {
                throw new Error(`proof contains link id, but group id is not provided`);
            }
            if (query.groupId && linkID === 0n) {
                throw new Error("proof doesn't contain link id, but group id is provided");
            }
            // verify state
            await this.checkStateExistenceForId(v3PubSignals.issuerID, v3PubSignals.issuerState);
            if (v3PubSignals.isRevocationChecked !== 0) {
                await this.checkRevocationState(v3PubSignals.issuerID, v3PubSignals.issuerClaimNonRevState, opts);
            }
            this.verifyIdOwnership(sender, challenge);
            return v3PubSignals;
        };
        this.authV2Verify = async ({ sender, challenge, pubSignals, opts }) => {
            let authV2PubSignals = new AuthV2PubSignals();
            authV2PubSignals = authV2PubSignals.pubSignalsUnmarshal(byteEncoder.encode(JSON.stringify(pubSignals)));
            this.userId = authV2PubSignals.userID;
            this.challenge = authV2PubSignals.challenge;
            // no query verification
            // verify state
            const gist = await this.checkGlobalState(authV2PubSignals.GISTRoot, this.userId);
            let acceptedStateTransitionDelay = PROTOCOL_CONSTANTS.DEFAULT_AUTH_VERIFY_DELAY;
            if (opts?.acceptedStateTransitionDelay) {
                acceptedStateTransitionDelay = opts.acceptedStateTransitionDelay;
            }
            if (!gist.latest) {
                const timeDiff = Date.now() - getDateFromUnixTimestamp(Number(gist.transitionTimestamp)).getTime();
                if (timeDiff > acceptedStateTransitionDelay) {
                    throw new Error('global state is outdated');
                }
            }
            // verify Id ownership
            this.verifyIdOwnership(sender, challenge);
            return new BaseConfig();
        };
        this.linkedMultiQuery10Verify = async ({ query, verifiablePresentation, pubSignals }) => {
            let multiQueryPubSignals = new LinkedMultiQueryPubSignals();
            multiQueryPubSignals = multiQueryPubSignals.pubSignalsUnmarshal(byteEncoder.encode(JSON.stringify(pubSignals)));
            // verify query
            let schema;
            const ldOpts = { documentLoader: this._documentLoader };
            try {
                schema = (await ldOpts.documentLoader(query.context || '')).document;
            }
            catch (e) {
                throw new Error(`can't load schema for request query`);
            }
            const ldContextJSON = JSON.stringify(schema);
            const credentialSubject = query.credentialSubject;
            const schemaId = await Path.getTypeIDFromContext(ldContextJSON, query.type || '', ldOpts);
            const schemaHash = calculateCoreSchemaHash(byteEncoder.encode(schemaId));
            const queriesMetadata = await parseQueriesMetadata(query.type || '', ldContextJSON, credentialSubject, ldOpts);
            const request = [];
            const merklized = queriesMetadata[0]?.merklizedSchema ? 1 : 0;
            for (let i = 0; i < LinkedMultiQueryInputs.queryCount; i++) {
                const queryMeta = queriesMetadata[i];
                const values = queryMeta?.values ?? [];
                const valArrSize = values.length;
                const queryHash = calculateQueryHashV3(values, schemaHash, queryMeta?.slotIndex ?? 0, queryMeta?.operator ?? 0, queryMeta?.claimPathKey.toString() ?? 0, valArrSize, merklized, 0, 0, 0);
                request.push({ queryHash, queryMeta });
            }
            const queryHashCompare = (a, b) => {
                if (a.queryHash < b.queryHash)
                    return -1;
                if (a.queryHash > b.queryHash)
                    return 1;
                return 0;
            };
            const pubSignalsMeta = multiQueryPubSignals.circuitQueryHash.map((queryHash, index) => ({
                queryHash,
                operatorOutput: multiQueryPubSignals.operatorOutput[index]
            }));
            pubSignalsMeta.sort(queryHashCompare);
            request.sort(queryHashCompare);
            for (let i = 0; i < LinkedMultiQueryInputs.queryCount; i++) {
                if (request[i].queryHash != pubSignalsMeta[i].queryHash) {
                    throw new Error('query hashes do not match');
                }
                if (request[i].queryMeta?.operator === Operators.SD) {
                    const disclosedValue = await fieldValueFromVerifiablePresentation(request[i].queryMeta.fieldName, verifiablePresentation, this._documentLoader);
                    if (disclosedValue != pubSignalsMeta[i].operatorOutput) {
                        throw new Error('disclosed value is not in the proof outputs');
                    }
                }
            }
            return multiQueryPubSignals;
        };
        this.verifyIdOwnership = (sender, challenge) => {
            const senderId = DID.idFromDID(DID.parse(sender));
            if (senderId.string() !== this.userId.string()) {
                throw new Error(`sender id is not used for proof creation, expected ${sender}, user from public signals: ${this.userId.string()}`);
            }
            if (challenge !== this.challenge) {
                throw new Error(`challenge is not used for proof creation, expected ${challenge}, challenge from public signals: ${this.challenge}  `);
            }
        };
        this.checkStateExistenceForId = async (userId, userState) => {
            await this.resolve(userId, userState.bigInt());
        };
        this.checkGlobalState = async (state, id) => {
            return this.rootResolve(state.bigInt(), id.bigInt());
        };
        this.checkRevocationStateForId = async (issuerId, issuerClaimNonRevState) => {
            const issuerNonRevStateResolved = await this.resolve(issuerId, issuerClaimNonRevState.bigInt());
            return issuerNonRevStateResolved;
        };
        this.checkRevocationState = async (issuerID, issuerClaimNonRevState, opts) => {
            const issuerNonRevStateResolved = await this.checkRevocationStateForId(issuerID, issuerClaimNonRevState);
            const acceptedStateTransitionDelay = opts?.acceptedStateTransitionDelay ?? PROTOCOL_CONSTANTS.DEFAULT_PROOF_VERIFY_DELAY;
            if (!issuerNonRevStateResolved.latest) {
                const timeDiff = Date.now() -
                    getDateFromUnixTimestamp(Number(issuerNonRevStateResolved.transitionTimestamp)).getTime();
                if (timeDiff > acceptedStateTransitionDelay) {
                    throw new Error('issuer state is outdated');
                }
            }
        };
    }
    /**
     * verify public signals
     *
     * @param {string} circuitId circuit id
     * @param {VerifyContext} ctx verification parameters
     * @returns `Promise<BaseConfig>`
     */
    async verify(circuitId, ctx) {
        const fnName = `${circuitId.split('-')[0]}Verify`;
        const fn = this[fnName];
        if (!fn) {
            throw new Error(`public signals verifier for ${circuitId} not found`);
        }
        return fn(ctx);
    }
    async checkQueryV2Circuits(circuitId, query, outs, opts, verifiablePresentation) {
        if (!query.type) {
            throw new Error(`proof query type is undefined`);
        }
        const loader = this._documentLoader ?? getDocumentLoader();
        // validate schema
        let context;
        try {
            context = (await loader(query.context ?? '')).document;
        }
        catch (e) {
            throw new Error(`can't load schema for request query`);
        }
        const queriesMetadata = await parseQueriesMetadata(query.type, JSON.stringify(context), query.credentialSubject, {
            documentLoader: loader
        });
        await checkQueryRequest(query, queriesMetadata, context, outs, circuitId, this._documentLoader, opts);
        const queryMetadata = queriesMetadata[0]; // only one query is supported
        checkCircuitOperator(circuitId, outs.operator);
        // validate selective disclosure
        if (queryMetadata.operator === Operators.SD) {
            try {
                await validateDisclosureV2Circuit(queryMetadata, outs, verifiablePresentation, loader);
            }
            catch (e) {
                throw new Error(`failed to validate selective disclosure: ${e.message}`);
            }
        }
        else if (!queryMetadata.fieldName && queryMetadata.operator == Operators.NOOP) {
            try {
                await validateEmptyCredentialSubjectV2Circuit(queryMetadata, outs);
            }
            catch (e) {
                throw new Error(`failed to validate operators: ${e.message}`);
            }
        }
        else {
            try {
                await validateOperators(queryMetadata, outs);
            }
            catch (e) {
                throw new Error(`failed to validate operators: ${e.message}`);
            }
        }
        // verify field inclusion
        verifyFieldValueInclusionV2(outs, queryMetadata);
    }
    async resolve(id, state) {
        const idBigInt = id.bigInt();
        const did = DID.parseFromId(id);
        // check if id is genesis
        const isGenesis = isGenesisState(did, state);
        let contractState;
        try {
            contractState = await this._stateStorage.getStateInfoByIdAndState(idBigInt, state);
        }
        catch (e) {
            const stateNotExistErr = (e?.errorArgs ?? [])[0];
            const errMsg = stateNotExistErr || e.message;
            if (errMsg.includes('State does not exist')) {
                if (isGenesis) {
                    return {
                        latest: true,
                        transitionTimestamp: 0
                    };
                }
                throw new Error('State is not genesis and not registered in the smart contract');
            }
            throw e;
        }
        if (!contractState.id || contractState.id.toString() !== idBigInt.toString()) {
            throw new Error(`state was recorded for another identity`);
        }
        if (!contractState.state || contractState.state.toString() !== state.toString()) {
            if (!contractState.replacedAtTimestamp ||
                contractState.replacedAtTimestamp.toString() === zeroInt.toString()) {
                throw new Error(`no information about state transition`);
            }
            return {
                latest: false,
                transitionTimestamp: contractState.replacedAtTimestamp.toString()
            };
        }
        return {
            latest: !contractState.replacedAtTimestamp ||
                contractState.replacedAtTimestamp.toString() === zeroInt.toString(),
            transitionTimestamp: contractState.replacedAtTimestamp?.toString() ?? 0
        };
    }
    async rootResolve(state, id) {
        let globalStateInfo;
        try {
            globalStateInfo = await this._stateStorage.getGISTRootInfo(state, id);
        }
        catch (e) {
            if (e.errorArgs[0] === 'Root does not exist') {
                throw new Error('GIST root does not exist in the smart contract');
            }
            throw e;
        }
        if (globalStateInfo.root.toString() !== state.toString()) {
            throw new Error(`gist info contains invalid state`);
        }
        if (globalStateInfo.replacedByRoot.toString() !== zeroInt.toString()) {
            if (globalStateInfo.replacedAtTimestamp.toString() === zeroInt.toString()) {
                throw new Error(`state was replaced, but replaced time unknown`);
            }
            return {
                latest: false,
                transitionTimestamp: globalStateInfo.replacedAtTimestamp.toString()
            };
        }
        return {
            latest: true,
            transitionTimestamp: 0
        };
    }
}
