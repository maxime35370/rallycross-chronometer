import { CallServerCallback } from "./index-BHqtj9tT.js";

//#region src/react/browser.d.ts
declare function createFromReadableStream<T>(stream: ReadableStream<Uint8Array>, options?: object): Promise<T>;
declare function createFromFetch<T>(promiseForResponse: Promise<Response>, options?: object): Promise<T>;
declare const encodeReply: (v: unknown[], options?: unknown) => Promise<string | FormData>;
declare const createServerReference: (...args: any[]) => unknown;
// use global instead of local variable  to tolerate duplicate modules
// e.g. when `setServerCallback` is pre-bundled but `createServerReference` is not
declare function callServer(...args: any[]): any;
declare function setServerCallback(fn: CallServerCallback): void;
declare const createTemporaryReferenceSet: () => unknown;
declare function findSourceMapURL(filename: string, environmentName: string): string | null;
//#endregion
export { callServer, createFromFetch, createFromReadableStream, createServerReference, createTemporaryReferenceSet, encodeReply, findSourceMapURL, setServerCallback };