import { link, mkdir, readdir, readlink, symlink } from "node:fs/promises";
import path from "node:path";

export const linkTree = async (source: string, target: string): Promise<void> => {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourceEntry = path.join(source, entry.name);
    const targetEntry = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await mkdir(targetEntry);
      await linkTree(sourceEntry, targetEntry);
    } else if (entry.isFile()) {
      await link(sourceEntry, targetEntry);
    } else if (entry.isSymbolicLink()) {
      await symlink(await readlink(sourceEntry), targetEntry);
    } else {
      throw new Error(`${sourceEntry}: unsupported payload entry`);
    }
  }
};
