import { memoize, tinyassert } from "./dist-DEF94lDJ.js";
import { SERVER_DECODE_CLIENT_PREFIX, SERVER_REFERENCE_PREFIX, createReferenceCacheTag, removeReferenceCacheTag, setInternalRequire } from "./shared-CEyKoKAb.js";
import * as ReactServer from "@vitejs/plugin-rsc/vendor/react-server-dom/server.edge";

//#region src/core/rsc.ts
let init = false;
let requireModule;
function setRequireModule(options) {
	if (init) return;
	init = true;
	requireModule = (id) => {
		return options.load(removeReferenceCacheTag(id));
	};
	globalThis.__vite_rsc_server_require__ = memoize(async (id) => {
		if (id.startsWith(SERVER_DECODE_CLIENT_PREFIX)) {
			id = id.slice(SERVER_DECODE_CLIENT_PREFIX.length);
			id = removeReferenceCacheTag(id);
			return new Proxy({}, { get(target, name, _receiver) {
				if (typeof name !== "string" || name === "then") return;
				return target[name] ??= ReactServer.registerClientReference(() => {
					throw new Error(`Unexpectedly client reference export '${name}' is called on server`);
				}, id, name);
			} });
		}
		return requireModule(id);
	});
	setInternalRequire();
}
async function loadServerAction(id) {
	const [file, name] = id.split("#");
	const mod = await requireModule(file);
	return mod[name];
}
function createServerManifest() {
	const cacheTag = import.meta.env.DEV ? createReferenceCacheTag() : "";
	return new Proxy({}, { get(_target, $$id, _receiver) {
		tinyassert(typeof $$id === "string");
		let [id, name] = $$id.split("#");
		tinyassert(id);
		tinyassert(name);
		return {
			id: SERVER_REFERENCE_PREFIX + id + cacheTag,
			name,
			chunks: [],
			async: true
		};
	} });
}
function createServerDecodeClientManifest() {
	return new Proxy({}, { get(_target, id) {
		return new Proxy({}, { get(_target$1, name) {
			return {
				id: SERVER_REFERENCE_PREFIX + SERVER_DECODE_CLIENT_PREFIX + id,
				name,
				chunks: [],
				async: true
			};
		} });
	} });
}
function createClientManifest() {
	const cacheTag = import.meta.env.DEV ? createReferenceCacheTag() : "";
	return new Proxy({}, { get(_target, $$id, _receiver) {
		tinyassert(typeof $$id === "string");
		let [id, name] = $$id.split("#");
		tinyassert(id);
		tinyassert(name);
		return {
			id: id + cacheTag,
			name,
			chunks: [],
			async: true
		};
	} });
}

//#endregion
export { createClientManifest, createServerDecodeClientManifest, createServerManifest, loadServerAction, setRequireModule };