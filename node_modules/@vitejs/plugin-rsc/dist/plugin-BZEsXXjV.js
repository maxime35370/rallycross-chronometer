import { tinyassert } from "./dist-DEF94lDJ.js";
import { vitePluginRscCore } from "./plugin-CZbI4rhS.js";
import { generateEncryptionKey, toBase64 } from "./encryption-utils-BDwwcMVT.js";
import { createRpcServer } from "./rpc-tGuLT8PD.js";
import { normalizeViteImportAnalysisUrl } from "./vite-utils-CcqBE-C4.js";
import { createRequire } from "node:module";
import assert from "node:assert";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequestListener } from "@mjackson/node-fetch-server";
import * as esModuleLexer from "es-module-lexer";
import MagicString from "magic-string";
import { defaultServerConditions, isCSSRequest, normalizePath, parseAstAsync } from "vite";
import { crawlFrameworkPkgs } from "vitefu";
import { walk } from "estree-walker";
import { analyze, extract_names } from "periscopic";

//#region src/transforms/utils.ts
function hasDirective(body, directive) {
	return !!body.find((stmt) => stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && typeof stmt.expression.value === "string" && stmt.expression.value === directive);
}

//#endregion
//#region src/transforms/hoist.ts
function transformHoistInlineDirective(input, ast, { runtime, directive, rejectNonAsyncFunction,...options }) {
	const output = new MagicString(input);
	walk(ast, { enter(node) {
		if (node.type === "ExportAllDeclaration") this.remove();
		if (node.type === "ExportNamedDeclaration" && !node.declaration) this.remove();
	} });
	const analyzed = analyze(ast);
	const names = [];
	walk(ast, { enter(node, parent) {
		if ((node.type === "FunctionExpression" || node.type === "FunctionDeclaration" || node.type === "ArrowFunctionExpression") && node.body.type === "BlockStatement" && hasDirective(node.body.body, directive)) {
			if (!node.async && rejectNonAsyncFunction) throw Object.assign(/* @__PURE__ */ new Error(`"${directive}" doesn't allow non async function`), { pos: node.start });
			const scope = analyzed.map.get(node);
			tinyassert(scope);
			const declName = node.type === "FunctionDeclaration" && node.id.name;
			const originalName = declName || parent?.type === "VariableDeclarator" && parent.id.type === "Identifier" && parent.id.name || "anonymous_server_function";
			const bindVars = [...scope.references].filter((ref) => {
				if (ref === declName) return false;
				const owner = scope.find_owner(ref);
				return owner && owner !== scope && owner !== analyzed.scope;
			});
			let newParams = [...bindVars, ...node.params.map((n) => input.slice(n.start, n.end))].join(", ");
			if (bindVars.length > 0 && options.decode) {
				newParams = ["$$hoist_encoded", ...node.params.map((n) => input.slice(n.start, n.end))].join(", ");
				output.appendLeft(node.body.body[0].start, `const [${bindVars.join(",")}] = ${options.decode("$$hoist_encoded")};\n`);
			}
			const newName = `$$hoist_${names.length}` + (originalName ? `_${originalName}` : "");
			names.push(newName);
			output.update(node.start, node.body.start, `\n;${options.noExport ? "" : "export "}${node.async ? "async " : ""}function ${newName}(${newParams}) `);
			output.appendLeft(node.end, `;\n/* #__PURE__ */ Object.defineProperty(${newName}, "name", { value: ${JSON.stringify(originalName)} });\n`);
			output.move(node.start, node.end, input.length);
			let newCode = `/* #__PURE__ */ ${runtime(newName, newName)}`;
			if (bindVars.length > 0) {
				const bindArgs = options.encode ? options.encode("[" + bindVars.join(", ") + "]") : bindVars.join(", ");
				newCode = `${newCode}.bind(null, ${bindArgs})`;
			}
			if (declName) {
				newCode = `const ${declName} = ${newCode};`;
				if (parent?.type === "ExportDefaultDeclaration") {
					output.remove(parent.start, node.start);
					newCode = `${newCode}\nexport default ${declName};`;
				}
			}
			output.appendLeft(node.start, newCode);
		}
	} });
	return {
		output,
		names
	};
}

//#endregion
//#region src/transforms/wrap-export.ts
function transformWrapExport(input, ast, options) {
	const output = new MagicString(input);
	const exportNames = [];
	const toAppend = [];
	const filter = options.filter ?? (() => true);
	function wrapSimple(start, end, exports) {
		const newCode = exports.map((e) => [filter(e.name, e.meta) && `${e.name} = /* #__PURE__ */ ${options.runtime(e.name, e.name, e.meta)};\n`, `export { ${e.name} };\n`]).flat().filter(Boolean).join("");
		output.update(start, end, newCode);
		output.move(start, end, input.length);
	}
	function wrapExport(name, exportName, meta = {}) {
		if (!filter(exportName, meta)) {
			toAppend.push(`export { ${name} as ${exportName} }`);
			return;
		}
		toAppend.push(`const $$wrap_${name} = /* #__PURE__ */ ${options.runtime(name, exportName, meta)}`, `export { $$wrap_${name} as ${exportName} }`);
	}
	function validateNonAsyncFunction(node, ok) {
		if (options.rejectNonAsyncFunction && !ok) throw Object.assign(/* @__PURE__ */ new Error(`unsupported non async function`), { pos: node.start });
	}
	for (const node of ast.body) {
		if (node.type === "ExportNamedDeclaration") if (node.declaration) if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
			/**
			* export function foo() {}
			*/
			validateNonAsyncFunction(node, node.declaration.type === "FunctionDeclaration" && node.declaration.async);
			const name = node.declaration.id.name;
			wrapSimple(node.start, node.declaration.start, [{
				name,
				meta: {
					isFunction: true,
					declName: name
				}
			}]);
		} else if (node.declaration.type === "VariableDeclaration") {
			/**
			* export const foo = 1, bar = 2
			*/
			validateNonAsyncFunction(node, node.declaration.declarations.every((decl) => decl.init?.type === "ArrowFunctionExpression" && decl.init.async));
			if (node.declaration.kind === "const") output.update(node.declaration.start, node.declaration.start + 5, "let");
			const names = node.declaration.declarations.flatMap((decl) => extract_names(decl.id));
			let isFunction = false;
			if (node.declaration.declarations.length === 1) {
				const decl = node.declaration.declarations[0];
				isFunction = decl.id.type === "Identifier" && (decl.init?.type === "ArrowFunctionExpression" || decl.init?.type === "FunctionExpression");
			}
			wrapSimple(node.start, node.declaration.start, names.map((name) => ({
				name,
				meta: {
					isFunction,
					declName: name
				}
			})));
		} else node.declaration;
		else if (node.source) {
			/**
			* export { foo, bar as car } from './foo'
			*/
			output.remove(node.start, node.end);
			for (const spec of node.specifiers) {
				tinyassert(spec.local.type === "Identifier");
				tinyassert(spec.exported.type === "Identifier");
				const name = spec.local.name;
				toAppend.push(`import { ${name} as $$import_${name} } from ${node.source.raw}`);
				wrapExport(`$$import_${name}`, spec.exported.name);
			}
		} else {
			/**
			* export { foo, bar as car }
			*/
			output.remove(node.start, node.end);
			for (const spec of node.specifiers) {
				tinyassert(spec.local.type === "Identifier");
				tinyassert(spec.exported.type === "Identifier");
				wrapExport(spec.local.name, spec.exported.name);
			}
		}
		/**
		* export * from './foo'
		*/
		if (!options.ignoreExportAllDeclaration && node.type === "ExportAllDeclaration") throw Object.assign(/* @__PURE__ */ new Error("unsupported ExportAllDeclaration"), { pos: node.start });
		/**
		* export default function foo() {}
		* export default class Foo {}
		* export default () => {}
		*/
		if (node.type === "ExportDefaultDeclaration") {
			validateNonAsyncFunction(node, node.declaration.type === "Identifier" || node.declaration.type === "FunctionDeclaration" && node.declaration.async);
			let localName;
			let isFunction = false;
			let declName;
			let defaultExportIdentifierName;
			if ((node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") && node.declaration.id) {
				localName = node.declaration.id.name;
				output.remove(node.start, node.declaration.start);
				isFunction = node.declaration.type === "FunctionDeclaration";
				declName = node.declaration.id.name;
			} else {
				localName = "$$default";
				output.update(node.start, node.declaration.start, "const $$default = ");
				if (node.declaration.type === "Identifier") defaultExportIdentifierName = node.declaration.name;
			}
			wrapExport(localName, "default", {
				isFunction,
				declName,
				defaultExportIdentifierName
			});
		}
	}
	if (toAppend.length > 0) output.append([
		"",
		...toAppend,
		""
	].join(";\n"));
	return {
		exportNames,
		output
	};
}

//#endregion
//#region src/transforms/proxy-export.ts
function transformDirectiveProxyExport(ast, options) {
	if (!hasDirective(ast.body, options.directive)) return;
	return transformProxyExport(ast, options);
}
function transformProxyExport(ast, options) {
	if (options.keep && typeof options.code !== "string") throw new Error("`keep` option requires `code`");
	const output = new MagicString(options.code ?? " ".repeat(ast.end));
	const exportNames = [];
	function createExport(node, names) {
		exportNames.push(...names);
		const newCode = names.map((name) => (name === "default" ? `export default` : `export const ${name} =`) + ` /* #__PURE__ */ ${options.runtime(name)};\n`).join("");
		output.update(node.start, node.end, newCode);
	}
	function validateNonAsyncFunction(node, ok) {
		if (options.rejectNonAsyncFunction && !ok) throw Object.assign(/* @__PURE__ */ new Error(`unsupported non async function`), { pos: node.start });
	}
	for (const node of ast.body) {
		if (node.type === "ExportNamedDeclaration") {
			if (node.declaration) if (node.declaration.type === "FunctionDeclaration" || node.declaration.type === "ClassDeclaration") {
				/**
				* export function foo() {}
				*/
				validateNonAsyncFunction(node, node.declaration.type === "FunctionDeclaration" && node.declaration.async);
				createExport(node, [node.declaration.id.name]);
			} else if (node.declaration.type === "VariableDeclaration") {
				/**
				* export const foo = 1, bar = 2
				*/
				validateNonAsyncFunction(node, node.declaration.declarations.every((decl) => decl.init?.type === "ArrowFunctionExpression" && decl.init.async));
				if (options.keep && options.code) {
					if (node.declaration.declarations.length === 1) {
						const decl = node.declaration.declarations[0];
						if (decl.id.type === "Identifier" && decl.init) {
							const name = decl.id.name;
							const value = options.code.slice(decl.init.start, decl.init.end);
							const newCode = `export const ${name} = /* #__PURE__ */ ${options.runtime(name, { value })};`;
							output.update(node.start, node.end, newCode);
							exportNames.push(name);
							continue;
						}
					}
				}
				const names = node.declaration.declarations.flatMap((decl) => extract_names(decl.id));
				createExport(node, names);
			} else node.declaration;
			else {
				/**
				* export { foo, bar as car } from './foo'
				* export { foo, bar as car }
				*/
				const names = [];
				for (const spec of node.specifiers) {
					tinyassert(spec.exported.type === "Identifier");
					names.push(spec.exported.name);
				}
				createExport(node, names);
			}
			continue;
		}
		/**
		* export * from './foo'
		*/
		if (!options.ignoreExportAllDeclaration && node.type === "ExportAllDeclaration") throw new Error("unsupported ExportAllDeclaration");
		/**
		* export default function foo() {}
		* export default class Foo {}
		* export default () => {}
		*/
		if (node.type === "ExportDefaultDeclaration") {
			validateNonAsyncFunction(node, node.declaration.type === "Identifier" || node.declaration.type === "FunctionDeclaration" && node.declaration.async);
			createExport(node, ["default"]);
			continue;
		}
		if (options.keep) continue;
		output.remove(node.start, node.end);
	}
	return {
		exportNames,
		output
	};
}

//#endregion
//#region src/transforms/server-action.ts
function transformServerActionServer(input, ast, options) {
	if (hasDirective(ast.body, "use server")) return transformWrapExport(input, ast, options);
	return transformHoistInlineDirective(input, ast, {
		...options,
		directive: "use server"
	});
}

//#endregion
//#region src/plugin.ts
let serverReferences = {};
let server;
let config;
let rscBundle;
let buildAssetsManifest;
let isScanBuild = false;
const BUILD_ASSETS_MANIFEST_NAME = "__vite_rsc_assets_manifest.js";
let clientReferenceMetaMap = {};
let serverResourcesMetaMap = {};
const PKG_NAME = "@vitejs/plugin-rsc";
const REACT_SERVER_DOM_NAME = `${PKG_NAME}/vendor/react-server-dom`;
const VIRTUAL_ENTRIES = { browser: "virtual:vite-rsc/entry-browser" };
const require = createRequire(import.meta.url);
function resolvePackage(name) {
	return pathToFileURL(require.resolve(name)).href;
}
function vitePluginRsc(rscPluginOptions = {}) {
	return [
		{
			name: "rsc",
			async config(config$1, env) {
				await esModuleLexer.init;
				const result = await crawlFrameworkPkgs({
					root: process.cwd(),
					isBuild: env.command === "build",
					isFrameworkPkgByJson(pkgJson) {
						if ([PKG_NAME, "react-dom"].includes(pkgJson.name)) return;
						const deps = pkgJson["peerDependencies"];
						return deps && "react" in deps;
					}
				});
				const noExternal = [
					"react",
					"react-dom",
					"server-only",
					"client-only",
					PKG_NAME,
					...result.ssr.noExternal.sort()
				];
				return {
					appType: "custom",
					define: { "import.meta.env.__vite_rsc_build__": JSON.stringify(env.command === "build") },
					environments: {
						client: {
							build: {
								outDir: config$1.environments?.client?.build?.outDir ?? "dist/client",
								rollupOptions: { input: rscPluginOptions.entries?.client && { index: rscPluginOptions.entries.client } }
							},
							optimizeDeps: {
								include: ["react-dom/client", `${REACT_SERVER_DOM_NAME}/client.browser`],
								exclude: [PKG_NAME]
							}
						},
						ssr: {
							build: {
								outDir: config$1.environments?.ssr?.build?.outDir ?? "dist/ssr",
								rollupOptions: { input: rscPluginOptions.entries?.ssr && { index: rscPluginOptions.entries.ssr } }
							},
							resolve: { noExternal },
							optimizeDeps: {
								include: [
									"react",
									"react-dom",
									"react/jsx-runtime",
									"react/jsx-dev-runtime",
									"react-dom/server.edge",
									`${REACT_SERVER_DOM_NAME}/client.edge`
								],
								exclude: [PKG_NAME]
							}
						},
						rsc: {
							build: {
								outDir: config$1.environments?.rsc?.build?.outDir ?? "dist/rsc",
								emitAssets: true,
								rollupOptions: { input: rscPluginOptions.entries?.rsc && { index: rscPluginOptions.entries.rsc } }
							},
							resolve: {
								conditions: ["react-server", ...defaultServerConditions],
								noExternal
							},
							optimizeDeps: {
								include: [
									"react",
									"react-dom",
									"react/jsx-runtime",
									"react/jsx-dev-runtime",
									`${REACT_SERVER_DOM_NAME}/server.edge`,
									`${REACT_SERVER_DOM_NAME}/client.edge`
								],
								exclude: [PKG_NAME]
							}
						}
					},
					builder: {
						sharedPlugins: true,
						sharedConfigBuild: true,
						async buildApp(builder) {
							isScanBuild = true;
							builder.environments.rsc.config.build.write = false;
							builder.environments.ssr.config.build.write = false;
							await builder.build(builder.environments.rsc);
							await builder.build(builder.environments.ssr);
							isScanBuild = false;
							builder.environments.rsc.config.build.write = true;
							builder.environments.ssr.config.build.write = true;
							await builder.build(builder.environments.rsc);
							clientReferenceMetaMap = sortObject(clientReferenceMetaMap);
							serverResourcesMetaMap = sortObject(serverResourcesMetaMap);
							await builder.build(builder.environments.client);
							await builder.build(builder.environments.ssr);
						}
					}
				};
			},
			configResolved(config_) {
				config = config_;
			},
			configureServer(server_) {
				server = server_;
				globalThis.__viteRscDevServer = server;
				if (rscPluginOptions.disableServerHandler) return;
				if (rscPluginOptions.serverHandler === false) return;
				const options = rscPluginOptions.serverHandler ?? {
					environmentName: "rsc",
					entryName: "index"
				};
				const environment = server.environments[options.environmentName];
				const source = getEntrySource(environment.config, options.entryName);
				return () => {
					server.middlewares.use(async (req, res, next) => {
						try {
							const resolved = await environment.pluginContainer.resolveId(source);
							assert(resolved, `[vite-rsc] failed to resolve server handler '${source}'`);
							const mod = await environment.runner.import(resolved.id);
							createRequestListener(mod.default)(req, res);
						} catch (e) {
							next(e);
						}
					});
				};
			},
			async configurePreviewServer(server$1) {
				if (rscPluginOptions.disableServerHandler) return;
				if (rscPluginOptions.serverHandler === false) return;
				const options = rscPluginOptions.serverHandler ?? {
					environmentName: "rsc",
					entryName: "index"
				};
				const entryFile = path.join(config.environments[options.environmentName].build.outDir, `${options.entryName}.js`);
				const entry = pathToFileURL(entryFile).href;
				const mod = await import(
				/* @vite-ignore */
				entry);
				const handler = createRequestListener(mod.default);
				server$1.middlewares.use((req, _res, next) => {
					delete req.headers["accept-encoding"];
					next();
				});
				return () => {
					server$1.middlewares.use(async (req, res, next) => {
						try {
							handler(req, res);
						} catch (e) {
							next(e);
						}
					});
				};
			},
			async hotUpdate(ctx) {
				if (isCSSRequest(ctx.file)) {
					if (this.environment.name === "client") return ctx.modules.filter((m) => !m.id?.includes("?direct"));
				}
				const ids = ctx.modules.map((mod) => mod.id).filter((v) => v !== null);
				if (ids.length === 0) return;
				function isInsideClientBoundary(mods) {
					const visited = /* @__PURE__ */ new Set();
					function recurse(mod) {
						if (!mod.id) return false;
						if (clientReferenceMetaMap[mod.id]) return true;
						if (visited.has(mod.id)) return false;
						visited.add(mod.id);
						for (const importer of mod.importers) if (recurse(importer)) return true;
						return false;
					}
					return mods.some((mod) => recurse(mod));
				}
				if (!isInsideClientBoundary(ctx.modules)) {
					if (this.environment.name === "rsc") ctx.server.environments.client.hot.send({
						type: "custom",
						event: "rsc:update",
						data: { file: ctx.file }
					});
					if (this.environment.name === "client") {
						const env = ctx.server.environments.rsc;
						const mod = env.moduleGraph.getModuleById(ctx.file);
						if (mod) {
							for (const clientMod of ctx.modules) for (const importer of clientMod.importers) if (importer.id && isCSSRequest(importer.id)) await this.environment.reloadModule(importer);
							return [];
						}
					}
				}
			}
		},
		{
			name: "rsc:patch-browser-raw-import",
			transform: {
				order: "post",
				handler(code) {
					if (code.includes("__vite_rsc_raw_import__")) return code.replace("__vite_rsc_raw_import__", "import");
				}
			}
		},
		{
			name: "rsc:load-ssr-module",
			transform(code) {
				if (code.includes("import.meta.viteRsc.loadSsrModule(")) return code.replaceAll(`import.meta.viteRsc.loadSsrModule(`, `import.meta.viteRsc.loadModule("ssr", `);
			}
		},
		{
			name: "rsc:load-environment-module",
			async transform(code) {
				if (!code.includes("import.meta.viteRsc.loadModule")) return;
				const s = new MagicString(code);
				for (const match of code.matchAll(/import\.meta\.viteRsc\.loadModule\(([\s\S]*?)\)/dg)) {
					const argCode = match[1].trim();
					const [environmentName, entryName] = evalValue(`[${argCode}]`);
					let replacement;
					if (this.environment.mode === "dev" && rscPluginOptions.loadModuleDevProxy) {
						const origin = server.resolvedUrls?.local[0];
						assert(origin, "[vite-rsc] no server for loadModueleDevProxy");
						const endpoint = origin + "__vite_rsc_load_module_dev_proxy?" + new URLSearchParams({
							environmentName,
							entryName
						});
						replacement = `__vite_rsc_rpc.createRpcClient(${JSON.stringify({ endpoint })})`;
						s.prepend(`import * as __vite_rsc_rpc from "@vitejs/plugin-rsc/utils/rpc";`);
					} else if (this.environment.mode === "dev") {
						const environment = server.environments[environmentName];
						const source = getEntrySource(environment.config, entryName);
						const resolved = await environment.pluginContainer.resolveId(source);
						assert(resolved, `[vite-rsc] failed to resolve entry '${source}'`);
						replacement = `globalThis.__viteRscDevServer.environments[${JSON.stringify(environmentName)}].runner.import(${JSON.stringify(resolved.id)})`;
					} else replacement = JSON.stringify(`__vite_rsc_load_module:${this.environment.name}:${environmentName}:${entryName}`);
					const [start, end] = match.indices[0];
					s.overwrite(start, end, replacement);
				}
				if (s.hasChanged()) return {
					code: s.toString(),
					map: s.generateMap({ hires: "boundary" })
				};
			},
			renderChunk(code, chunk) {
				if (!code.includes("__vite_rsc_load_module")) return;
				const s = new MagicString(code);
				for (const match of code.matchAll(/['"]__vite_rsc_load_module:(\w+):(\w+):(\w+)['"]/dg)) {
					const [fromEnv, toEnv, entryName] = match.slice(1);
					const importPath = normalizeRelativePath(path.relative(path.join(config.environments[fromEnv].build.outDir, chunk.fileName, ".."), path.join(config.environments[toEnv].build.outDir, `${entryName}.js`)));
					const replacement = `(import(${JSON.stringify(importPath)}))`;
					const [start, end] = match.indices[0];
					s.overwrite(start, end, replacement);
				}
				if (s.hasChanged()) return {
					code: s.toString(),
					map: s.generateMap({ hires: "boundary" })
				};
			}
		},
		{
			name: "vite-rsc-load-module-dev-proxy",
			apply: () => !!rscPluginOptions.loadModuleDevProxy,
			configureServer(server$1) {
				async function createHandler(url) {
					const { environmentName, entryName } = Object.fromEntries(url.searchParams);
					assert(environmentName);
					assert(entryName);
					const environment = server$1.environments[environmentName];
					const source = getEntrySource(environment.config, entryName);
					const resolvedEntry = await environment.pluginContainer.resolveId(source);
					assert(resolvedEntry, `[vite-rsc] failed to resolve entry '${source}'`);
					const runnerProxy = new Proxy({}, { get(_target, p, _receiver) {
						if (typeof p !== "string" || p === "then") return;
						return async (...args) => {
							const mod = await environment.runner.import(resolvedEntry.id);
							return mod[p](...args);
						};
					} });
					return createRpcServer(runnerProxy);
				}
				server$1.middlewares.use(async (req, res, next) => {
					const url = new URL(req.url ?? "/", `http://localhost`);
					if (url.pathname === "/__vite_rsc_load_module_dev_proxy") {
						try {
							const handler = await createHandler(url);
							createRequestListener(handler)(req, res);
						} catch (e) {
							next(e);
						}
						return;
					}
					next();
				});
			}
		},
		{
			name: "rsc:virtual:vite-rsc/assets-manifest",
			resolveId(source) {
				if (source === "virtual:vite-rsc/assets-manifest") {
					if (this.environment.mode === "build") return {
						id: source,
						external: true
					};
					return `\0` + source;
				}
			},
			load(id) {
				if (id === "\0virtual:vite-rsc/assets-manifest") {
					assert(this.environment.name !== "client");
					assert(this.environment.mode === "dev");
					const entryUrl = assetsURL("@id/__x00__" + VIRTUAL_ENTRIES.browser);
					const manifest = {
						bootstrapScriptContent: `import(${JSON.stringify(entryUrl)})`,
						clientReferenceDeps: {}
					};
					return `export default ${JSON.stringify(manifest, null, 2)}`;
				}
			},
			generateBundle(_options, bundle) {
				if (this.environment.name === "rsc") rscBundle = bundle;
				if (this.environment.name === "client") {
					const filterAssets = rscPluginOptions.copyServerAssetsToClient ?? (() => true);
					const rscBuildOptions = config.environments.rsc.build;
					const rscViteManifest = typeof rscBuildOptions.manifest === "string" ? rscBuildOptions.manifest : rscBuildOptions.manifest && ".vite/manifest.json";
					for (const asset of Object.values(rscBundle)) {
						if (asset.fileName === rscViteManifest) continue;
						if (asset.type === "asset" && filterAssets(asset.fileName)) this.emitFile({
							type: "asset",
							fileName: asset.fileName,
							source: asset.source
						});
					}
					const serverResources = {};
					const rscAssetDeps = collectAssetDeps(rscBundle);
					for (const [id, meta] of Object.entries(serverResourcesMetaMap)) serverResources[meta.key] = assetsURLOfDeps({
						js: [],
						css: rscAssetDeps[id]?.deps.css ?? []
					});
					const assetDeps = collectAssetDeps(bundle);
					const entry = Object.values(assetDeps).find((v) => v.chunk.name === "index");
					assert(entry);
					const entryUrl = assetsURL(entry.chunk.fileName);
					const clientReferenceDeps = {};
					for (const [id, meta] of Object.entries(clientReferenceMetaMap)) {
						const deps = assetDeps[id]?.deps ?? {
							js: [],
							css: []
						};
						clientReferenceDeps[meta.referenceKey] = assetsURLOfDeps(mergeAssetDeps(deps, entry.deps));
					}
					buildAssetsManifest = {
						bootstrapScriptContent: `import(${JSON.stringify(entryUrl)})`,
						clientReferenceDeps,
						serverResources
					};
				}
			},
			renderChunk(code, chunk) {
				if (code.includes("virtual:vite-rsc/assets-manifest")) {
					assert(this.environment.name !== "client");
					const replacement = normalizeRelativePath(path.relative(path.join(chunk.fileName, ".."), BUILD_ASSETS_MANIFEST_NAME));
					code = code.replaceAll("virtual:vite-rsc/assets-manifest", () => replacement);
					return { code };
				}
				return;
			},
			writeBundle() {
				if (this.environment.name === "ssr") {
					const assetsManifestCode = `export default ${JSON.stringify(buildAssetsManifest, null, 2)}`;
					for (const name of ["ssr", "rsc"]) {
						const manifestPath = path.join(config.environments[name].build.outDir, BUILD_ASSETS_MANIFEST_NAME);
						fs.writeFileSync(manifestPath, assetsManifestCode);
					}
				}
			}
		},
		createVirtualPlugin("vite-rsc/bootstrap-script-content", function() {
			assert(this.environment.name !== "client");
			return `\
import assetsManifest from "virtual:vite-rsc/assets-manifest";
export default assetsManifest.bootstrapScriptContent;
`;
		}),
		{
			name: "rsc:bootstrap-script-content",
			async transform(code) {
				if (!code.includes("loadBootstrapScriptContent") || !/import\s*\.\s*meta\s*\.\s*viteRsc\s*\.\s*loadBootstrapScriptContent/.test(code)) return;
				assert(this.environment.name !== "client");
				const output = new MagicString(code);
				for (const match of code.matchAll(/import\s*\.\s*meta\s*\.\s*viteRsc\s*\.\s*loadBootstrapScriptContent\(([\s\S]*?)\)/dg)) {
					const argCode = match[1].trim();
					const entryName = evalValue(argCode);
					assert(entryName, `[vite-rsc] expected 'loadBootstrapScriptContent("index")' but got ${argCode}`);
					let replacement = `Promise.resolve(__vite_rsc_assets_manifest.bootstrapScriptContent)`;
					const [start, end] = match.indices[0];
					output.overwrite(start, end, replacement);
				}
				if (output.hasChanged()) {
					if (!code.includes("__vite_rsc_assets_manifest")) output.prepend(`import __vite_rsc_assets_manifest from "virtual:vite-rsc/assets-manifest";`);
					return {
						code: output.toString(),
						map: output.generateMap({ hires: "boundary" })
					};
				}
			}
		},
		createVirtualPlugin(VIRTUAL_ENTRIES.browser.slice(8), async function() {
			assert(this.environment.mode === "dev");
			let code = "";
			const resolved = await this.resolve("/@react-refresh");
			if (resolved) code += `
import RefreshRuntime from "/@react-refresh";
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
window.__vite_plugin_react_preamble_installed__ = true;
`;
			const source = getEntrySource(this.environment.config, "index");
			const resolvedEntry = await this.resolve(source);
			assert(resolvedEntry, `[vite-rsc] failed to resolve entry '${source}'`);
			code += `await import(${JSON.stringify(resolvedEntry.id)});`;
			code += `
const ssrCss = document.querySelectorAll("link[rel='stylesheet']");
import.meta.hot.on("vite:beforeUpdate", () => ssrCss.forEach(node => node.remove()));
`;
			return code;
		}),
		{
			name: "rsc:inject-async-local-storage",
			async configureServer() {
				const __viteRscAyncHooks = await import("node:async_hooks");
				globalThis.AsyncLocalStorage = __viteRscAyncHooks.AsyncLocalStorage;
			},
			banner(chunk) {
				if ((this.environment.name === "ssr" || this.environment.name === "rsc") && this.environment.mode === "build" && chunk.isEntry) return `\
import * as __viteRscAyncHooks from "node:async_hooks";
globalThis.AsyncLocalStorage = __viteRscAyncHooks.AsyncLocalStorage;
`;
				return "";
			}
		},
		...vitePluginRscCore(),
		...vitePluginUseClient(rscPluginOptions),
		...vitePluginUseServer(rscPluginOptions),
		...vitePluginDefineEncryptionKey(rscPluginOptions),
		...vitePluginFindSourceMapURL(),
		...vitePluginRscCss({ rscCssTransform: rscPluginOptions.rscCssTransform }),
		scanBuildStripPlugin()
	];
}
function scanBuildStripPlugin() {
	return {
		name: "rsc:scan-strip",
		apply: "build",
		enforce: "post",
		transform(code, _id, _options) {
			if (!isScanBuild) return;
			const [imports] = esModuleLexer.parse(code);
			const output = imports.map((e) => e.n && `import ${JSON.stringify(e.n)};\n`).filter(Boolean).join("");
			return {
				code: output,
				map: { mappings: "" }
			};
		}
	};
}
function normalizeRelativePath(s) {
	s = normalizePath(s);
	return s[0] === "." ? s : "./" + s;
}
function getEntrySource(config$1, name = "index") {
	const input = config$1.build.rollupOptions.input;
	assert(input);
	assert(typeof input === "object" && !Array.isArray(input) && name in input && typeof input[name] === "string");
	return input[name];
}
function hashString(v) {
	return createHash("sha256").update(v).digest().toString("hex").slice(0, 12);
}
function normalizeReferenceId(id, name) {
	if (!server) return hashString(path.relative(config.root, id));
	const environment = server.environments[name];
	return normalizeViteImportAnalysisUrl(environment, id);
}
function vitePluginUseClient(useClientPluginOptions) {
	const packageSources = /* @__PURE__ */ new Map();
	const bareImportRE = /^(?![a-zA-Z]:)[\w@](?!.*:\/\/)/;
	return [
		{
			name: "rsc:use-client",
			async transform(code, id) {
				if (this.environment.name !== "rsc") return;
				if (!code.includes("use client")) return;
				const ast = await parseAstAsync(code);
				if (!hasDirective(ast.body, "use client")) return;
				let importId;
				let referenceKey;
				const packageSource = packageSources.get(id);
				if (!packageSource && id.includes("?v=")) {
					assert(this.environment.mode === "dev");
					const ignored = useClientPluginOptions.ignoredPackageWarnings?.some((pattern) => pattern instanceof RegExp ? pattern.test(id) : id.includes(`/node_modules/${pattern}/`));
					if (!ignored) this.warn(`[vite-rsc] detected an internal client boundary created by a package imported on rsc environment`);
					importId = `/@id/__x00__virtual:vite-rsc/client-in-server-package-proxy/${encodeURIComponent(id.split("?v=")[0])}`;
					referenceKey = importId;
				} else if (packageSource) if (this.environment.mode === "dev") {
					importId = `/@id/__x00__virtual:vite-rsc/client-package-proxy/${packageSource}`;
					referenceKey = importId;
				} else {
					importId = packageSource;
					referenceKey = hashString(packageSource);
				}
				else if (this.environment.mode === "dev") {
					importId = normalizeViteImportAnalysisUrl(server.environments.client, id);
					referenceKey = importId;
				} else {
					importId = id;
					referenceKey = hashString(normalizePath(path.relative(config.root, id)));
				}
				const transformDirectiveProxyExport_ = withRollupError(this, transformDirectiveProxyExport);
				const result = transformDirectiveProxyExport_(ast, {
					directive: "use client",
					code,
					keep: !!useClientPluginOptions.keepUseCientProxy,
					runtime: (name, meta) => {
						let proxyValue = `() => { throw new Error("Unexpectedly client reference export '" + ` + JSON.stringify(name) + ` + "' is called on server") }`;
						if (meta?.value) proxyValue = `(${meta.value})`;
						return `$$ReactServer.registerClientReference(  ${proxyValue},  ${JSON.stringify(referenceKey)},  ${JSON.stringify(name)})`;
					}
				});
				if (!result) return;
				const { output, exportNames } = result;
				clientReferenceMetaMap[id] = {
					importId,
					referenceKey,
					packageSource,
					exportNames,
					renderedExports: []
				};
				const importSource = resolvePackage(`${PKG_NAME}/react/rsc`);
				output.prepend(`import * as $$ReactServer from "${importSource}";\n`);
				return {
					code: output.toString(),
					map: { mappings: "" }
				};
			}
		},
		createVirtualPlugin("vite-rsc/client-references", function() {
			if (this.environment.mode === "dev") return {
				code: `export default {}`,
				map: null
			};
			let code = "";
			for (const meta of Object.values(clientReferenceMetaMap)) {
				const key = JSON.stringify(meta.referenceKey);
				const id = JSON.stringify(meta.importId);
				const exports = meta.renderedExports.map((name) => name === "default" ? "default: _default" : name).sort();
				code += `
          ${key}: async () => {
            const {${exports}} = await import(${id});
            return {${exports}};
          },
        `;
			}
			code = `export default {${code}};\n`;
			return {
				code,
				map: null
			};
		}),
		{
			name: "rsc:virtual-client-in-server-package",
			async load(id) {
				if (id.startsWith("\0virtual:vite-rsc/client-in-server-package-proxy/")) {
					assert.equal(this.environment.mode, "dev");
					assert.notEqual(this.environment.name, "rsc");
					id = decodeURIComponent(id.slice(49));
					return `
            export * from ${JSON.stringify(id)};
            import * as __all__ from ${JSON.stringify(id)};
            export default __all__.default;
          `;
				}
			}
		},
		{
			name: "rsc:virtual-client-package",
			resolveId: {
				order: "pre",
				async handler(source, importer, options) {
					if (this.environment.name === "rsc" && bareImportRE.test(source)) {
						const resolved = await this.resolve(source, importer, options);
						if (resolved && resolved.id.includes("/node_modules/")) {
							packageSources.set(resolved.id, source);
							return resolved;
						}
					}
				}
			},
			async load(id) {
				if (id.startsWith("\0virtual:vite-rsc/client-package-proxy/")) {
					assert(this.environment.mode === "dev");
					const source = id.slice(39);
					const meta = Object.values(clientReferenceMetaMap).find((v) => v.packageSource === source);
					const exportNames = meta.exportNames;
					return `export {${exportNames.join(",")}} from ${JSON.stringify(source)};\n`;
				}
			},
			generateBundle(_options, bundle) {
				if (this.environment.name !== "rsc") return;
				for (const chunk of Object.values(bundle)) if (chunk.type === "chunk") for (const [id, mod] of Object.entries(chunk.modules)) {
					const meta = clientReferenceMetaMap[id];
					if (meta) meta.renderedExports = mod.renderedExports;
				}
			}
		}
	];
}
function vitePluginDefineEncryptionKey(useServerPluginOptions) {
	let defineEncryptionKey;
	let emitEncryptionKey = false;
	const KEY_PLACEHOLDER = "__vite_rsc_define_encryption_key";
	const KEY_FILE = "__vite_rsc_encryption_key.js";
	return [{
		name: "rsc:encryption-key",
		async configEnvironment(name, _config, env) {
			if (name === "rsc" && !env.isPreview) defineEncryptionKey = useServerPluginOptions.defineEncryptionKey ?? JSON.stringify(toBase64(await generateEncryptionKey()));
		},
		resolveId(source) {
			if (source === "virtual:vite-rsc/encryption-key") return {
				id: "\0" + source,
				moduleSideEffects: false
			};
		},
		load(id) {
			if (id === "\0virtual:vite-rsc/encryption-key") {
				if (this.environment.mode === "build") return `export default () => ${KEY_PLACEHOLDER}`;
				return `export default () => (${defineEncryptionKey})`;
			}
		},
		renderChunk(code, chunk) {
			if (code.includes(KEY_PLACEHOLDER)) {
				assert.equal(this.environment.name, "rsc");
				emitEncryptionKey = true;
				const normalizedPath = normalizeRelativePath(path.relative(path.join(chunk.fileName, ".."), KEY_FILE));
				const replacement = `import(${JSON.stringify(normalizedPath)}).then(__m => __m.default)`;
				code = code.replaceAll(KEY_PLACEHOLDER, () => replacement);
				return { code };
			}
		},
		writeBundle() {
			if (this.environment.name === "rsc" && emitEncryptionKey) fs.writeFileSync(path.join(this.environment.config.build.outDir, KEY_FILE), `export default ${defineEncryptionKey};\n`);
		}
	}];
}
function vitePluginUseServer(useServerPluginOptions) {
	return [{
		name: "rsc:use-server",
		async transform(code, id) {
			if (!code.includes("use server")) return;
			const ast = await parseAstAsync(code);
			let normalizedId_;
			const getNormalizedId = () => {
				if (!normalizedId_) {
					if (id.includes("?v=")) {
						assert(this.environment.mode === "dev");
						const ignored = useServerPluginOptions.ignoredPackageWarnings?.some((pattern) => pattern instanceof RegExp ? pattern.test(id) : id.includes(`/node_modules/${pattern}/`));
						if (!ignored) this.warn(`[vite-rsc] detected an internal server function created by a package imported on ${this.environment.name} environment`);
						id = id.split("?v=")[0];
					}
					normalizedId_ = normalizeReferenceId(id, "rsc");
				}
				return normalizedId_;
			};
			if (this.environment.name === "rsc") {
				const transformServerActionServer_ = withRollupError(this, transformServerActionServer);
				const enableEncryption = useServerPluginOptions.enableActionEncryption ?? true;
				const { output } = transformServerActionServer_(code, ast, {
					runtime: (value, name) => `$$ReactServer.registerServerReference(${value}, ${JSON.stringify(getNormalizedId())}, ${JSON.stringify(name)})`,
					rejectNonAsyncFunction: true,
					encode: enableEncryption ? (value) => `$$ReactServer.encryptActionBoundArgs(${value})` : void 0,
					decode: enableEncryption ? (value) => `await $$ReactServer.decryptActionBoundArgs(${value})` : void 0
				});
				if (!output.hasChanged()) return;
				serverReferences[getNormalizedId()] = id;
				const importSource = resolvePackage(`${PKG_NAME}/rsc`);
				output.prepend(`import * as $$ReactServer from "${importSource}";\n`);
				return {
					code: output.toString(),
					map: output.generateMap({ hires: "boundary" })
				};
			} else {
				if (!hasDirective(ast.body, "use server")) return;
				const transformDirectiveProxyExport_ = withRollupError(this, transformDirectiveProxyExport);
				const result = transformDirectiveProxyExport_(ast, {
					code,
					runtime: (name$1) => `$$ReactClient.createServerReference(${JSON.stringify(getNormalizedId() + "#" + name$1)},$$ReactClient.callServer, undefined, ` + (this.environment.mode === "dev" ? `$$ReactClient.findSourceMapURL,` : "undefined,") + `${JSON.stringify(name$1)})`,
					directive: "use server",
					rejectNonAsyncFunction: true
				});
				const output = result?.output;
				if (!output?.hasChanged()) return;
				serverReferences[getNormalizedId()] = id;
				const name = this.environment.name === "client" ? "browser" : "ssr";
				const importSource = resolvePackage(`${PKG_NAME}/react/${name}`);
				output.prepend(`import * as $$ReactClient from "${importSource}";\n`);
				return {
					code: output.toString(),
					map: output.generateMap({ hires: "boundary" })
				};
			}
		}
	}, createVirtualPlugin("vite-rsc/server-references", function() {
		if (this.environment.mode === "dev") return {
			code: `export {}`,
			map: null
		};
		const code = generateDynamicImportCode(serverReferences);
		return {
			code,
			map: null
		};
	})];
}
function withRollupError(ctx, f) {
	function processError(e) {
		if (e && typeof e === "object" && typeof e.pos === "number") return ctx.error(e, e.pos);
		throw e;
	}
	return function(...args) {
		try {
			const result = f.apply(this, args);
			if (result instanceof Promise) return result.catch((e) => processError(e));
			return result;
		} catch (e) {
			processError(e);
		}
	};
}
function createVirtualPlugin(name, load) {
	name = "virtual:" + name;
	return {
		name: `rsc:virtual-${name}`,
		resolveId(source, _importer, _options) {
			return source === name ? "\0" + name : void 0;
		},
		load(id, options) {
			if (id === "\0" + name) return load.apply(this, [id, options]);
		}
	};
}
function generateDynamicImportCode(map) {
	let code = Object.entries(map).map(([key, id]) => `${JSON.stringify(key)}: () => import(${JSON.stringify(id)}),`).join("\n");
	return `export default {${code}};\n`;
}
function assetsURL(url) {
	return config.base + url;
}
function assetsURLOfDeps(deps) {
	return {
		js: deps.js.map((href) => assetsURL(href)),
		css: deps.css.map((href) => assetsURL(href))
	};
}
function mergeAssetDeps(a, b) {
	return {
		js: [...new Set([...a.js, ...b.js])],
		css: [...new Set([...a.css, ...b.css])]
	};
}
function collectAssetDeps(bundle) {
	const chunkToDeps = /* @__PURE__ */ new Map();
	for (const chunk of Object.values(bundle)) if (chunk.type === "chunk") chunkToDeps.set(chunk, collectAssetDepsInner(chunk.fileName, bundle));
	const idToDeps = {};
	for (const [chunk, deps] of chunkToDeps.entries()) for (const id of chunk.moduleIds) idToDeps[id] = {
		chunk,
		deps
	};
	return idToDeps;
}
function collectAssetDepsInner(fileName, bundle) {
	const visited = /* @__PURE__ */ new Set();
	const css = [];
	function recurse(k) {
		if (visited.has(k)) return;
		visited.add(k);
		const v = bundle[k];
		assert(v, `Not found '${k}' in the bundle`);
		if (v.type === "chunk") {
			css.push(...v.viteMetadata?.importedCss ?? []);
			for (const k2 of v.imports) if (k2 in bundle) recurse(k2);
		}
	}
	recurse(fileName);
	return {
		js: [...visited],
		css: [...new Set(css)]
	};
}
function vitePluginFindSourceMapURL() {
	return [{
		name: "rsc:findSourceMapURL",
		apply: "serve",
		configureServer(server$1) {
			server$1.middlewares.use(async (req, res, next) => {
				const url = new URL(req.url, `http://localhost`);
				if (url.pathname === "/__vite_rsc_findSourceMapURL") {
					let filename = url.searchParams.get("filename");
					let environmentName = url.searchParams.get("environmentName");
					try {
						const map = await findSourceMapURL(server$1, filename, environmentName);
						res.setHeader("content-type", "application/json");
						if (!map) res.statusCode = 404;
						res.end(JSON.stringify(map ?? {}));
					} catch (e) {
						next(e);
					}
					return;
				}
				next();
			});
		}
	}];
}
async function findSourceMapURL(server$1, filename, environmentName) {
	if (filename.startsWith("file://")) {
		filename = fileURLToPath(filename);
		if (fs.existsSync(filename)) {
			const content = fs.readFileSync(filename, "utf-8");
			return {
				version: 3,
				sources: [filename],
				sourcesContent: [content],
				mappings: "AAAA" + ";AACA".repeat(content.split("\n").length)
			};
		}
		return;
	}
	let mod;
	let map;
	if (environmentName === "Server") {
		mod = server$1.environments.rsc.moduleGraph.getModuleById(filename);
		map = mod?.transformResult?.map;
		if (map && map.mappings) map = {
			...map,
			mappings: ";;" + map.mappings
		};
	}
	const base = server$1.config.base.slice(0, -1);
	if (environmentName === "Client") try {
		const url = new URL(filename).pathname.slice(base.length);
		mod = server$1.environments.client.moduleGraph.urlToModuleMap.get(url);
		map = mod?.transformResult?.map;
	} catch (e) {}
	if (mod && map) return {
		...map,
		sources: [base + mod.url]
	};
}
function vitePluginRscCss(rscCssOptions) {
	function collectCss(environment, entryId) {
		const visited = /* @__PURE__ */ new Set();
		const cssIds = /* @__PURE__ */ new Set();
		const visitedFiles = /* @__PURE__ */ new Set();
		function recurse(id) {
			if (visited.has(id)) return;
			visited.add(id);
			const mod = environment.moduleGraph.getModuleById(id);
			if (mod?.file) visitedFiles.add(mod.file);
			for (const next of mod?.importedModules ?? []) if (next.id) if (isCSSRequest(next.id)) cssIds.add(next.id);
			else recurse(next.id);
		}
		recurse(entryId);
		const hrefs = [...cssIds].map((id) => normalizeViteImportAnalysisUrl(environment, id));
		return {
			ids: [...cssIds],
			hrefs,
			visitedFiles: [...visitedFiles]
		};
	}
	function getRscCssTransformFilter({ id, code }) {
		const { query } = parseIdQuery(id);
		if ("vite-rsc-css-export" in query) {
			const value = query["vite-rsc-css-export"];
			if (value) {
				const names = value.split(",");
				return (name) => names.includes(name);
			}
			return (name) => /^[A-Z]/.test(name);
		}
		const options = rscCssOptions?.rscCssTransform;
		if (options === false) return false;
		if (options?.filter && !options.filter(id)) return false;
		if (id.includes("/node_modules/") || !/\.[tj]sx$/.test(id)) return false;
		const result = esModuleLexer.parse(code);
		if (!result[0].some((i) => i.t === 1 && i.n && isCSSRequest(i.n))) return false;
		return (_name, meta) => !!(meta.isFunction && meta.declName && /^[A-Z]/.test(meta.declName) || meta.defaultExportIdentifierName && /^[A-Z]/.test(meta.defaultExportIdentifierName));
	}
	return [
		{
			name: "rsc:rsc-css-export-transform",
			async transform(code, id) {
				if (this.environment.name !== "rsc") return;
				const filter = getRscCssTransformFilter({
					id,
					code
				});
				if (!filter) return;
				const ast = await parseAstAsync(code);
				const result = await transformRscCssExport({
					ast,
					code,
					filter
				});
				if (result) return {
					code: result.output.toString(),
					map: result.output.generateMap({ hires: "boundary" })
				};
			}
		},
		{
			name: "rsc:css/dev-ssr-virtual",
			resolveId(source) {
				if (source.startsWith("virtual:vite-rsc/css/dev-ssr/")) return "\0" + source;
			},
			async load(id) {
				if (id.startsWith("\0virtual:vite-rsc/css/dev-ssr/")) {
					id = id.slice(30);
					const mod = await server.environments.ssr.moduleGraph.getModuleByUrl(id);
					if (!mod?.id || !mod?.file) return `export default []`;
					const result = collectCss(server.environments.ssr, mod.id);
					for (const file of [mod.file, ...result.visitedFiles]) this.addWatchFile(file);
					const hrefs = result.hrefs.map((href) => assetsURL(href.slice(1)));
					return `export default ${JSON.stringify(hrefs)}`;
				}
			}
		},
		{
			name: "rsc:importer-resources",
			async transform(code, id) {
				if (!code.includes("import.meta.viteRsc.loadCss")) return;
				assert(this.environment.name === "rsc");
				const output = new MagicString(code);
				for (const match of code.matchAll(/import\.meta\.viteRsc\.loadCss\(([\s\S]*?)\)/dg)) {
					const [start, end] = match.indices[0];
					const argCode = match[1].trim();
					let importer = id;
					if (argCode) {
						const argValue = evalValue(argCode);
						const resolved = await this.resolve(argValue, id);
						if (resolved) importer = resolved.id;
						else {
							this.warn(`[vite-rsc] failed to transform 'import.meta.viteRsc.loadCss(${argCode})'`);
							output.update(start, end, `null`);
							continue;
						}
					}
					const importId = `virtual:vite-rsc/importer-resources?importer=${encodeURIComponent(importer)}`;
					let replacement;
					if (this.environment.mode === "dev") replacement = `__vite_rsc_react__.createElement(async () => {
              const __m = await import(${JSON.stringify(importId)});
              return __vite_rsc_react__.createElement(__m.Resources);
            })`;
					else {
						const hash = hashString(importId);
						if (!code.includes(`__vite_rsc_importer_resources_${hash}`)) output.prepend(`import * as __vite_rsc_importer_resources_${hash} from ${JSON.stringify(importId)};`);
						replacement = `__vite_rsc_react__.createElement(__vite_rsc_importer_resources_${hash}.Resources)`;
					}
					output.update(start, end, replacement);
				}
				if (output.hasChanged()) {
					if (!code.includes("__vite_rsc_react__")) output.prepend(`import __vite_rsc_react__ from "react";`);
					return {
						code: output.toString(),
						map: output.generateMap({ hires: "boundary" })
					};
				}
			},
			resolveId(source) {
				if (source.startsWith("virtual:vite-rsc/importer-resources?importer=")) {
					assert(this.environment.name === "rsc");
					return "\0" + source;
				}
			},
			load(id) {
				if (id.startsWith("\0virtual:vite-rsc/importer-resources?importer=")) {
					const importer = decodeURIComponent(parseIdQuery(id).query["importer"]);
					if (this.environment.mode === "dev") {
						const result = collectCss(server.environments.rsc, importer);
						const cssHrefs = result.hrefs.map((href) => href.slice(1));
						const jsHrefs = ["@id/__x00__virtual:vite-rsc/importer-resources-browser?importer=" + encodeURIComponent(importer)];
						const deps = assetsURLOfDeps({
							css: cssHrefs,
							js: jsHrefs
						});
						return generateResourcesCode(JSON.stringify(deps, null, 2));
					} else {
						const key = normalizePath(path.relative(config.root, importer));
						serverResourcesMetaMap[importer] = { key };
						return `
              import __vite_rsc_assets_manifest__ from "virtual:vite-rsc/assets-manifest";
              ${generateResourcesCode(`__vite_rsc_assets_manifest__.serverResources[${JSON.stringify(key)}]`)}
            `;
					}
				}
				if (id.startsWith("\0virtual:vite-rsc/importer-resources-browser?importer=")) {
					assert(this.environment.name === "client");
					assert(this.environment.mode === "dev");
					const importer = decodeURIComponent(parseIdQuery(id).query["importer"]);
					const result = collectCss(server.environments.rsc, importer);
					let code = result.ids.map((id$1) => id$1.replace(/^\0/, "")).map((id$1) => `import ${JSON.stringify(id$1)};\n`).join("");
					code += `if (import.meta.hot) { import.meta.hot.accept() }\n`;
					return code;
				}
			},
			hotUpdate(ctx) {
				if (this.environment.name === "rsc") {
					const mods = collectModuleDependents(ctx.modules);
					for (const mod of mods) if (mod.id) {
						const importer = encodeURIComponent(mod.id);
						invalidteModuleById(server.environments.rsc, `\0virtual:vite-rsc/importer-resources?importer=${importer}`);
						invalidteModuleById(server.environments.client, `\0virtual:vite-rsc/importer-resources-browser?importer=${importer}`);
					}
				}
			}
		}
	];
}
function invalidteModuleById(environment, id) {
	const mod = environment.moduleGraph.getModuleById(id);
	if (mod) environment.moduleGraph.invalidateModule(mod);
	return mod;
}
function collectModuleDependents(mods) {
	const visited = /* @__PURE__ */ new Set();
	function recurse(mod) {
		if (visited.has(mod)) return;
		visited.add(mod);
		for (const importer of mod.importers) recurse(importer);
	}
	for (const mod of mods) recurse(mod);
	return [...visited];
}
function generateResourcesCode(depsCode) {
	const ResourcesFn = (React, deps) => {
		return function Resources() {
			return React.createElement(React.Fragment, null, [...deps.css.map((href) => React.createElement("link", {
				key: "css:" + href,
				rel: "stylesheet",
				precedence: "vite-rsc/importer-resources",
				href
			})), ...deps.js.map((href) => React.createElement("script", {
				key: "js:" + href,
				type: "module",
				async: true,
				src: href
			}))]);
		};
	};
	return `
    import __vite_rsc_react__ from "react";
    export const Resources = (${ResourcesFn.toString()})(__vite_rsc_react__, ${depsCode});
  `;
}
function evalValue(rawValue) {
	const fn = new Function(`
    var console, exports, global, module, process, require
    return (\n${rawValue}\n)
  `);
	return fn();
}
function parseIdQuery(id) {
	if (!id.includes("?")) return {
		filename: id,
		query: {}
	};
	const [filename, rawQuery] = id.split(`?`, 2);
	const query = Object.fromEntries(new URLSearchParams(rawQuery));
	return {
		filename,
		query
	};
}
async function transformRscCssExport(options) {
	if (hasDirective(options.ast.body, "use client")) return;
	const result = transformWrapExport(options.code, options.ast, {
		runtime: (value, name, meta) => `__vite_rsc_wrap_css__(${value}, ${JSON.stringify(meta.defaultExportIdentifierName ?? name)})`,
		filter: options.filter,
		ignoreExportAllDeclaration: true
	});
	if (result.output.hasChanged()) {
		if (!options.code.includes("__vite_rsc_react__")) result.output.prepend(`import __vite_rsc_react__ from "react";`);
		result.output.append(`
function __vite_rsc_wrap_css__(value, name) {
  if (typeof value !== 'function') return value;

  function __wrapper(props) {
    return __vite_rsc_react__.createElement(
      __vite_rsc_react__.Fragment,
      null,
      import.meta.viteRsc.loadCss(${options.id ? JSON.stringify(options.id) : ""}),
      __vite_rsc_react__.createElement(value, props),
    );
  }
  Object.defineProperty(__wrapper, "name", { value: name });
  return __wrapper;
}
`);
		return { output: result.output };
	}
}
/**
* temporary workaround for
* - https://github.com/cloudflare/workers-sdk/issues/9538 (fixed in @cloudflare/vite-plugin@1.8.0)
* - https://github.com/vitejs/vite/pull/20077 (fixed in vite@7.0.0)
*/
function __fix_cloudflare() {
	return {
		name: "rsc:workaround-cloudflare",
		enforce: "post",
		config(config$1) {
			const plugin = config$1.plugins.flat().find((p) => p && "name" in p && p.name === "vite-plugin-cloudflare");
			const original = plugin.configResolved;
			plugin.configResolved = function(...args) {
				try {
					return original.apply(this, args);
				} catch (e) {}
			};
			config$1.environments.ssr.resolve.noExternal = true;
			config$1.environments.rsc.resolve.noExternal = true;
		}
	};
}
function sortObject(o) {
	return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

//#endregion
export { __fix_cloudflare, findSourceMapURL, transformHoistInlineDirective, transformRscCssExport, vitePluginFindSourceMapURL, vitePluginRsc, vitePluginRscCss };