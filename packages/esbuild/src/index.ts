import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, PluginBuild } from "esbuild";
import { build as esbuild } from "esbuild";
import * as glob from "glob";

const NO_NODE_MODULES = /^[A-Z]:[/\\]|^\.{0,2}\/|^\.{1,2}$/;

const addExtension = (extension: "cjs" | "mjs"): Plugin => ({
  name: "add-extension",
  setup(ctx: PluginBuild) {
    ctx.onResolve({ filter: /.*/ }, (args) => {
      if (!args.importer) {
        return;
      }
      const tsPath = resolve(args.resolveDir, `${args.path}.ts`);
      const tsIndexPath = resolve(args.resolveDir, args.path, "index.ts");

      if (existsSync(tsPath)) {
        args.path = `${args.path}.${extension}`;
      } else if (existsSync(tsIndexPath)) {
        args.path = `${args.path}/index.${extension}`;
      } else {
        return;
      }

      return { path: args.path.replace(/\/\//g, "/"), external: true };
    });
  },
});

const skipNodeModulesBundle = (): Plugin => ({
  name: "skip-node-modules-bundle",
  setup(ctx: PluginBuild) {
    ctx.onResolve({ filter: /.*/ }, (args) => {
      if (!NO_NODE_MODULES.test(args.path)) {
        return { path: args.path, external: true };
      }
    });
  },
});

/**
 * https://github.com/evanw/esbuild/issues/1492#issuecomment-893144483
 */
const import_meta_url_inject_code = `export const import_meta_url = require("node:url").pathToFileURL(__filename);`;

const writeImportMetaUrlInjectCode = (): string => {
  const dist = resolve(tmpdir(), "anchan828", "esbuild", "import-meta-url.js");

  if (!existsSync(dirname(dist))) {
    mkdirSync(dirname(dist), { recursive: true });
  }

  writeFileSync(dist, import_meta_url_inject_code, "utf8");

  return dist;
};

export type BuildConfig =
  | {
      format: "cjs" | "esm";
      entryDir?: string;
      outDir?: string;
      exclude?: string[];
    }
  | "cjs"
  | "esm";

type EsbuildConfig = Parameters<typeof esbuild>[0];

function buildConfigs(configs: BuildConfig[]): Array<EsbuildConfig> {
  const fullConfigs = configs.map((config) => {
    if (config === "cjs" || config === "esm") {
      return {
        format: config,
        entryDir: "./src",
        outDir: `./dist/${config}`,
      };
    }

    return {
      entryDir: "./src",
      outDir: `./dist/${config.format}`,
      ...config,
    };
  });

  return fullConfigs.map(({ exclude, entryDir, format, outDir }) => {
    // clean
    rmSync(outDir, { recursive: true, force: true });

    const entryPattern = `${entryDir}/**/*.ts`;
    const ignorePatterns = [`${entryDir}/**/*.spec.ts`, `${entryDir}/**/*.spec.ts.snap`, ...(exclude ?? [])];

    const entryPoints = glob.sync(entryPattern, {
      ignore: ignorePatterns,
    });

    const extension = format === "cjs" ? "cjs" : "mjs";

    const esbuildConfig: EsbuildConfig = {
      entryPoints,
      platform: "node",
      logLevel: "info",
      bundle: true,
      outbase: entryDir,
      metafile: true,
      outdir: outDir,
      outExtension: { ".js": `.${extension}` },
      format,
      plugins: [addExtension(extension), skipNodeModulesBundle()],
    };

    if (format === "cjs") {
      esbuildConfig.inject = [writeImportMetaUrlInjectCode()];
      esbuildConfig.define = {
        "import.meta.url": "import_meta_url",
      };
    }

    return esbuildConfig;
  });
}

export async function build(config: BuildConfig | BuildConfig[]): Promise<void> {
  const configs = Array.isArray(config) ? config : [config];
  await Promise.all(buildConfigs(configs).map((c) => esbuild(c)));
}
