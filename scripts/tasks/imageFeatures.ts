import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { execa } from "execa";
import * as prettier from "prettier";
import { z } from "zod";

import prettierOptions from "@/.config/prettier/.prettierrc.json" with { type: "json" };
import { getRemoteInfo } from "@/scripts/git.js";
import { projectRoot } from "@/scripts/project.js";

const featuresPath = path.resolve(projectRoot, "features");

const optionSchema = z.strictObject({
  type: z.string(),
  default: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string(),
});

const manifestSchema = z.strictObject({
  id: z.string(),
  name: z.string().optional(),
  description: z.string(),
  image: z.string(),
  options: z.record(z.string(), optionSchema).optional(),
});

const generatedSchema = z.object({
  properties: z.record(z.string(), optionSchema),
});

type Manifest = z.infer<typeof manifestSchema>;
type Options = NonNullable<Manifest["options"]>;

const readmeTemplate = `# #{Name}

#{Description}

## Example Usage

\`\`\`dockerfile
FROM #{Image} AS #{Id}

FROM base-image
COPY --from=#{Id} /features/#{Id}/ /opt/devcontainer-config/features/#{Id}/
\`\`\`

#{Options}

#{Notes}

---

_Note: This file was auto-generated from the [feature.json](#{RepoUrl}).  Add additional notes to a \`NOTES.md\`._
`;

const readFileOrFail = async (filePath: string, message: string): Promise<string> => {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(message, { cause: error });
    }
    throw error;
  }
};

const exists = async (candidate: string): Promise<boolean> => {
  try {
    await access(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const manifestOf = async (id: string): Promise<Manifest> => {
  const manifestPath = path.join(featuresPath, id, "feature.json");
  const data: unknown = JSON.parse(await readFileOrFail(manifestPath, `${manifestPath} is missing.`));
  const result = manifestSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`${manifestPath}: ${z.prettifyError(result.error)}`);
  }
  return result.data;
};

const optionsOf = async (id: string): Promise<Options | undefined> => {
  const optionsPath = path.join(featuresPath, id, "Options");
  if (!(await exists(optionsPath))) {
    return undefined;
  }
  const csprojPath = path.join(optionsPath, "Options.csproj");
  const { stdout, stderr, exitCode } = await execa("dotnet", ["run", "--project", csprojPath], {
    cwd: projectRoot,
    env: { DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1" },
    reject: false,
  });
  const captured = [stdout, stderr].filter((text) => text !== "").join("\n");
  if (exitCode !== 0) {
    throw new Error(`dotnet run ${csprojPath} exited with ${exitCode}:\n${captured}`);
  }
  let schema: unknown;
  try {
    schema = JSON.parse(stdout);
  } catch {
    throw new Error(`${csprojPath} printed no JSON schema:\n${captured}`);
  }
  const result = generatedSchema.safeParse(schema);
  if (!result.success) {
    throw new Error(`${csprojPath}: ${z.prettifyError(result.error)}\n${captured}`);
  }
  return result.data.properties;
};

const optionsTable = (options: Options): string => {
  const entries = Object.entries(options);
  if (entries.length === 0) {
    return "";
  }
  return [
    "## Options",
    "",
    "| Options Id | Description | Type | Default Value |",
    "| ---------- | ----------- | ---- | ------------- |",
    ...entries.map(
      ([optionId, option]) => `| ${optionId} | ${option.description} | ${option.type} | ${option.default} |`,
    ),
  ].join("\n");
};

const render = async (manifest: Manifest, notes: string, readmePath: string): Promise<string> => {
  const { owner, repo } = await getRemoteInfo();
  const url = `https://github.com/${owner}/${repo}/blob/main/features/${manifest.id}/feature.json`;
  const text = readmeTemplate
    .replace("#{Name}", manifest.name === undefined ? manifest.id : `${manifest.name} (${manifest.id})`)
    .replace("#{Description}", manifest.description)
    .replace("#{Image}", manifest.image)
    .replaceAll("#{Id}", manifest.id)
    .replace("#{Options}", optionsTable(manifest.options ?? {}))
    .replace("#{Notes}", notes)
    .replace("#{RepoUrl}", url);
  return prettier.format(text, { ...prettierOptions, filepath: readmePath });
};

const list = async (): Promise<string[]> => {
  const entries = await readdir(featuresPath, { withFileTypes: true });
  const ids: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && (await exists(path.join(featuresPath, entry.name, "feature.json")))) {
      ids.push(entry.name);
    }
  }
  return ids.sort();
};

interface Feature {
  manifestPath: string;
  manifestText: string;
  readmePath: string;
  readmeText: string;
}

const feature = async (id: string): Promise<Feature> => {
  const featurePath = path.join(featuresPath, id);
  const manifestPath = path.join(featurePath, "feature.json");
  const readmePath = path.join(featurePath, "README.md");
  const notesPath = path.join(featurePath, "NOTES.md");
  const manifest = await manifestOf(id);
  manifest.options = await optionsOf(id);
  const notes = await readFileOrFail(notesPath, `${notesPath} is missing.`);
  return {
    manifestPath,
    manifestText: await prettier.format(JSON.stringify(manifest), { ...prettierOptions, filepath: manifestPath }),
    readmePath,
    readmeText: await render(manifest, notes, readmePath),
  };
};

const write = async (): Promise<void> => {
  for (const id of await list()) {
    const generated = await feature(id);
    await writeFile(generated.manifestPath, generated.manifestText);
    await writeFile(generated.readmePath, generated.readmeText);
    console.log(`image-features: wrote ${generated.manifestPath} and ${generated.readmePath}`);
  }
};

const checkFile = async (filePath: string, expected: string): Promise<void> => {
  const actual = await readFileOrFail(filePath, `${filePath} is missing; run pnpm build.`);
  if (actual !== expected) {
    throw new Error(`${filePath} is stale; run pnpm build.`);
  }
};

const check = async (): Promise<void> => {
  for (const id of await list()) {
    const generated = await feature(id);
    await checkFile(generated.manifestPath, generated.manifestText);
    await checkFile(generated.readmePath, generated.readmeText);
  }
};

export const imageFeatures = { write, check } as const;
