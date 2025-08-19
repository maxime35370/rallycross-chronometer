import * as ReactClient from "@vitejs/plugin-rsc/vendor/react-server-dom/client.browser";

//#region src/react/browser.ts
function createFromReadableStream(stream, options = {}) {
	return ReactClient.createFromReadableStream(stream, {
		callServer,
		findSourceMapURL,
		...options
	});
}
function createFromFetch(promiseForResponse, options = {}) {
	return ReactClient.createFromFetch(promiseForResponse, {
		callServer,
		findSourceMapURL,
		...options
	});
}
const encodeReply = ReactClient.encodeReply;
const createServerReference = ReactClient.createServerReference;
function callServer(...args) {
	return globalThis.__viteRscCallServer(...args);
}
function setServerCallback(fn) {
	globalThis.__viteRscCallServer = fn;
}
const createTemporaryReferenceSet = ReactClient.createTemporaryReferenceSet;
function findSourceMapURL(filename, environmentName) {
	const url = new URL("/__vite_rsc_findSourceMapURL", window.location.origin);
	url.searchParams.set("filename", filename);
	url.searchParams.set("environmentName", environmentName);
	return url.toString();
}

//#endregion
export { callServer, createFromFetch, createFromReadableStream, createServerReference, createTemporaryReferenceSet, encodeReply, findSourceMapURL, setServerCallback };