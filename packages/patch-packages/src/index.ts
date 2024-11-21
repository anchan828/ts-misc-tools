import { type PathLike, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
export class PatchPackage {
  #packageDirs: string[] = [];
  constructor(packageName: string) {
    this.#packageDirs = glob.sync(
      resolve(dirname(fileURLToPath(import.meta.url)), `../../../**/node_modules/${packageName}`),
    );

    if (this.#packageDirs.length === 0) {
      console.warn(`[patch-packages] No package found with name ${packageName}`);
      return;
    }

    console.info(`[patch-packages] Patching ${packageName}...`);
  }

  public replaceText(file: string, from: string | RegExp, to: string): this {
    for (const packageDir of this.#packageDirs) {
      replaceText(resolve(packageDir, file), from, to);
    }
    return this;
  }

  /**
   * Delete text from a file. If the text is not found, nothing happens.
   */
  public deleteText(file: string, text: string | RegExp): this {
    return this.replaceText(file, text, "");
  }

  public appendText(file: string, text: string): this {
    for (const packageDir of this.#packageDirs) {
      appendText(resolve(packageDir, file), text);
    }
    return this;
  }

  public insertText(file: string, search: string | RegExp, text: string): this {
    for (const packageDir of this.#packageDirs) {
      replaceText(resolve(packageDir, file), search, `${search}${text}`);
    }
    return this;
  }
}

export function createPackagePatch(packageName: string): PatchPackage {
  return new PatchPackage(packageName);
}

function appendText(file: PathLike, text: string): void {
  if (!existsSync(file)) {
    console.warn(`[patch-package] File not found: ${file}`);
    return;
  }

  const fileText = readFileSync(file, "utf8");

  if (fileText.includes(text)) {
    return;
  }

  writeFileSync(file, `${fileText}\n${text}`, "utf8");
}

function replaceText(file: PathLike, from: string | RegExp, to: string): void {
  if (!existsSync(file)) {
    console.warn(`[patch-package] File not found: ${file}`);
    return;
  }

  const fileText = readFileSync(file, "utf8");

  writeFileSync(file, fileText.replaceAll(from, to), "utf8");
}
