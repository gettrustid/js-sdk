"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVerifiablePresentation = exports.findValue = exports.buildFieldPath = exports.stringByPath = void 0;
const constants_1 = require("./constants");
const js_jsonld_merklization_1 = require("@iden3/js-jsonld-merklization");
const stringByPath = (obj, path) => {
    const parts = path.split('.');
    let value = obj;
    for (let index = 0; index < parts.length; index++) {
        const key = parts[index];
        if (!key) {
            throw new Error('path is empty');
        }
        value = value[key];
        if (value === undefined) {
            throw new Error('path not found');
        }
    }
    return value.toString();
};
exports.stringByPath = stringByPath;
const buildFieldPath = async (ldSchema, contextType, field, opts) => {
    let path = new js_jsonld_merklization_1.Path();
    if (field) {
        path = await js_jsonld_merklization_1.Path.getContextPathKey(ldSchema, contextType, field, opts);
    }
    path.prepend([constants_1.VerifiableConstants.CREDENTIAL_SUBJECT_PATH]);
    return path;
};
exports.buildFieldPath = buildFieldPath;
const findValue = (fieldName, credential) => {
    const [first, ...rest] = fieldName.split('.');
    let v = credential.credentialSubject[first];
    for (const part of rest) {
        v = v[part];
    }
    return v;
};
exports.findValue = findValue;
const createVerifiablePresentation = (context, tp, credential, queries) => {
    const baseContext = [constants_1.VerifiableConstants.JSONLD_SCHEMA.W3C_CREDENTIAL_2018];
    const ldContext = baseContext[0] === context ? baseContext : [...baseContext, context];
    const vc = constants_1.VerifiableConstants.CREDENTIAL_TYPE.W3C_VERIFIABLE_CREDENTIAL;
    const vcTypes = [vc];
    if (tp !== vc) {
        vcTypes.push(tp);
    }
    const skeleton = {
        '@context': baseContext,
        type: constants_1.VerifiableConstants.CREDENTIAL_TYPE.W3C_VERIFIABLE_PRESENTATION,
        verifiableCredential: {
            '@context': ldContext,
            type: vcTypes,
            credentialSubject: {
                type: tp
            }
        }
    };
    let result = {};
    for (const query of queries) {
        const parts = query.fieldName.split('.');
        const current = parts.reduceRight((acc, part) => {
            if (result[part]) {
                return { [part]: { ...result[part], ...acc } };
            }
            return { [part]: acc };
        }, (0, exports.findValue)(query.fieldName, credential));
        result = { ...result, ...current };
    }
    skeleton.verifiableCredential.credentialSubject = {
        ...skeleton.verifiableCredential.credentialSubject,
        ...result
    };
    return skeleton;
};
exports.createVerifiablePresentation = createVerifiablePresentation;
