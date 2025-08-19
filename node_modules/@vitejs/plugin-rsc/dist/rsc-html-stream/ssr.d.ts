//#region src/rsc-html-stream/ssr.d.ts
declare const injectRscStreamToHtml: (stream: ReadableStream<Uint8Array>, options?: {
  nonce?: string;
}) => TransformStream<Uint8Array, Uint8Array>;
//#endregion
export { injectRscStreamToHtml };