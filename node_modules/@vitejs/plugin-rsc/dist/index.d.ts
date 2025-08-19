import { RscPluginOptions, vitePluginRsc } from "./plugin-Dg2agPFN.js";
import MagicString from "magic-string";
import { Program } from "estree";

//#region src/transforms/hoist.d.ts
declare function transformHoistInlineDirective(input: string, ast: Program, {
  runtime,
  directive,
  rejectNonAsyncFunction,
  ...options
}: {
  runtime: (value: string, name: string) => string;
  directive: string;
  rejectNonAsyncFunction?: boolean;
  encode?: (value: string) => string;
  decode?: (value: string) => string;
  noExport?: boolean;
}): {
  output: MagicString;
  names: string[];
};
//#endregion
export { RscPluginOptions, vitePluginRsc as default, transformHoistInlineDirective };