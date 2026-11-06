import { z } from "zod";

import { components } from "@/scripts/tasks/features/dotnet/generateConfig.js";

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
    `>>> verify dotnet: selection sdk=${derived.components.sdk.key} runtime=${derived.components.runtime.key} aspnet=${derived.components.aspnet.key} tfm=${derived.tfm}`,
  );

  await runSuite({
    ...options,
    name: "dotnet",
    create: (root) => {
      const apps = scenarios.appOf(selected);
      const build = apps.length === 0 ? undefined : lifecycle.workspaceAt(root, "build");
      return [
        ...(build === undefined ? [] : [scenarios.createBuildStage(apps, { selection: derived, workspace: build })]),
        ...selected.map((name) =>
          scenarios.create(name, {
            selection: derived,
            target,
            root,
            workspace: lifecycle.workspaceAt(root, name),
            build,
          }),
        ),
      ];
    },
  });
};
