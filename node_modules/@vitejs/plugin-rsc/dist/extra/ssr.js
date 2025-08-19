import "../dist-DEF94lDJ.js";
import "../shared-CEyKoKAb.js";
import "../ssr-BOIYlvSn.js";
import { createFromReadableStream } from "../ssr-D5pxP29F.js";
import "../ssr-Do_Ok_bB.js";
import { injectRSCPayload } from "../server-DS3S6m0g.js";
import React from "react";
import { jsx } from "react/jsx-runtime";
import ReactDomServer from "react-dom/server.edge";

//#region src/extra/ssr.tsx
async function renderHtml(rscStream, options) {
	const [rscStream1, rscStream2] = rscStream.tee();
	let payload;
	function SsrRoot() {
		payload ??= createFromReadableStream(rscStream1, { nonce: options?.nonce });
		const root = React.use(payload).root;
		return root;
	}
	const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent("index");
	const htmlStream = await ReactDomServer.renderToReadableStream(/* @__PURE__ */ jsx(SsrRoot, {}), {
		bootstrapScriptContent: options?.debugNoJs ? void 0 : bootstrapScriptContent,
		nonce: options?.nonce,
		formState: options?.formState
	});
	let responseStream = htmlStream;
	if (!options?.debugNoJs) responseStream = responseStream.pipeThrough(injectRSCPayload(rscStream2, { nonce: options?.nonce }));
	return new Response(responseStream, { headers: {
		"content-type": "text/html;charset=utf-8",
		vary: "accept"
	} });
}

//#endregion
export { renderHtml };