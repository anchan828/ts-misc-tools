import { randomUUID } from "node:crypto";
import { type Options, defineConfig } from "tsup";
const defaultExternals = [
  "@nestjs/microservices",
  "@nestjs/microservices/microservices-module",
  "@nestjs/websockets/socket-module",
  /**
   * Always add at least one external package, so add a random UUID.
   */
  randomUUID(),
];

type ApplicationConfig = {
  /**
   * Bundle external files into the single output file.
   */
  bundle?: boolean;
  external?: string[];
} & Omit<Options, "external" | "noExternal">;

/**
 * Define the application configuration for bundling external files.
 * It means that the external files are bundled into the single output file.
 */
export function defineApplicationConfig(config: ApplicationConfig): ReturnType<typeof defineConfig> {
  const options: Options = {
    bundle: true,
    skipNodeModulesBundle: true,
    ...config,
  };

  if (options.bundle) {
    options.external = getExternals(config.external);

    const joinedExternals = options.external.map((e) => `(${e})`).join("|");

    options.noExternal = [new RegExp(`^(?!${joinedExternals}).*$`)];
  }

  if (!options.banner) {
    options.banner = (ctx) => {
      if (ctx.format === "esm") {
        return {
          js: ["import { createRequire } from 'module';", "const require = createRequire(import.meta.url);"].join("\n"),
        };
      }
    };
  }

  return defineConfig(options);
}

function getExternals(externals?: string[]): string[] {
  const results: string[] = [];

  for (const external of [...defaultExternals, ...(externals || [])]) {
    try {
      // Check if the external package is resolved.
      import.meta.resolve?.(external) || require.resolve(external);
    } catch {
      results.push(external);
    }
  }
  return results;
}
