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
exports.createProblemReportMessage = void 0;
const uuid = __importStar(require("uuid"));
const constants_1 = require("../constants");
/**
 * @beta
 * createProblemReportMessage is a function to create didcomm protocol problem report message
 * @param pthid - parent thread id
 * @param code - problem report code
 * @param opts - problem report options
 * @returns `ProblemReportMessage`
 */
function createProblemReportMessage(pthid, code, opts) {
    const uuidv4 = uuid.v4();
    return {
        id: uuidv4,
        pthid: pthid,
        typ: constants_1.MediaType.PlainMessage,
        type: constants_1.PROTOCOL_MESSAGE_TYPE.PROBLEM_REPORT_MESSAGE_TYPE,
        ack: opts?.ack,
        body: {
            code: code,
            comment: opts?.comment,
            args: opts?.args,
            escalate_to: opts?.escalate_to
        },
        from: opts?.from,
        to: opts?.to
    };
}
exports.createProblemReportMessage = createProblemReportMessage;
