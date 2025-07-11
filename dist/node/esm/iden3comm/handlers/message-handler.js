import { MediaType } from '../constants';
import { proving } from '@iden3/js-jwz';
import { verifyExpiresTime } from './common';
/**
 * Base implementation of protocol message handler
 *
 * @export
 * @abstract
 * @class AbstractMessageHandler
 * @implements {IProtocolMessageHandler}
 */
export class AbstractMessageHandler {
    setNext(messageHandler) {
        this.nextMessageHandler = messageHandler;
        return messageHandler;
    }
    async handle(message, context) {
        if (!context.allowExpiredMessages) {
            verifyExpiresTime(message);
        }
        if (this.nextMessageHandler)
            return this.nextMessageHandler.handle(message, context);
        return Promise.reject('Message handler not provided or message not supported');
    }
}
/**
 * Protocol message handler entry point
 */
export class MessageHandler {
    /**
     * Creates an instance of MessageHandler.
     * @param {{
     *       messageHandlers: AbstractMessageHandler[];
     *       packageManager: IPackageManager;
     *     }} _params
     * @memberof MessageHandler
     */
    constructor(_params) {
        this._params = _params;
        this.registerHandlers(_params.messageHandlers);
    }
    /**
     * Registers a list of message handlers and sets up the chain of responsibility.
     *
     * This method takes an array of `AbstractMessageHandler` instances and sets up a chain of responsibility
     * where each handler is linked to the next one in the array. The first handler in the array becomes the
     * main message handler for the `MessageHandler` class.
     *
     * @param {AbstractMessageHandler[]} handlersList - An array of `AbstractMessageHandler` instances to be registered.
     * @returns {void}
     */
    registerHandlers(handlersList) {
        if (!handlersList.length)
            return;
        const [firstMessageHandler, ...restHandlersList] = handlersList;
        const tempHandler = firstMessageHandler;
        for (const currentHandler of restHandlersList) {
            let lastHandler = tempHandler;
            while (lastHandler.nextMessageHandler) {
                lastHandler = lastHandler.nextMessageHandler;
            }
            lastHandler.setNext(currentHandler);
        }
        if (!this.messageHandler) {
            this.messageHandler = firstMessageHandler;
        }
        else {
            this.messageHandler.setNext(firstMessageHandler);
        }
    }
    /**
     * Handles a message by unpacking it, passing it to the registered message handler, and packing the response.
     *
     * This method takes a Uint8Array of message bytes and a context object that contains information specific to the
     * type of message being handled (e.g. AuthMessageHandlerOptions, ContractMessageHandlerOptions, etc.).
     *
     * The method first unpacks the message using the provided package manager, then passes the unpacked message and
     * context to the registered message handler. If the message handler returns a response, the method packs the
     * response using the package manager and returns it. If the message handler does not return a response, the
     * method returns null.
     *
     * @param bytes - A Uint8Array of message bytes to be handled.
     * @param context - An object containing information specific to the type of message being handled.
     * @returns A Promise that resolves to a Uint8Array of the packed response, or null if no response was generated.
     */
    async handleMessage(bytes, context) {
        const { unpackedMediaType, unpackedMessage: message } = await this._params.packageManager.unpack(bytes);
        if (!this.messageHandler) {
            return Promise.reject(new Error('Message handler not provided'));
        }
        const response = await this.messageHandler.handle(message, context);
        if (!response) {
            return null;
        }
        let packerParams = {};
        const senderDid = context?.senderDid;
        if (unpackedMediaType === MediaType.ZKPMessage && senderDid) {
            packerParams = {
                senderDID: senderDid,
                provingMethodAlg: proving.provingMethodGroth16AuthV2Instance.methodAlg
            };
            return this._params.packageManager.packMessage(unpackedMediaType, response, packerParams);
        }
        return this._params.packageManager.packMessage(MediaType.PlainMessage, response, packerParams);
    }
}
