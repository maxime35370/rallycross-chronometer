import { setRequireModule } from "./browser-QWbIPyhO.js";
import * as clientReferences from "virtual:vite-rsc/client-references";

//#region src/browser.ts
initialize();
function initialize() {
	setRequireModule({ load: async (id) => {
		if (!import.meta.env.__vite_rsc_build__) return __vite_rsc_raw_import__(import.meta.env.BASE_URL + id.slice(1));
		else {
			const import_ = clientReferences.default[id];
			if (!import_) throw new Error(`client reference not found '${id}'`);
			return import_();
		}
	} });
}

//#endregion