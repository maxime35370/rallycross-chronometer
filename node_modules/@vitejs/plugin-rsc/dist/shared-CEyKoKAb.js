//#region src/core/shared.ts
const SERVER_REFERENCE_PREFIX = "$$server:";
const SERVER_DECODE_CLIENT_PREFIX = "$$decode-client:";
function createReferenceCacheTag() {
	const cache = Math.random().toString(36).slice(2);
	return "$$cache=" + cache;
}
function removeReferenceCacheTag(id) {
	return id.split("$$cache=")[0];
}
function setInternalRequire() {
	globalThis.__vite_rsc_require__ = (id) => {
		if (id.startsWith(SERVER_REFERENCE_PREFIX)) {
			id = id.slice(9);
			return globalThis.__vite_rsc_server_require__(id);
		}
		return globalThis.__vite_rsc_client_require__(id);
	};
}

//#endregion
export { SERVER_DECODE_CLIENT_PREFIX, SERVER_REFERENCE_PREFIX, createReferenceCacheTag, removeReferenceCacheTag, setInternalRequire };