"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardJSONCredentialsQueryFilter = exports.FilterQuery = exports.resolvePath = exports.comparatorOptions = exports.SupportedDataFormat = exports.SearchError = void 0;
/**
 * search errors
 *
 * @enum {number}
 */
var SearchError;
(function (SearchError) {
    SearchError["NotDefinedQueryKey"] = "not defined query key";
    SearchError["NotDefinedComparator"] = "not defined comparator";
})(SearchError = exports.SearchError || (exports.SearchError = {}));
/**
 * supported data formats
 *
 * @enum {number}
 */
var SupportedDataFormat;
(function (SupportedDataFormat) {
    SupportedDataFormat[SupportedDataFormat["BigInt"] = 0] = "BigInt";
    SupportedDataFormat[SupportedDataFormat["Boolean"] = 1] = "Boolean";
    SupportedDataFormat[SupportedDataFormat["Double"] = 2] = "Double";
    SupportedDataFormat[SupportedDataFormat["DateTime"] = 3] = "DateTime";
    SupportedDataFormat[SupportedDataFormat["String"] = 4] = "String";
})(SupportedDataFormat = exports.SupportedDataFormat || (exports.SupportedDataFormat = {}));
const truthyValues = [true, 1, 'true'];
const falsyValues = [false, 0, 'false'];
const equalsComparator = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return (a.length === b.length && a.every((val, index) => val === b[index]));
    }
    if (!Array.isArray(a) && Array.isArray(b)) {
        return b.includes(a);
    }
    if (Array.isArray(a) && !Array.isArray(b)) {
        return a.includes(b);
    }
    a = a;
    b = b;
    if (truthyValues.includes(a) && truthyValues.includes(b)) {
        return true;
    }
    if (falsyValues.includes(a) && falsyValues.includes(b)) {
        return true;
    }
    return a === b;
};
const greaterThan = (a, b) => {
    const predicate = (a, b) => {
        const dataFormat = detectDataFormat(a.toString());
        switch (dataFormat) {
            case SupportedDataFormat.BigInt:
            case SupportedDataFormat.Boolean:
                return BigInt(a) > BigInt(b);
            case SupportedDataFormat.DateTime:
                return Date.parse(a.toString()) > Date.parse(b.toString()); /// nanoseconds won't be compared.
            case SupportedDataFormat.Double:
            case SupportedDataFormat.String:
            default:
                return a > b;
        }
    };
    return operatorIndependentCheck(a, b, predicate);
};
const greaterThanOrEqual = (a, b) => {
    const predicate = (a, b) => {
        const dataFormat = detectDataFormat(a.toString());
        switch (dataFormat) {
            case SupportedDataFormat.BigInt:
            case SupportedDataFormat.Boolean:
                return BigInt(a) >= BigInt(b);
            case SupportedDataFormat.DateTime:
                return Date.parse(a.toString()) >= Date.parse(b.toString()); /// nanoseconds won't be compared.
            case SupportedDataFormat.Double:
            case SupportedDataFormat.String:
            default:
                return a >= b;
        }
    };
    return operatorIndependentCheck(a, b, predicate);
};
// a - field value
// b - true / false (exists operator values)
const existsComparator = (a, b) => {
    if (truthyValues.includes(b) && typeof a !== 'undefined') {
        // if exists val is true , a field val exists
        return true;
    }
    // if exists val is false , a field val doesn't exist
    if (falsyValues.includes(b) && (a === undefined || (Array.isArray(a) && !a.length))) {
        return true;
    }
    return false;
};
const inOperator = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.every((val) => b.includes(val));
    }
    if (!Array.isArray(a) && Array.isArray(b)) {
        return b.includes(a);
    }
    if (Array.isArray(a) && !Array.isArray(b)) {
        return a.includes(b);
    }
    return false;
};
const betweenOperator = (a, b) => {
    if (!Array.isArray(b) || b.length !== 2) {
        throw new Error('$between/$nonbetween operator value should be 2 elements array');
    }
    const [min, max] = b.map(BigInt);
    const predicate = (val) => val >= min && val <= max;
    if (Array.isArray(a)) {
        return a.map(BigInt).every(predicate);
    }
    return predicate(BigInt(a));
};
exports.comparatorOptions = {
    $noop: () => true,
    $sd: () => true,
    $exists: (a, b) => existsComparator(a, b),
    $eq: (a, b) => equalsComparator(a, b),
    $in: (a, b) => inOperator(a, b),
    $nin: (a, b) => !inOperator(a, b),
    $gt: (a, b) => greaterThan(a, b),
    $lt: (a, b) => !greaterThanOrEqual(a, b),
    $ne: (a, b) => !equalsComparator(a, b),
    $gte: (a, b) => greaterThanOrEqual(a, b),
    $lte: (a, b) => !greaterThan(a, b),
    $between: (a, b) => betweenOperator(a, b),
    $nonbetween: (a, b) => !betweenOperator(a, b)
};
/**
 * credential search path resolver
 *
 * @param {object} object - object to query
 * @param {string} path - given path
 * @param {*} [defaultValue=null]
 */
const resolvePath = (object, path, defaultValue = null) => {
    const pathParts = path.split('.');
    let o = object;
    for (const part of pathParts) {
        if (o === null || o === undefined) {
            return defaultValue;
        }
        o = o[part];
    }
    return o;
};
exports.resolvePath = resolvePath;
/**
 * Filter for queries of credentialSubject with a json path e.g  birthday.date
 *
 *
 * @public
 * @class FilterQuery
 * @implements implements IFilterQuery interface
 */
class FilterQuery {
    /**
     * Creates an instance of FilterQuery.
     * @param {string} path
     * @param {FilterOperatorFunction} operatorFunc
     * @param {*} value
     * @param {boolean} [isReverseParams=false]
     */
    constructor(path, operatorFunc, value, isReverseParams = false) {
        this.path = path;
        this.operatorFunc = operatorFunc;
        this.value = value;
        this.isReverseParams = isReverseParams;
    }
    /** {@inheritdoc IFilterQuery} */
    execute(credential) {
        if (!this.operatorFunc) {
            throw new Error(SearchError.NotDefinedComparator);
        }
        const credentialPathValue = (0, exports.resolvePath)(credential, this.path);
        if ((credentialPathValue === null || credentialPathValue === undefined) &&
            this.operatorFunc !== exports.comparatorOptions.$exists) {
            return false;
        }
        if (this.isReverseParams) {
            return this.operatorFunc(this.value, credentialPathValue);
        }
        return this.operatorFunc(credentialPathValue, this.value);
    }
}
exports.FilterQuery = FilterQuery;
/**
 * creates filters based on proof query
 * @param {ProofQuery} query - proof query
 * @returns {*}  {FilterQuery[]} - array of filters to apply
 */
const StandardJSONCredentialsQueryFilter = (query) => {
    return Object.keys(query).reduce((acc, queryKey) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queryValue = query[queryKey];
        switch (queryKey) {
            case 'claimId':
                return acc.concat(new FilterQuery('id', exports.comparatorOptions.$eq, queryValue));
            case 'allowedIssuers': {
                const queryValueParam = queryValue || ['*'];
                if (queryValueParam.includes('*')) {
                    return acc;
                }
                return acc.concat(new FilterQuery('issuer', exports.comparatorOptions.$in, queryValue));
            }
            case 'type':
                return acc.concat(new FilterQuery('type', exports.comparatorOptions.$in, queryValue, true));
            case 'context':
                return acc.concat(new FilterQuery('@context', exports.comparatorOptions.$in, queryValue, true));
            case 'credentialSubjectId':
                return acc.concat(new FilterQuery('credentialSubject.id', exports.comparatorOptions.$eq, queryValue));
            case 'schema':
                return acc.concat(new FilterQuery('credentialSchema.id', exports.comparatorOptions.$eq, queryValue));
            case 'credentialSubject': {
                const reqFilters = Object.keys(queryValue).reduce((acc, fieldKey) => {
                    const fieldParams = queryValue[fieldKey];
                    if (typeof fieldParams === 'object' && Object.keys(fieldParams).length === 0) {
                        return acc.concat([
                            new FilterQuery(`credentialSubject.${fieldKey}`, exports.comparatorOptions.$noop, null)
                        ]);
                    }
                    const res = Object.keys(fieldParams).map((comparator) => {
                        const value = fieldParams[comparator];
                        const path = `credentialSubject.${fieldKey}`;
                        return new FilterQuery(path, exports.comparatorOptions[comparator], value);
                    });
                    return acc.concat(res);
                }, []);
                return acc.concat(reqFilters);
            }
            case 'proofType':
            case 'groupId':
            case 'skipClaimRevocationCheck': {
                return acc;
            }
            default:
                throw new Error(`${queryKey} : ${SearchError.NotDefinedQueryKey}`);
        }
    }, []);
};
exports.StandardJSONCredentialsQueryFilter = StandardJSONCredentialsQueryFilter;
const operatorIndependentCheck = (a, b, predicate) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.every((val, index) => predicate(val, b[index]));
    }
    if (!Array.isArray(a) && Array.isArray(b)) {
        return b.every((val) => predicate(a, val));
    }
    if (Array.isArray(a) && !Array.isArray(b)) {
        return a.every((val) => predicate(val, b));
    }
    // in this case a and b are not arrays
    return predicate(a, b);
};
const regExBigInt = /^[+-]?\d+$/;
const regExDouble = /^(-?)(0|([1-9][0-9]*))(\\.[0-9]+)?$/;
const regExDateTimeRFC3339Nano = 
/* eslint-disable-next-line */
/^([0-9]+)-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])[Tt]([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(([Zz])|([\+|\-]([01][0-9]|2[0-3]):[0-5][0-9]))$/;
const regExBoolean = /^(true)|(false)$/;
const regExDateTimeYYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;
const detectDataFormat = (s) => regExBigInt.test(s)
    ? SupportedDataFormat.BigInt
    : regExDouble.test(s)
        ? SupportedDataFormat.Double
        : regExDateTimeRFC3339Nano.test(s) || regExDateTimeYYYYMMDD.test(s)
            ? SupportedDataFormat.DateTime
            : regExBoolean.test(s)
                ? SupportedDataFormat.Boolean
                : SupportedDataFormat.String;
