import { artifactsPath } from "@/scripts/project.js";
import { pack } from "@/scripts/tasks/pack.js";
import { publish } from "@/scripts/tasks/publish.js";

await pack();
await publish(artifactsPath);
