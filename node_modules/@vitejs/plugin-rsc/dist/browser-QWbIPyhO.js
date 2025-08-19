import { memoize } from "./dist-DEF94lDJ.js";
import { removeReferenceCacheTag, setInternalRequire } from "./shared-CEyKoKAb.js";

//#region src/core/browser.ts
let init = false;
function setRequireModule(options) {
	if (init) return;
	init = true;
	const requireModule = memoize((id) => {
		return options.load(removeReferenceCacheTag(id));
	});
	globalThis.__vite_rsc_client_require__ = requireModule;
	setInternalRequire();
}

//#endregion
export { setRequireModule };