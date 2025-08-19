import { decode, encode } from "turbo-stream";

//#region src/utils/rpc.ts
function createRpcServer(handlers) {
	return async (request) => {
		if (!request.body) throw new Error(`loadModuleDevProxy error: missing request body`);
		const reqPayload = await decode(request.body.pipeThrough(new TextDecoderStream()));
		const handler = handlers[reqPayload.method];
		if (!handler) throw new Error(`loadModuleDevProxy error: unknown method ${reqPayload.method}`);
		const resPayload = {
			ok: true,
			data: void 0
		};
		try {
			resPayload.data = await handler(...reqPayload.args);
		} catch (e) {
			resPayload.ok = false;
			resPayload.data = e;
		}
		return new Response(encode(resPayload));
	};
}
function createRpcClient(options) {
	async function callRpc(method, args) {
		const reqPayload = {
			method,
			args
		};
		const body = encode(reqPayload).pipeThrough(new TextEncoderStream());
		const res = await fetch(options.endpoint, {
			method: "POST",
			body,
			duplex: "half"
		});
		if (!res.ok || !res.body) throw new Error(`loadModuleDevProxy error: ${res.status} ${res.statusText}`);
		const resPayload = await decode(res.body.pipeThrough(new TextDecoderStream()));
		if (!resPayload.ok) throw resPayload.data;
		return resPayload.data;
	}
	return new Proxy({}, { get(_target, p, _receiver) {
		if (typeof p !== "string" || p === "then") return;
		return (...args) => callRpc(p, args);
	} });
}

//#endregion
export { createRpcClient, createRpcServer };