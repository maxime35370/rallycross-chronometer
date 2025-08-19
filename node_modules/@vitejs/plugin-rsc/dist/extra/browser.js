import "../dist-DEF94lDJ.js";
import "../shared-CEyKoKAb.js";
import "../browser-QWbIPyhO.js";
import { createFromFetch, createFromReadableStream, createTemporaryReferenceSet, encodeReply, setServerCallback } from "../browser-D8OPzpF5.js";
import "../browser-LizIyxet.js";
import { rscStream } from "../client-edAdk2GF.js";
import React from "react";
import ReactDomClient from "react-dom/client";
import { jsx } from "react/jsx-runtime";

//#region src/extra/browser.tsx
async function hydrate() {
	const callServer = async (id, args) => {
		const url = new URL(window.location.href);
		const temporaryReferences = createTemporaryReferenceSet();
		const payload = await createFromFetch(fetch(url, {
			method: "POST",
			body: await encodeReply(args, { temporaryReferences }),
			headers: { "x-rsc-action": id }
		}), { temporaryReferences });
		setPayload(payload);
		return payload.returnValue;
	};
	setServerCallback(callServer);
	async function onNavigation() {
		const url = new URL(window.location.href);
		const payload = await createFromFetch(fetch(url));
		setPayload(payload);
	}
	const initialPayload = await createFromReadableStream(rscStream);
	let setPayload;
	function BrowserRoot() {
		const [payload, setPayload_] = React.useState(initialPayload);
		React.useEffect(() => {
			setPayload = (v) => React.startTransition(() => setPayload_(v));
		}, [setPayload_]);
		React.useEffect(() => {
			return listenNavigation(() => onNavigation());
		}, []);
		return payload.root;
	}
	const browserRoot = /* @__PURE__ */ jsx(React.StrictMode, { children: /* @__PURE__ */ jsx(BrowserRoot, {}) });
	ReactDomClient.hydrateRoot(document, browserRoot, { formState: initialPayload.formState });
	if (import.meta.hot) import.meta.hot.on("rsc:update", () => {
		window.history.replaceState({}, "", window.location.href);
	});
}
async function fetchRSC(request) {
	const payload = await createFromFetch(fetch(request));
	return payload.root;
}
function listenNavigation(onNavigation) {
	window.addEventListener("popstate", onNavigation);
	const oldPushState = window.history.pushState;
	window.history.pushState = function(...args) {
		const res = oldPushState.apply(this, args);
		onNavigation();
		return res;
	};
	const oldReplaceState = window.history.replaceState;
	window.history.replaceState = function(...args) {
		const res = oldReplaceState.apply(this, args);
		onNavigation();
		return res;
	};
	function onClick(e) {
		let link = e.target.closest("a");
		if (link && link instanceof HTMLAnchorElement && link.href && (!link.target || link.target === "_self") && link.origin === location.origin && !link.hasAttribute("download") && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.defaultPrevented) {
			e.preventDefault();
			history.pushState(null, "", link.href);
		}
	}
	document.addEventListener("click", onClick);
	return () => {
		document.removeEventListener("click", onClick);
		window.removeEventListener("popstate", onNavigation);
		window.history.pushState = oldPushState;
		window.history.replaceState = oldReplaceState;
	};
}

//#endregion
export { fetchRSC, hydrate };