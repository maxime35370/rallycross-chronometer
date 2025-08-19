//#region ../../node_modules/.pnpm/@hiogawa+utils@1.7.0/node_modules/@hiogawa/utils/dist/index.js
function tinyassert(value, message) {
	if (value) return;
	if (message instanceof Error) throw message;
	throw new TinyAssertionError(message, tinyassert);
}
var TinyAssertionError = class extends Error {
	constructor(message, stackStartFunction) {
		super(message ?? "TinyAssertionError");
		if (stackStartFunction && "captureStackTrace" in Error) Error.captureStackTrace(this, stackStartFunction);
	}
};
function safeFunctionCast(f) {
	return f;
}
function once(f) {
	let result;
	let called = false;
	return safeFunctionCast(function(...args) {
		if (!called) {
			result = f.apply(this, args);
			called = true;
		}
		return result;
	});
}
function memoize(f, options) {
	const keyFn = options?.keyFn ?? ((...args) => args[0]);
	const cache = options?.cache ?? /* @__PURE__ */ new Map();
	return safeFunctionCast(function(...args) {
		const key = keyFn(...args);
		const value = cache.get(key);
		if (typeof value !== "undefined") return value;
		const newValue = f.apply(this, args);
		cache.set(key, newValue);
		return newValue;
	});
}

//#endregion
export { memoize, once, tinyassert };