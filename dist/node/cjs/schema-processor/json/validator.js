"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonSchemaValidator = exports.JSON_SCHEMA_VALIDATORS_REGISTRY = void 0;
// or ESM/TypeScript import
const ajv_1 = __importDefault(require("ajv"));
const utils_1 = require("../../utils");
const _2020_1 = __importDefault(require("ajv/dist/2020"));
const _2019_1 = __importDefault(require("ajv/dist/2019"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const defaultOpts = { verbose: true, strict: false };
const defaultJSONSchemaValidator = new ajv_1.default(defaultOpts);
/** JSON SCHEMA VALIDATOR REGISTRY */
exports.JSON_SCHEMA_VALIDATORS_REGISTRY = {
    'http://json-schema.org/draft-07/schema': defaultJSONSchemaValidator,
    'https://json-schema.org/draft/2019-09/schema': new _2019_1.default(defaultOpts),
    'https://json-schema.org/draft/2020-12/schema': new _2020_1.default(defaultOpts)
};
/**
 * JSON Schema Validator
 *
 * @public
 * @class JsonSchemaValidator
 */
class JsonSchemaValidator {
    /**
     * Validate data according to the given schema
     *
     * @param {Uint8Array} dataBytes - payload to validate
     * @param {Uint8Array} schemaBytes - schema to process
     * @returns `Promise<boolean>`
     */
    async validate(dataBytes, schemaBytes) {
        const schema = JSON.parse(utils_1.byteDecoder.decode(schemaBytes));
        const data = JSON.parse(utils_1.byteDecoder.decode(dataBytes));
        const draft = schema['$schema']?.replaceAll('#', '');
        let validator;
        if (!draft) {
            validator = defaultJSONSchemaValidator;
        }
        const ajv = exports.JSON_SCHEMA_VALIDATORS_REGISTRY[draft];
        validator = ajv ?? defaultJSONSchemaValidator;
        if (validator.formats && !Object.keys(validator.formats).length) {
            (0, ajv_formats_1.default)(validator);
            addCustomFormats(validator);
        }
        const validate = (schema.$id ? validator.getSchema(schema.$id) : undefined) || validator.compile(schema);
        const valid = validate(data);
        if (!valid) {
            // TODO: extract correct error messages
            throw new Error(validate.errors?.map((e) => e.message).join(', '));
        }
        return true;
    }
}
exports.JsonSchemaValidator = JsonSchemaValidator;
function addCustomFormats(validator) {
    validator.addFormat('positive-integer', {
        type: 'string',
        validate: (positiveIntegerStr) => /^[1-9]\d*$/.test(positiveIntegerStr)
    });
    validator.addFormat('non-negative-integer', {
        type: 'string',
        validate: (nonNegativeIntegerStr) => /^(0|[1-9]\d*)$/.test(nonNegativeIntegerStr)
    });
}
