import { BundlerConfig, ModuleMap } from "./index-BHqtj9tT.js";

//#region src/core/rsc.d.ts
declare function setRequireModule(options: {
  load: (id: string) => unknown;
}): void;
declare function loadServerAction(id: string): Promise<Function>;
declare function createServerManifest(): BundlerConfig;
declare function createServerDecodeClientManifest(): ModuleMap;
declare function createClientManifest(): BundlerConfig;
//#endregion
export { createClientManifest, createServerDecodeClientManifest, createServerManifest, loadServerAction, setRequireModule };