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
exports.RefreshHandler = void 0;
const constants_1 = require("../constants");
const constants_2 = require("../constants");
const verifiable_1 = require("../../verifiable");
const utils_1 = require("../../utils");
const js_jwz_1 = require("@iden3/js-jwz");
const js_iden3_core_custom_1 = require("js-iden3-core-custom");
const circuits_1 = require("../../circuits");
const uuid = __importStar(require("uuid"));
/**
 *
 * Allows to refresh credential from refresh service and return refreshed credential
 *
 * @public

 * @class RefreshHandler
 * @implements implements RefreshHandler interface
 */
class RefreshHandler {
    /**
     * Creates an instance of RefreshHandler.
     * @param {RefreshHandlerOptions} _options - refresh handler options
     */
    constructor(_options) {
        this._options = _options;
    }
    async refreshCredential(credential, opts) {
        if (!credential.refreshService) {
            throw new Error('refreshService not specified for W3CCredential');
        }
        if (credential.refreshService.type !== verifiable_1.RefreshServiceType.Iden3RefreshService2023) {
            throw new Error(`refresh service type ${credential.refreshService.type} is not supported`);
        }
        const otherIdentifier = credential.credentialSubject.id;
        if (!otherIdentifier) {
            throw new Error('self credentials do not support refresh');
        }
        const senderDID = js_iden3_core_custom_1.DID.parse(otherIdentifier);
        const zkpParams = {
            senderDID,
            provingMethodAlg: new js_jwz_1.ProvingMethodAlg(js_jwz_1.proving.provingMethodGroth16AuthV2Instance.methodAlg.alg, circuits_1.CircuitId.AuthV2)
        };
        const refreshMsg = {
            id: uuid.v4(),
            typ: constants_1.MediaType.ZKPMessage,
            type: constants_2.PROTOCOL_MESSAGE_TYPE.CREDENTIAL_REFRESH_MESSAGE_TYPE,
            thid: uuid.v4(),
            body: {
                id: credential.id,
                reason: opts?.reason ?? 'credential is expired'
            },
            from: otherIdentifier,
            to: credential.issuer
        };
        const msgBytes = utils_1.byteEncoder.encode(JSON.stringify(refreshMsg));
        const jwzToken = await this._options.packageManager.pack(constants_1.MediaType.ZKPMessage, msgBytes, zkpParams);
        const resp = await fetch(credential.refreshService.id, {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: jwzToken
        });
        if (resp.status !== 200) {
            throw new Error(`could not refresh W3C credential, return status ${resp.status}`);
        }
        const respBody = await resp.json();
        if (!respBody.body?.credential) {
            throw new Error('no credential in CredentialIssuanceMessage response');
        }
        return verifiable_1.W3CCredential.fromJSON(respBody.body.credential);
    }
}
exports.RefreshHandler = RefreshHandler;
