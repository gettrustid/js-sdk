// or ESM/TypeScript import
import Ajv from 'ajv';
import { byteDecoder } from '../../utils';
import Ajv2020 from 'ajv/dist/2020';
import Ajv2019 from 'ajv/dist/2019';
import addFormats from 'ajv-formats';
const defaultOpts = { verbose: true, strict: false };
const defaultJSONSchemaValidator = new Ajv(defaultOpts);
/** JSON SCHEMA VALIDATOR REGISTRY */
export const JSON_SCHEMA_VALIDATORS_REGISTRY = {
    'http://json-schema.org/draft-07/schema': defaultJSONSchemaValidator,
    'https://json-schema.org/draft/2019-09/schema': new Ajv2019(defaultOpts),
    'https://json-schema.org/draft/2020-12/schema': new Ajv2020(defaultOpts)
};
/**
 * JSON Schema Validator
 *
 * @public
 * @class JsonSchemaValidator
 */
export class JsonSchemaValidator {
    /**
     * Validate data according to the given schema
     *
     * @param {Uint8Array} dataBytes - payload to validate
     * @param {Uint8Array} schemaBytes - schema to process
     * @returns `Promise<boolean>`
     */
    async validate(dataBytes, schemaBytes) {
        const schema = JSON.parse(byteDecoder.decode(schemaBytes));
        const data = JSON.parse(byteDecoder.decode(dataBytes));
        const draft = schema['$schema']?.replaceAll('#', '');
        let validator;
        if (!draft) {
            validator = defaultJSONSchemaValidator;
        }
        const ajv = JSON_SCHEMA_VALIDATORS_REGISTRY[draft];
        validator = ajv ?? defaultJSONSchemaValidator;
        if (validator.formats && !Object.keys(validator.formats).length) {
            addFormats(validator);
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
