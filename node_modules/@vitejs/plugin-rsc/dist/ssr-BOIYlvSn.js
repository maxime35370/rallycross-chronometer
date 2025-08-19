import { memoize } from "./dist-DEF94lDJ.js";
import { removeReferenceCacheTag, setInternalRequire } from "./shared-CEyKoKAb.js";

//#region src/core/ssr.ts
let init = false;
function setRequireModule(options) {
	if (init) return;
	init = true;
	const requireModule = memoize((id) => {
		return options.load(removeReferenceCacheTag(id));
	});
	const clientRequire = (id) => {
		return requireModule(id);
	};
	globalThis.__vite_rsc_client_require__ = clientRequire;
	setInternalRequire();
}
function createServerConsumerManifest() {
	return {};
}

//#endregion
export { createServerConsumerManifest, setRequireModule };