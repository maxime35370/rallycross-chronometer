import "./index-BHqtj9tT.js";
import { createClientManifest, createServerManifest, loadServerAction, setRequireModule } from "./rsc-BOV3yNSd.js";
import { createClientTemporaryReferenceSet, createFromReadableStream, createTemporaryReferenceSet, decodeAction, decodeFormState, decodeReply, encodeReply, registerClientReference, registerServerReference, renderToReadableStream } from "./rsc-DgrejoNf.js";

//#region src/utils/encryption-runtime.d.ts
// based on
// https://github.com/parcel-bundler/parcel/blob/9855f558a69edde843b1464f39a6010f6b421efe/packages/transformers/js/src/rsc-utils.js
// https://github.com/vercel/next.js/blob/c10c10daf9e95346c31c24dc49d6b7cda48b5bc8/packages/next/src/server/app-render/encryption.ts
// https://github.com/vercel/next.js/pull/56377
declare function encryptActionBoundArgs(originalValue: unknown): Promise<string>;
declare function decryptActionBoundArgs(encrypted: ReturnType<typeof encryptActionBoundArgs>): Promise<unknown>;
//#endregion
export { createClientManifest, createClientTemporaryReferenceSet, createFromReadableStream, createServerManifest, createTemporaryReferenceSet, decodeAction, decodeFormState, decodeReply, decryptActionBoundArgs, encodeReply, encryptActionBoundArgs, loadServerAction, registerClientReference, registerServerReference, renderToReadableStream, setRequireModule };