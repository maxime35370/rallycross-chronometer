import fs from "node:fs";
import path from "node:path";

//#region src/vite-utils.ts
const VALID_ID_PREFIX = `/@id/`;
const NULL_BYTE_PLACEHOLDER = `__x00__`;
const FS_PREFIX = `/@fs/`;
function wrapId(id) {
	return id.startsWith(VALID_ID_PREFIX) ? id : VALID_ID_PREFIX + id.replace("\0", NULL_BYTE_PLACEHOLDER);
}
function unwrapId(id) {
	return id.startsWith(VALID_ID_PREFIX) ? id.slice(VALID_ID_PREFIX.length).replace(NULL_BYTE_PLACEHOLDER, "\0") : id;
}
function withTrailingSlash(path$1) {
	if (path$1[path$1.length - 1] !== "/") return `${path$1}/`;
	return path$1;
}
const postfixRE = /[?#].*$/;
function cleanUrl(url) {
	return url.replace(postfixRE, "");
}
function splitFileAndPostfix(path$1) {
	const file = cleanUrl(path$1);
	return {
		file,
		postfix: path$1.slice(file.length)
	};
}
const windowsSlashRE = /\\/g;
function slash(p) {
	return p.replace(windowsSlashRE, "/");
}
const isWindows = typeof process !== "undefined" && process.platform === "win32";
function injectQuery(url, queryToInject) {
	const { file, postfix } = splitFileAndPostfix(url);
	const normalizedFile = isWindows ? slash(file) : file;
	return `${normalizedFile}?${queryToInject}${postfix[0] === "?" ? `&${postfix.slice(1)}` : postfix}`;
}
function joinUrlSegments(a, b) {
	if (!a || !b) return a || b || "";
	if (a.endsWith("/")) a = a.substring(0, a.length - 1);
	if (b[0] !== "/") b = "/" + b;
	return a + b;
}
function normalizeResolvedIdToUrl(environment, url, resolved) {
	const root = environment.config.root;
	const depsOptimizer = environment.depsOptimizer;
	if (resolved.id.startsWith(withTrailingSlash(root))) url = resolved.id.slice(root.length);
	else if (depsOptimizer?.isOptimizedDepFile(resolved.id) || resolved.id !== "/@react-refresh" && path.isAbsolute(resolved.id) && fs.existsSync(cleanUrl(resolved.id))) url = path.posix.join(FS_PREFIX, resolved.id);
	else url = resolved.id;
	if (url[0] !== "." && url[0] !== "/") url = wrapId(resolved.id);
	return url;
}
function normalizeViteImportAnalysisUrl(environment, id) {
	let url = normalizeResolvedIdToUrl(environment, id, { id });
	if (environment.config.consumer === "client") {
		const mod = environment.moduleGraph.getModuleById(id);
		if (mod && mod.lastHMRTimestamp > 0) url = injectQuery(url, `t=${mod.lastHMRTimestamp}`);
	}
	return url;
}

//#endregion
export { FS_PREFIX, NULL_BYTE_PLACEHOLDER, VALID_ID_PREFIX, cleanUrl, injectQuery, joinUrlSegments, normalizeResolvedIdToUrl, normalizeViteImportAnalysisUrl, slash, splitFileAndPostfix, unwrapId, withTrailingSlash, wrapId };