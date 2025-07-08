import * as uuid from 'uuid';
import { MediaType, PROTOCOL_MESSAGE_TYPE } from '../constants';
/**
 * @beta
 * createProblemReportMessage is a function to create didcomm protocol problem report message
 * @param pthid - parent thread id
 * @param code - problem report code
 * @param opts - problem report options
 * @returns `ProblemReportMessage`
 */
export function createProblemReportMessage(pthid, code, opts) {
    const uuidv4 = uuid.v4();
    return {
        id: uuidv4,
        pthid: pthid,
        typ: MediaType.PlainMessage,
        type: PROTOCOL_MESSAGE_TYPE.PROBLEM_REPORT_MESSAGE_TYPE,
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
