import { DevEnvironment, Rollup } from "vite";

//#region src/vite-utils.d.ts
declare const VALID_ID_PREFIX = "/@id/";
declare const NULL_BYTE_PLACEHOLDER = "__x00__";
declare const FS_PREFIX = "/@fs/";
declare function wrapId(id: string): string;
declare function unwrapId(id: string): string;
declare function withTrailingSlash(path: string): string;
declare function cleanUrl(url: string): string;
declare function splitFileAndPostfix(path: string): {
  file: string;
  postfix: string;
};
declare function slash(p: string): string;
declare function injectQuery(url: string, queryToInject: string): string;
declare function joinUrlSegments(a: string, b: string): string;
declare function normalizeResolvedIdToUrl(environment: DevEnvironment, url: string, resolved: Rollup.PartialResolvedId): string;
declare function normalizeViteImportAnalysisUrl(environment: DevEnvironment, id: string): string;
//#endregion
export { FS_PREFIX, NULL_BYTE_PLACEHOLDER, VALID_ID_PREFIX, cleanUrl, injectQuery, joinUrlSegments, normalizeResolvedIdToUrl, normalizeViteImportAnalysisUrl, slash, splitFileAndPostfix, unwrapId, withTrailingSlash, wrapId };