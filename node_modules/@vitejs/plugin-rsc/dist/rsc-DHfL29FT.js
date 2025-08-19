import { createClientManifest, createServerDecodeClientManifest, createServerManifest } from "./rsc-DKA6wwTB.js";
import * as ReactServer from "@vitejs/plugin-rsc/vendor/react-server-dom/server.edge";
import * as ReactClient from "@vitejs/plugin-rsc/vendor/react-server-dom/client.edge";

//#region src/react/rsc.ts
function renderToReadableStream(data, options) {
	return ReactServer.renderToReadableStream(data, createClientManifest(), options);
}
function createFromReadableStream(stream, options = {}) {
	return ReactClient.createFromReadableStream(stream, {
		serverConsumerManifest: {
			serverModuleMap: createServerManifest(),
			moduleMap: createServerDecodeClientManifest()
		},
		...options
	});
}
function registerClientReference(proxy, id, name) {
	return ReactServer.registerClientReference(proxy, id, name);
}
const registerServerReference = ReactServer.registerServerReference;
function decodeReply(body, options) {
	return ReactServer.decodeReply(body, createServerManifest(), options);
}
function decodeAction(body) {
	return ReactServer.decodeAction(body, createServerManifest());
}
function decodeFormState(actionResult, body) {
	return ReactServer.decodeFormState(actionResult, body, createServerManifest());
}
const createTemporaryReferenceSet = ReactServer.createTemporaryReferenceSet;
const encodeReply = ReactClient.encodeReply;
const createClientTemporaryReferenceSet = ReactClient.createTemporaryReferenceSet;

//#endregion
export { createClientTemporaryReferenceSet, createFromReadableStream, createTemporaryReferenceSet, decodeAction, decodeFormState, decodeReply, encodeReply, registerClientReference, registerServerReference, renderToReadableStream };