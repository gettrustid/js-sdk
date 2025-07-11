import { verifyGroth16Proof } from '@iden3/js-jwz';
import { witnessBuilder } from './witness_calculator';
import { groth16 } from 'snarkjs';
import { getCurveFromName } from 'ffjavascript';
import { byteDecoder } from '../../utils';
/**
 *  NativeProver service responsible for zk generation and verification of groth16 algorithm with bn128 curve
 * @public
 * @class NativeProver
 * @implements implements IZKProver interface
 */
export class NativeProver {
    constructor(_circuitStorage) {
        this._circuitStorage = _circuitStorage;
    }
    /**
     * verifies zero knowledge proof
     *
     * @param {ZKProof} zkp - zero knowledge proof that will be verified
     * @param {string} circuitId - circuit id for proof verification
     * @returns `Promise<ZKProof>`
     */
    async verify(zkp, circuitId) {
        try {
            const circuitData = await this._circuitStorage.loadCircuitData(circuitId);
            if (!circuitData.verificationKey) {
                throw new Error(`verification file doesn't exist for circuit ${circuitId}`);
            }
            return verifyGroth16Proof(zkp, JSON.parse(byteDecoder.decode(circuitData.verificationKey)));
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.log(e);
            return false;
        }
    }
    /**
     * generates zero knowledge proof
     *
     * @param {Uint8Array} inputs - inputs that will be used for proof generation
     * @param {string} circuitId - circuit id for proof generation
     * @returns `Promise<ZKProof>`
     */
    async generate(inputs, circuitId) {
        const circuitData = await this._circuitStorage.loadCircuitData(circuitId);
        if (!circuitData.wasm) {
            throw new Error(`wasm file doesn't exist for circuit ${circuitId}`);
        }
        const witnessCalculator = await witnessBuilder(circuitData.wasm);
        const parsedData = JSON.parse(byteDecoder.decode(inputs));
        const wtnsBytes = await witnessCalculator.calculateWTNSBin(parsedData, 0);
        if (!circuitData.provingKey) {
            throw new Error(`proving file doesn't exist for circuit ${circuitId}`);
        }
        const { proof, publicSignals } = await groth16.prove(circuitData.provingKey, wtnsBytes);
        // we need to terminate curve manually
        await this.terminateCurve();
        return {
            proof,
            pub_signals: publicSignals
        };
    }
    async terminateCurve() {
        const curve = await getCurveFromName(NativeProver.curveName);
        curve.terminate();
    }
}
NativeProver.curveName = 'bn128';
