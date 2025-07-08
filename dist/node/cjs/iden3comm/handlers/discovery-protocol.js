"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryProtocolHandler = exports.createDiscoveryFeatureDiscloseMessage = exports.createDiscoveryFeatureQueryMessage = void 0;
const constants_1 = require("../constants");
const uuid = __importStar(require("uuid"));
const discovery_protocol_1 = require("../types/protocol/discovery-protocol");
const message_handler_1 = require("./message-handler");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const common_1 = require("./common");
/**
 * @beta
 * createDiscoveryFeatureQueryMessage is a function to create didcomm protocol discovery-feature query message
 * @param opts - discovery-feature query options
 * @returns `DiscoverFeatureQueriesMessage`
 */
function createDiscoveryFeatureQueryMessage(queries, opts) {
    const uuidv4 = uuid.v4();
    return {
        id: uuidv4,
        thid: uuidv4,
        typ: constants_1.MediaType.PlainMessage,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE,
        body: {
            queries
        },
        from: opts?.from,
        to: opts?.to,
        created_time: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date()),
        expires_time: opts?.expires_time
    };
}
exports.createDiscoveryFeatureQueryMessage = createDiscoveryFeatureQueryMessage;
/**
 * @beta
 * createDiscoveryFeatureDiscloseMessage is a function to create didcomm protocol discovery-feature disclose message
 * @param {DiscoverFeatureDisclosure[]} disclosures - array of disclosures
 * @param opts - basic message options
 * @returns `DiscoverFeatureQueriesMessage`
 */
function createDiscoveryFeatureDiscloseMessage(disclosures, opts) {
    const uuidv4 = uuid.v4();
    return {
        id: uuidv4,
        typ: constants_1.MediaType.PlainMessage,
        thid: uuidv4,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.DISCOVERY_PROTOCOL_DISCLOSE_MESSAGE_TYPE,
        body: {
            disclosures
        },
        from: opts?.from,
        to: opts?.to,
        created_time: (0, js_iden3_core_custom_1.getUnixTimestamp)(new Date()),
        expires_time: opts?.expires_time
    };
}
exports.createDiscoveryFeatureDiscloseMessage = createDiscoveryFeatureDiscloseMessage;
/**
 *
 * Handler for discovery protocol
 *
 * @public
 * @beta
 * @class DiscoveryProtocolHandler
 * @implements implements DiscoveryProtocolHandler interface
 */
class DiscoveryProtocolHandler extends message_handler_1.AbstractMessageHandler {
    /**
     * Creates an instance of DiscoveryProtocolHandler.
     * @param {DiscoveryProtocolOptions} _options - discovery protocol options
     */
    constructor(_options) {
        super();
        this._options = _options;
        const headers = [
            'id',
            'typ',
            'type',
            'thid',
            'body',
            'from',
            'to',
            'created_time',
            'expires_time'
        ];
        if (!_options.headers) {
            _options.headers = headers;
        }
    }
    /**
     * @inheritdoc IProtocolMessageHandler#handle
     */
    async handle(message, context) {
        switch (message.type) {
            case constants_1.PROTOCOL_MESSAGE_TYPE.DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE:
                return await this.handleDiscoveryQuery(message, context);
            default:
                return super.handle(message, context);
        }
    }
    /**
     * @inheritdoc IDiscoveryProtocolHandler#handleDiscoveryQuery
     */
    async handleDiscoveryQuery(message, opts) {
        if (!opts?.allowExpiredMessages) {
            (0, common_1.verifyExpiresTime)(message);
        }
        const disclosures = [];
        for (const query of message.body.queries) {
            disclosures.push(...this.handleQuery(query));
        }
        return Promise.resolve(createDiscoveryFeatureDiscloseMessage(disclosures, {
            to: message.from,
            from: message.to,
            expires_time: opts?.disclosureExpiresDate
                ? (0, js_iden3_core_custom_1.getUnixTimestamp)(opts.disclosureExpiresDate)
                : undefined
        }));
    }
    handleQuery(query) {
        let result = [];
        switch (query[discovery_protocol_1.DiscoverFeatureQueryType.FeatureType]) {
            case discovery_protocol_1.DiscoveryProtocolFeatureType.Accept:
                result = this.handleAcceptQuery();
                break;
            case discovery_protocol_1.DiscoveryProtocolFeatureType.Protocol:
                result = this.handleProtocolQuery();
                break;
            case discovery_protocol_1.DiscoveryProtocolFeatureType.GoalCode:
                result = this.handleGoalCodeQuery();
                break;
            case discovery_protocol_1.DiscoveryProtocolFeatureType.Header:
                result = this.handleHeaderQuery();
                break;
        }
        return this.handleMatch(result, query.match);
    }
    handleAcceptQuery() {
        const acceptProfiles = this._options.packageManager.getSupportedProfiles();
        return acceptProfiles.map((profile) => ({
            [discovery_protocol_1.DiscoverFeatureQueryType.FeatureType]: discovery_protocol_1.DiscoveryProtocolFeatureType.Accept,
            id: profile
        }));
    }
    handleProtocolQuery() {
        return (this._options.protocols?.map((protocol) => ({
            [discovery_protocol_1.DiscoverFeatureQueryType.FeatureType]: discovery_protocol_1.DiscoveryProtocolFeatureType.Protocol,
            id: protocol
        })) ?? []);
    }
    handleGoalCodeQuery() {
        return (this._options.goalCodes?.map((goalCode) => ({
            [discovery_protocol_1.DiscoverFeatureQueryType.FeatureType]: discovery_protocol_1.DiscoveryProtocolFeatureType.GoalCode,
            id: goalCode
        })) ?? []);
    }
    handleHeaderQuery() {
        return (this._options.headers?.map((header) => ({
            [discovery_protocol_1.DiscoverFeatureQueryType.FeatureType]: discovery_protocol_1.DiscoveryProtocolFeatureType.Header,
            id: header
        })) ?? []);
    }
    handleMatch(disclosures, match) {
        if (!match || match === '*') {
            return disclosures;
        }
        const regExp = this.wildcardToRegExp(match);
        return disclosures.filter((disclosure) => regExp.test(disclosure.id));
    }
    wildcardToRegExp(match) {
        // Escape special regex characters, then replace `*` with `.*`
        const regexPattern = match.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`);
    }
}
exports.DiscoveryProtocolHandler = DiscoveryProtocolHandler;
