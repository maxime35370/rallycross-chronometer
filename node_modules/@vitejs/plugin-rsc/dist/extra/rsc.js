import "../dist-DEF94lDJ.js";
import "../shared-CEyKoKAb.js";
import "../encryption-utils-BDwwcMVT.js";
import { loadServerAction } from "../rsc-DKA6wwTB.js";
import { createTemporaryReferenceSet, decodeAction, decodeFormState, decodeReply, renderToReadableStream } from "../rsc-DHfL29FT.js";
import "../rsc-DmPsJrxF.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

//#region src/extra/rsc.tsx
async function renderRequest(request, root, options) {
	function RscRoot() {
		const nonceMeta = options?.nonce && /* @__PURE__ */ jsx("meta", {
			property: "csp-nonce",
			nonce: options.nonce
		});
		return /* @__PURE__ */ jsxs(Fragment, { children: [nonceMeta, root] });
	}
	const url = new URL(request.url);
	const isAction = request.method === "POST";
	const isRscRequest = !request.headers.get("accept")?.includes("text/html") && !url.searchParams.has("__html") || url.searchParams.has("__rsc");
	let returnValue;
	let formState;
	let temporaryReferences;
	if (isAction) {
		const actionId = request.headers.get("x-rsc-action");
		if (actionId) {
			const contentType = request.headers.get("content-type");
			const body = contentType?.startsWith("multipart/form-data") ? await request.formData() : await request.text();
			temporaryReferences = createTemporaryReferenceSet();
			const args = await decodeReply(body, { temporaryReferences });
			const action = await loadServerAction(actionId);
			returnValue = await action.apply(null, args);
		} else {
			const formData = await request.formData();
			const decodedAction = await decodeAction(formData);
			const result = await decodedAction();
			formState = await decodeFormState(result, formData);
		}
	}
	const rscPayload = {
		root: /* @__PURE__ */ jsx(RscRoot, {}),
		formState,
		returnValue
	};
	const rscOptions = { temporaryReferences };
	const rscStream = renderToReadableStream(rscPayload, rscOptions);
	if (isRscRequest) return new Response(rscStream, { headers: {
		"content-type": "text/x-component;charset=utf-8",
		vary: "accept"
	} });
	const ssrEntry = await import.meta.viteRsc.loadModule("ssr", "index");
	return ssrEntry.renderHtml(rscStream, {
		formState,
		nonce: options?.nonce,
		debugNoJs: url.searchParams.has("__nojs")
	});
}

//#endregion
export { renderRequest };