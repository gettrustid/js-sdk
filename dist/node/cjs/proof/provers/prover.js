"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeProver = void 0;
const js_jwz_1 = require("@iden3/js-jwz");
const witness_calculator_1 = require("./witness_calculator");
const snarkjs_1 = require("snarkjs");
const ffjavascript_1 = require("ffjavascript");
const utils_1 = require("../../utils");
/**
 *  NativeProver service responsible for zk generation and verification of groth16 algorithm with bn128 curve
 * @public
 * @class NativeProver
 * @implements implements IZKProver interface
 */
class NativeProver {
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
            return (0, js_jwz_1.verifyGroth16Proof)(zkp, JSON.parse(utils_1.byteDecoder.decode(circuitData.verificationKey)));
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
        const witnessCalculator = await (0, witness_calculator_1.witnessBuilder)(circuitData.wasm);
        const parsedData = JSON.parse(utils_1.byteDecoder.decode(inputs));
        const wtnsBytes = await witnessCalculator.calculateWTNSBin(parsedData, 0);
        if (!circuitData.provingKey) {
            throw new Error(`proving file doesn't exist for circuit ${circuitId}`);
        }
        const { proof, publicSignals } = await snarkjs_1.groth16.prove(circuitData.provingKey, wtnsBytes);
        // we need to terminate curve manually
        await this.terminateCurve();
        return {
            proof,
            pub_signals: publicSignals
        };
    }
    async terminateCurve() {
        const curve = await (0, ffjavascript_1.getCurveFromName)(NativeProver.curveName);
        curve.terminate();
    }
}
exports.NativeProver = NativeProver;
NativeProver.curveName = 'bn128';
