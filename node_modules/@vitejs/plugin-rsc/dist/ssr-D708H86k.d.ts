//#region src/react/ssr.d.ts
declare function createFromReadableStream<T>(stream: ReadableStream<Uint8Array>, options?: object): Promise<T>;
declare function createServerReference(id: string): unknown;
declare const callServer: null;
declare const findSourceMapURL: null;
//#endregion
export { callServer, createFromReadableStream, createServerReference, findSourceMapURL };