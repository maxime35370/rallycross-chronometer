import { setRequireModule } from "./ssr-BOIYlvSn.js";
import * as clientReferences from "virtual:vite-rsc/client-references";
import assetsManifest from "virtual:vite-rsc/assets-manifest";
import * as ReactDOM from "react-dom";

//#region src/ssr.tsx
initialize();
function initialize() {
	setRequireModule({ load: async (id) => {
		if (!import.meta.env.__vite_rsc_build__) {
			const mod = await import(
			/* @vite-ignore */
			id);
			const modCss = await import(
			/* @vite-ignore */
			"/@id/__x00__virtual:vite-rsc/css/dev-ssr/" + id);
			return wrapResourceProxy(mod, {
				js: [],
				css: modCss.default
			});
		} else {
			const import_ = clientReferences.default[id];
			if (!import_) throw new Error(`client reference not found '${id}'`);
			const deps = assetsManifest.clientReferenceDeps[id];
			if (deps) preloadDeps(deps);
			const mod = await import_();
			return wrapResourceProxy(mod, deps);
		}
	} });
}
function wrapResourceProxy(mod, deps) {
	return new Proxy(mod, { get(target, p, receiver) {
		if (p in mod) {
			if (deps) preloadDeps(deps);
		}
		return Reflect.get(target, p, receiver);
	} });
}
function preloadDeps(deps) {
	for (const href of deps.js) ReactDOM.preloadModule(href, {
		as: "script",
		crossOrigin: ""
	});
	for (const href of deps.css) ReactDOM.preinit(href, { as: "style" });
}

//#endregion