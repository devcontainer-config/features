import { project$$ } from "@/scripts/shell.js";

export const createTar = async (archive: string, directory: string, entries: readonly string[]): Promise<void> => {
  await project$$`tar ${["--create", "--file", archive, "--directory", directory, ...entries]}`;
};

export const extractTar = async (archive: string, directory: string): Promise<void> => {
  await project$$`tar ${["--extract", "--file", archive, "--directory", directory]}`;
};
