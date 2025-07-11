import { BytesHelper, DID, MerklizedRootPosition, getDateFromUnixTimestamp } from 'js-iden3-core-custom';
import { AuthV2Inputs, AuthV2PubSignals, CircuitId, Operators, Query, ValueProof } from '../circuits';
import { createVerifiablePresentation, VerifiableConstants } from '../verifiable';
import { parseCredentialSubject, parseQueryMetadata, toGISTProof, transformQueryValueToBigInts } from './common';
import { NativeProver } from './provers/prover';
import { getDocumentLoader } from '@iden3/js-jsonld-merklization';
import { PROTOCOL_CONSTANTS } from '../iden3comm';
import { cacheLoader } from '../schema-processor';
import { byteDecoder, byteEncoder } from '../utils/encoding';
import { InputGenerator } from './provers/inputs-generator';
import { PubSignalsVerifier } from './verifiers/pub-signals-verifier';
/**
 * Proof service is an implementation of IProofService
 * that works with a native groth16 prover
 *
 * @public
 * @class ProofService
 * @implements implements IProofService interface
 */
export class ProofService {
    /**
     * Creates an instance of ProofService.
     * @param {IIdentityWallet} _identityWallet - identity wallet
     * @param {ICredentialWallet} _credentialWallet - credential wallet
     * @param {ICircuitStorage} _circuitStorage - circuit storage to load proving / verification files
     * @param {IStateStorage} _stateStorage - state storage to get GIST proof / publish state
     */
    constructor(_identityWallet, _credentialWallet, _circuitStorage, _stateStorage, opts) {
        this._identityWallet = _identityWallet;
        this._credentialWallet = _credentialWallet;
        this._stateStorage = _stateStorage;
        this._prover = opts?.prover ?? new NativeProver(_circuitStorage);
        this._ldOptions = { ...opts, documentLoader: opts?.documentLoader ?? cacheLoader(opts) };
        this._inputsGenerator = new InputGenerator(_identityWallet, _credentialWallet, _stateStorage);
        this._pubSignalsVerifier = new PubSignalsVerifier(opts?.documentLoader ?? cacheLoader(opts), _stateStorage);
    }
    /** {@inheritdoc IProofService.verifyProof} */
    async verifyProof(zkp, circuitId) {
        return this._prover.verify(zkp, circuitId);
    }
    /** {@inheritdoc IProofService.verify} */
    async verifyZKPResponse(proofResp, opts) {
        const proofValid = await this._prover.verify(proofResp, proofResp.circuitId);
        if (!proofValid) {
            throw Error(`Proof with circuit id ${proofResp.circuitId} and request id ${proofResp.id} is not valid`);
        }
        const verifyContext = {
            pubSignals: proofResp.pub_signals,
            query: opts.query,
            verifiablePresentation: proofResp.vp,
            sender: opts.sender,
            challenge: BigInt(proofResp.id),
            opts: opts.opts,
            params: opts.params
        };
        const pubSignals = await this._pubSignalsVerifier.verify(proofResp.circuitId, verifyContext);
        return { linkID: pubSignals.linkID };
    }
    /** {@inheritdoc IProofService.generateProof} */
    async generateProof(proofReq, identifier, opts) {
        if (!opts) {
            opts = {
                skipRevocation: false,
                challenge: 0n
            };
        }
        let credentialWithRevStatus = { cred: opts.credential, revStatus: opts.credentialRevocationStatus };
        if (!opts.credential) {
            credentialWithRevStatus = await this.findCredentialByProofQuery(identifier, proofReq.query);
        }
        if (opts.credential && !opts.credentialRevocationStatus && !opts.skipRevocation) {
            const revStatus = await this._credentialWallet.getRevocationStatusFromCredential(opts.credential);
            credentialWithRevStatus = { cred: opts.credential, revStatus };
        }
        if (!credentialWithRevStatus.cred) {
            throw new Error(VerifiableConstants.ERRORS.PROOF_SERVICE_NO_CREDENTIAL_FOR_QUERY +
                ` ${JSON.stringify(proofReq.query)}`);
        }
        const credentialCoreClaim = await this._identityWallet.getCoreClaimFromCredential(credentialWithRevStatus.cred);
        const { nonce: authProfileNonce, genesisDID } = await this._identityWallet.getGenesisDIDMetadata(identifier);
        const preparedCredential = {
            credential: credentialWithRevStatus.cred,
            credentialCoreClaim,
            revStatus: credentialWithRevStatus.revStatus
        };
        const subjectDID = DID.parse(preparedCredential.credential.credentialSubject['id']);
        const { nonce: credentialSubjectProfileNonce, genesisDID: subjectGenesisDID } = await this._identityWallet.getGenesisDIDMetadata(subjectDID);
        if (subjectGenesisDID.string() !== genesisDID.string()) {
            throw new Error(VerifiableConstants.ERRORS.PROOF_SERVICE_PROFILE_GENESIS_DID_MISMATCH);
        }
        const propertiesMetadata = parseCredentialSubject(proofReq.query.credentialSubject);
        if (!propertiesMetadata.length) {
            throw new Error(VerifiableConstants.ERRORS.PROOF_SERVICE_NO_QUERIES_IN_ZKP_REQUEST);
        }
        const mtPosition = preparedCredential.credentialCoreClaim.getMerklizedPosition();
        let mk;
        if (mtPosition !== MerklizedRootPosition.None) {
            mk = await preparedCredential.credential.merklize(this._ldOptions);
        }
        const context = proofReq.query['context'];
        const groupId = proofReq.query['groupId'];
        const ldContext = await this.loadLdContext(context);
        const credentialType = proofReq.query['type'];
        const queriesMetadata = [];
        const circuitQueries = [];
        for (const propertyMetadata of propertiesMetadata) {
            const queryMetadata = await parseQueryMetadata(propertyMetadata, byteDecoder.decode(ldContext), credentialType, this._ldOptions);
            queriesMetadata.push(queryMetadata);
            const circuitQuery = await this.toCircuitsQuery(preparedCredential.credential, queryMetadata, mk);
            circuitQueries.push(circuitQuery);
        }
        const inputs = await this.generateInputs(preparedCredential, genesisDID, proofReq, {
            ...opts,
            authProfileNonce,
            credentialSubjectProfileNonce,
            linkNonce: groupId ? opts.linkNonce : 0n
        }, circuitQueries);
        const sdQueries = queriesMetadata.filter((q) => q.operator === Operators.SD);
        let vp;
        if (sdQueries.length) {
            vp = createVerifiablePresentation(context, credentialType, preparedCredential.credential, sdQueries);
        }
        const { proof, pub_signals } = await this._prover.generate(inputs, proofReq.circuitId);
        return {
            id: proofReq.id,
            circuitId: proofReq.circuitId,
            vp,
            proof,
            pub_signals
        };
    }
    /** {@inheritdoc IProofService.generateAuthProof} */
    async generateAuthProof(circuitId, identifier, opts) {
        if (!opts) {
            opts = {
                challenge: 0n
            };
        }
        let zkProof;
        switch (circuitId) {
            case CircuitId.AuthV2:
                {
                    const challenge = opts.challenge
                        ? BytesHelper.intToBytes(opts.challenge).reverse()
                        : new Uint8Array(32);
                    zkProof = await this.generateAuthV2Proof(challenge, identifier);
                }
                return {
                    circuitId: circuitId,
                    proof: zkProof.proof,
                    pub_signals: zkProof.pub_signals
                };
            default:
                throw new Error(`CircuitId ${circuitId} is not supported`);
        }
    }
    /** {@inheritdoc IProofService.transitState} */
    async transitState(did, oldTreeState, isOldStateGenesis, stateStorage, // for compatibility with previous versions we leave this parameter
    ethSigner) {
        return this._identityWallet.transitState(did, oldTreeState, isOldStateGenesis, ethSigner, this._prover);
    }
    async generateInputs(preparedCredential, identifier, proofReq, params, circuitQueries) {
        return this._inputsGenerator.generateInputs({
            preparedCredential,
            identifier,
            proofReq,
            params,
            circuitQueries
        });
    }
    async toCircuitsQuery(credential, queryMetadata, merklizedCredential) {
        if (queryMetadata.merklizedSchema && !merklizedCredential) {
            throw new Error('merklized root position is set to None for merklized schema');
        }
        if (!queryMetadata.merklizedSchema && merklizedCredential) {
            throw new Error('merklized root position is not set to None for non-merklized schema');
        }
        const query = new Query();
        query.slotIndex = queryMetadata.slotIndex;
        query.operator = queryMetadata.operator;
        query.values = queryMetadata.values;
        if (queryMetadata.merklizedSchema && merklizedCredential) {
            const { proof, value: mtValue } = await merklizedCredential.proof(queryMetadata.path);
            query.valueProof = new ValueProof();
            query.valueProof.mtp = proof;
            query.valueProof.path = queryMetadata.claimPathKey;
            const mtEntry = (await mtValue?.mtEntry()) ?? 0n;
            query.valueProof.value = mtEntry;
            if (!queryMetadata.fieldName) {
                query.values = [mtEntry];
                return query;
            }
        }
        if (queryMetadata.operator === Operators.SD) {
            const [first, ...rest] = queryMetadata.fieldName.split('.');
            let v = credential.credentialSubject[first];
            for (const part of rest) {
                v = v[part];
            }
            if (typeof v === 'undefined') {
                throw new Error(`credential doesn't contain value for field ${queryMetadata.fieldName}`);
            }
            query.values = await transformQueryValueToBigInts(v, queryMetadata.datatype);
        }
        return query;
    }
    async loadLdContext(context) {
        const loader = getDocumentLoader(this._ldOptions);
        let ldSchema;
        try {
            ldSchema = (await loader(context)).document;
        }
        catch (e) {
            throw new Error(`can't load ld context from url ${context}`);
        }
        return byteEncoder.encode(JSON.stringify(ldSchema));
    }
    /** {@inheritdoc IProofService.generateAuthV2Inputs} */
    async generateAuthV2Inputs(hash, did, circuitId) {
        if (circuitId !== CircuitId.AuthV2) {
            throw new Error('CircuitId is not supported');
        }
        const { nonce: authProfileNonce, genesisDID } = await this._identityWallet.getGenesisDIDMetadata(did);
        const challenge = BytesHelper.bytesToInt(hash.reverse());
        const authPrepared = await this._inputsGenerator.prepareAuthBJJCredential(genesisDID);
        const signature = await this._identityWallet.signChallenge(challenge, authPrepared.credential);
        const id = DID.idFromDID(genesisDID);
        const stateProof = await this._stateStorage.getGISTProof(id.bigInt());
        const gistProof = toGISTProof(stateProof);
        const authInputs = new AuthV2Inputs();
        authInputs.genesisID = id;
        authInputs.profileNonce = BigInt(authProfileNonce);
        authInputs.authClaim = authPrepared.coreClaim;
        authInputs.authClaimIncMtp = authPrepared.incProof.proof;
        authInputs.authClaimNonRevMtp = authPrepared.nonRevProof.proof;
        authInputs.treeState = authPrepared.incProof.treeState;
        authInputs.signature = signature;
        authInputs.challenge = challenge;
        authInputs.gistProof = gistProof;
        return authInputs.inputsMarshal();
    }
    /** {@inheritdoc IProofService.generateAuthV2Proof} */
    async generateAuthV2Proof(challenge, did) {
        const authInputs = await this.generateAuthV2Inputs(challenge, did, CircuitId.AuthV2);
        const zkProof = await this._prover.generate(authInputs, CircuitId.AuthV2);
        return zkProof;
    }
    async verifyState(circuitId, pubSignals, opts = {
        acceptedStateTransitionDelay: PROTOCOL_CONSTANTS.DEFAULT_AUTH_VERIFY_DELAY
    }) {
        if (circuitId !== CircuitId.AuthV2) {
            throw new Error(`CircuitId is not supported ${circuitId}`);
        }
        const authV2PubSignals = new AuthV2PubSignals().pubSignalsUnmarshal(byteEncoder.encode(JSON.stringify(pubSignals)));
        const gistRoot = authV2PubSignals.GISTRoot.bigInt();
        const userId = authV2PubSignals.userID.bigInt();
        const globalStateInfo = await this._stateStorage.getGISTRootInfo(gistRoot, userId);
        if (globalStateInfo.root !== gistRoot) {
            throw new Error(`gist info contains invalid state`);
        }
        if (globalStateInfo.replacedByRoot !== 0n) {
            if (globalStateInfo.replacedAtTimestamp === 0n) {
                throw new Error(`state was replaced, but replaced time unknown`);
            }
            const timeDiff = Date.now() -
                getDateFromUnixTimestamp(Number(globalStateInfo.replacedAtTimestamp)).getTime();
            if (timeDiff >
                (opts?.acceptedStateTransitionDelay ?? PROTOCOL_CONSTANTS.DEFAULT_AUTH_VERIFY_DELAY)) {
                throw new Error('global state is outdated');
            }
        }
        return true;
    }
    async findCredentialByProofQuery(did, query) {
        const credentials = await this._identityWallet.findOwnedCredentialsByDID(did, query);
        if (!credentials.length) {
            throw new Error(VerifiableConstants.ERRORS.PROOF_SERVICE_NO_CREDENTIAL_FOR_IDENTITY_OR_PROFILE);
        }
        //  For EQ / IN / NIN / LT / GT operations selective if credential satisfies query - we can get any.
        // TODO: choose credential for selective credentials
        const credential = query.skipClaimRevocationCheck
            ? { cred: credentials[0], revStatus: undefined }
            : await this._credentialWallet.findNonRevokedCredential(credentials);
        return credential;
    }
}
