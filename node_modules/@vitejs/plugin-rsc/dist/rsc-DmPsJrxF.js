import { once } from "./dist-DEF94lDJ.js";
import { arrayToStream, concatArrayStream, decryptBuffer, encryptBuffer, fromBase64 } from "./encryption-utils-BDwwcMVT.js";
import { setRequireModule } from "./rsc-DKA6wwTB.js";
import { createFromReadableStream, renderToReadableStream } from "./rsc-DHfL29FT.js";
import serverReferences from "virtual:vite-rsc/server-references";
import encryptionKeySource from "virtual:vite-rsc/encryption-key";

//#region src/utils/encryption-runtime.ts
async function encryptActionBoundArgs(originalValue) {
	const serialized = renderToReadableStream(originalValue);
	const serializedBuffer = await concatArrayStream(serialized);
	return encryptBuffer(serializedBuffer, await getEncryptionKey());
}
async function decryptActionBoundArgs(encrypted) {
	const serializedBuffer = await decryptBuffer(await encrypted, await getEncryptionKey());
	const serialized = arrayToStream(new Uint8Array(serializedBuffer));
	return createFromReadableStream(serialized);
}
const getEncryptionKey = /* @__PURE__ */ once(async () => {
	const resolved = await encryptionKeySource();
	const key = await crypto.subtle.importKey("raw", fromBase64(resolved), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
	return key;
});

//#endregion
//#region src/rsc.tsx
initialize();
function initialize() {
	setRequireModule({ load: async (id) => {
		if (!import.meta.env.__vite_rsc_build__) return import(
		/* @vite-ignore */
		id);
		else {
			const import_ = serverReferences[id];
			if (!import_) throw new Error(`server reference not found '${id}'`);
			return import_();
		}
	} });
}

//#endregion
export { decryptActionBoundArgs, encryptActionBoundArgs };