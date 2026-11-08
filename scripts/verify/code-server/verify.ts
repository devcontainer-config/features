import { z } from "zod";

import { parseVerifyArguments, requireSmokeTarget, targetSchema } from "../arguments.js";
import { lifecycle } from "../lifecycle.js";
import { runSuite } from "../run.js";
import { scenarios, scenarioSelectionSchema } from "./scenarios.js";
import { selection } from "./selection.js";

export const verify = async (argv: string[]): Promise<void> => {
  const { options, scenarios: requested, component, version } = await parseVerifyArguments(argv);
  const selected = scenarioSelectionSchema.parse(requested);
  const target = targetSchema(z.literal("code-server")).parse({ component, version });
  requireSmokeTarget(selected, target);
  const derived = await selection.derive(options.channel, options.prefix, target);
  console.log(`>>> verify code-server: selection version=${derived.key} ref=${derived.ref}`);

  await runSuite({
    ...options,
    name: "code-server",
    create: async (root) =>
      Promise.all(
        selected.map((name) =>
          scenarios.create(name, {
            selection: derived,
            target,
            root,
            workspace: lifecycle.workspaceAt(root, name),
          }),
        ),
      ),
  });
};
