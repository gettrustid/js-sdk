"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DidDocumentCredentialStatusResolver = void 0;
class DidDocumentCredentialStatusResolver {
    constructor(didResolverUrl) {
        this.didResolverUrl = didResolverUrl;
    }
    async resolve(credentialStatus, opts) {
        if (!opts?.issuerDID) {
            throw new Error('IssuerDID is not set in options');
        }
        const url = `${this.didResolverUrl}/1.0/credential-status/${encodeURIComponent(opts.issuerDID.string())}`;
        const resp = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(credentialStatus)
        });
        const data = await resp.json();
        return data;
    }
}
exports.DidDocumentCredentialStatusResolver = DidDocumentCredentialStatusResolver;
