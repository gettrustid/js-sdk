import { MediaType, PROTOCOL_MESSAGE_TYPE } from '../constants';
import * as uuid from 'uuid';
import { DiscoverFeatureQueryType, DiscoveryProtocolFeatureType } from '../types/protocol/discovery-protocol';
import { AbstractMessageHandler } from './message-handler';
import { getUnixTimestamp } from 'js-iden3-core-custom';
import { verifyExpiresTime } from './common';
/**
 * @beta
 * createDiscoveryFeatureQueryMessage is a function to create didcomm protocol discovery-feature query message
 * @param opts - discovery-feature query options
 * @returns `DiscoverFeatureQueriesMessage`
 */
export function createDiscoveryFeatureQueryMessage(queries, opts) {
    const uuidv4 = uuid.v4();
    return {
        id: uuidv4,
        thid: uuidv4,
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE,
        body: {
            queries
        },
        from: opts?.from,
        to: opts?.to,
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time
    };
}
/**
 * @beta
 * createDiscoveryFeatureDiscloseMessage is a function to create didcomm protocol discovery-feature disclose message
 * @param {DiscoverFeatureDisclosure[]} disclosures - array of disclosures
 * @param opts - basic message options
 * @returns `DiscoverFeatureQueriesMessage`
 */
export function createDiscoveryFeatureDiscloseMessage(disclosures, opts) {
    const uuidv4 = uuid.v4();
    return {
        id: uuidv4,
        typ: MediaType.PlainMessage,
        thid: uuidv4,
        type: PROTOCOL_MESSAGE_TYPE.DISCOVERY_PROTOCOL_DISCLOSE_MESSAGE_TYPE,
        body: {
            disclosures
        },
        from: opts?.from,
        to: opts?.to,
        created_time: getUnixTimestamp(new Date()),
        expires_time: opts?.expires_time
    };
}
/**
 *
 * Handler for discovery protocol
 *
 * @public
 * @beta
 * @class DiscoveryProtocolHandler
 * @implements implements DiscoveryProtocolHandler interface
 */
export class DiscoveryProtocolHandler extends AbstractMessageHandler {
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
            case PROTOCOL_MESSAGE_TYPE.DISCOVERY_PROTOCOL_QUERIES_MESSAGE_TYPE:
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
            verifyExpiresTime(message);
        }
        const disclosures = [];
        for (const query of message.body.queries) {
            disclosures.push(...this.handleQuery(query));
        }
        return Promise.resolve(createDiscoveryFeatureDiscloseMessage(disclosures, {
            to: message.from,
            from: message.to,
            expires_time: opts?.disclosureExpiresDate
                ? getUnixTimestamp(opts.disclosureExpiresDate)
                : undefined
        }));
    }
    handleQuery(query) {
        let result = [];
        switch (query[DiscoverFeatureQueryType.FeatureType]) {
            case DiscoveryProtocolFeatureType.Accept:
                result = this.handleAcceptQuery();
                break;
            case DiscoveryProtocolFeatureType.Protocol:
                result = this.handleProtocolQuery();
                break;
            case DiscoveryProtocolFeatureType.GoalCode:
                result = this.handleGoalCodeQuery();
                break;
            case DiscoveryProtocolFeatureType.Header:
                result = this.handleHeaderQuery();
                break;
        }
        return this.handleMatch(result, query.match);
    }
    handleAcceptQuery() {
        const acceptProfiles = this._options.packageManager.getSupportedProfiles();
        return acceptProfiles.map((profile) => ({
            [DiscoverFeatureQueryType.FeatureType]: DiscoveryProtocolFeatureType.Accept,
            id: profile
        }));
    }
    handleProtocolQuery() {
        return (this._options.protocols?.map((protocol) => ({
            [DiscoverFeatureQueryType.FeatureType]: DiscoveryProtocolFeatureType.Protocol,
            id: protocol
        })) ?? []);
    }
    handleGoalCodeQuery() {
        return (this._options.goalCodes?.map((goalCode) => ({
            [DiscoverFeatureQueryType.FeatureType]: DiscoveryProtocolFeatureType.GoalCode,
            id: goalCode
        })) ?? []);
    }
    handleHeaderQuery() {
        return (this._options.headers?.map((header) => ({
            [DiscoverFeatureQueryType.FeatureType]: DiscoveryProtocolFeatureType.Header,
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
