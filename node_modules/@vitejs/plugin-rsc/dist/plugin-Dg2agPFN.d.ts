import MagicString from "magic-string";
import { Plugin, ViteDevServer, parseAstAsync } from "vite";
import { Program } from "estree";

//#region src/transforms/wrap-export.d.ts
type ExportMeta = {
  declName?: string;
  isFunction?: boolean;
  defaultExportIdentifierName?: string;
};
type TransformWrapExportFilter = (name: string, meta: ExportMeta) => boolean;
//#endregion
//#region src/plugin.d.ts
type RscPluginOptions = {
  /**
  * shorthand for configuring `environments.(name).build.rollupOptions.input.index`
  */
  entries?: Partial<Record<"client" | "ssr" | "rsc", string>>;
  /** @deprecated use `serverHandler: false` */
  disableServerHandler?: boolean;
  /** @default { enviornmentName: "rsc", entryName: "index" } */
  serverHandler?: {
    environmentName: string;
    entryName: string;
  } | false;
  /** @default false */
  loadModuleDevProxy?: boolean;
  rscCssTransform?: false | {
    filter?: (id: string) => boolean;
  };
  ignoredPackageWarnings?: (string | RegExp)[];
  /**
  * This option allows customizing how client build copies assets from server build.
  * By default, all assets are copied, but frameworks might want to establish some convention
  * to tighten security based on this option.
  */
  copyServerAssetsToClient?: (fileName: string) => boolean;
  defineEncryptionKey?: string;
  /**
  * Allows enabling action closure encryption for debugging purpose.
  * @default true
  */
  enableActionEncryption?: boolean;
  /** Escape hatch for Waku's `allowServer` */
  keepUseCientProxy?: boolean;
};
declare function vitePluginRsc(rscPluginOptions?: RscPluginOptions): Plugin[];
//
// collect client reference dependency chunk for modulepreload
//
type AssetsManifest = {
  bootstrapScriptContent: string;
  clientReferenceDeps: Record<string, AssetDeps>;
  serverResources?: Record<string, {
    css: string[];
  }>;
};
type AssetDeps = {
  js: string[];
  css: string[];
};
//
// support findSourceMapURL
// https://github.com/facebook/react/pull/29708
// https://github.com/facebook/react/pull/30741
//
declare function vitePluginFindSourceMapURL(): Plugin[];
declare function findSourceMapURL(server: ViteDevServer, filename: string, environmentName: string): Promise<object | undefined>;
//
// css support
//
declare function vitePluginRscCss(rscCssOptions?: Pick<RscPluginOptions, "rscCssTransform">): Plugin[];
declare function transformRscCssExport(options: {
  ast: Awaited<ReturnType<typeof parseAstAsync>>;
  code: string;
  id?: string;
  filter: TransformWrapExportFilter;
}): Promise<{
  output: MagicString;
} | undefined>;
/**
* temporary workaround for
* - https://github.com/cloudflare/workers-sdk/issues/9538 (fixed in @cloudflare/vite-plugin@1.8.0)
* - https://github.com/vitejs/vite/pull/20077 (fixed in vite@7.0.0)
*/
declare function __fix_cloudflare(): Plugin;
//#endregion
export { AssetDeps, AssetsManifest, RscPluginOptions, __fix_cloudflare, findSourceMapURL, transformRscCssExport, vitePluginFindSourceMapURL, vitePluginRsc, vitePluginRscCss };