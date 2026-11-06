import { z } from "zod";

import { components } from "@/scripts/tasks/features/uv/generateConfig.js";

import { parseVerifyArguments, requireSmokeTarget, targetSchema } from "../arguments.js";
import { lifecycle } from "../lifecycle.js";
import { runSuite } from "../run.js";
import { scenarios, scenarioSelectionSchema } from "./scenarios.js";
import { selection } from "./selection.js";

export const verify = async (argv: string[]): Promise<void> => {
  const { options, scenarios: requested, component, version } = await parseVerifyArguments(argv);
  const selected = scenarioSelectionSchema.parse(requested);
  const target = targetSchema(z.enum(components)).parse({ component, version });
  requireSmokeTarget(selected, target);
  const derived = await selection.derive(options.channel, options.prefix, target);
  console.log(
    `>>> verify uv: selection uv=${derived.uv.key} python=${derived.python.key} previous=${derived.previous?.key ?? "none"}`,
  );

  await runSuite({
    ...options,
    name: "uv",
    create: async (root) =>
      Promise.all(
        selected.map((name) =>
          scenarios.create(name, {
            selection: derived,
            target,
            root,
            workspace: lifecycle.workspaceAt(root, name),
            force: options.force,
          }),
        ),
      ),
  });
};
