import path from "node:path";

import { $$ } from "@/scripts/shell.js";

const platforms = ["linux/amd64", "linux/arm64"] as const;

export const pushImage = async (context: string, refs: readonly string[]): Promise<void> => {
  await $$`docker buildx build ${[
    ...["--platform", platforms.join(",")],
    "--push",
    ...["--file", path.join(context, "docker", "Dockerfile")],
    ...refs.flatMap((ref) => ["--tag", ref]),
    context,
  ]}`;
};
