"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAcceptProfile = exports.buildAccept = void 0;
const constants_1 = require("../constants");
function isProtocolVersion(value) {
    return Object.values(constants_1.ProtocolVersion).includes(value);
}
function isMediaType(value) {
    return Object.values(constants_1.MediaType).includes(value);
}
function isAcceptAuthCircuits(value) {
    return Object.values(constants_1.AcceptAuthCircuits).includes(value);
}
function isAcceptJwsAlgorithms(value) {
    return Object.values(constants_1.AcceptJwsAlgorithms).includes(value);
}
function isAcceptJwzAlgorithms(value) {
    return Object.values(constants_1.AcceptJwzAlgorithms).includes(value);
}
const buildAccept = (profiles) => {
    const result = [];
    for (const profile of profiles) {
        let accept = `${profile.protocolVersion};env=${profile.env}`;
        if (profile.circuits?.length) {
            accept += `;circuitId=${profile.circuits.join(',')}`;
        }
        if (profile.alg?.length) {
            accept += `;alg=${profile.alg.join(',')}`;
        }
        result.push(accept);
    }
    return result;
};
exports.buildAccept = buildAccept;
const parseAcceptProfile = (profile) => {
    const params = profile.split(';');
    if (params.length < 2) {
        throw new Error('Invalid accept profile');
    }
    const protocolVersion = params[0].trim();
    if (!isProtocolVersion(protocolVersion)) {
        throw new Error(`Protocol version '${protocolVersion}' not supported`);
    }
    const envParam = params[1].split('=');
    if (envParam.length !== 2) {
        throw new Error(`Invalid accept profile 'env' parameter`);
    }
    const env = params[1].split('=')[1].trim();
    if (!isMediaType(env)) {
        throw new Error(`Envelop '${env}' not supported`);
    }
    const circuitsIndex = params.findIndex((i) => i.includes('circuitId='));
    if (env !== constants_1.MediaType.ZKPMessage && circuitsIndex > 0) {
        throw new Error(`Circuits not supported for env '${env}'`);
    }
    let circuits = undefined;
    if (circuitsIndex > 0) {
        circuits = params[circuitsIndex]
            .split('=')[1]
            .split(',')
            .map((i) => i.trim())
            .map((i) => {
            if (!isAcceptAuthCircuits(i)) {
                throw new Error(`Circuit '${i}' not supported`);
            }
            return i;
        });
    }
    const algIndex = params.findIndex((i) => i.includes('alg='));
    let alg = undefined;
    if (algIndex > 0) {
        if (env === constants_1.MediaType.ZKPMessage) {
            alg = params[algIndex]
                .split('=')[1]
                .split(',')
                .map((i) => {
                i = i.trim();
                if (!isAcceptJwzAlgorithms(i)) {
                    throw new Error(`Algorithm '${i}' not supported for '${env}'`);
                }
                return i;
            });
        }
        else if (env === constants_1.MediaType.SignedMessage) {
            alg = params[algIndex]
                .split('=')[1]
                .split(',')
                .map((i) => {
                i = i.trim();
                if (!isAcceptJwsAlgorithms(i)) {
                    throw new Error(`Algorithm '${i}' not supported for '${env}'`);
                }
                return i;
            });
        }
        else {
            throw new Error(`Algorithm not supported for '${env}'`);
        }
    }
    return {
        protocolVersion,
        env,
        circuits,
        alg
    };
};
exports.parseAcceptProfile = parseAcceptProfile;
