import type { CommandResult } from "./lifecycle.js";

export interface Expectation {
  stdout: readonly string[];
  sorted?: boolean;
}

const linesOf = (text: string): string[] => (text.trim() === "" ? [] : text.trimEnd().split("\n"));

const sameLines = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((line, index) => line === expected[index]);

const assertExec = (result: CommandResult, expectation: Expectation): void => {
  const stdout = linesOf(result.stdout);
  const sorted = expectation.sorted === true;
  const order = (lines: readonly string[]): string[] => (sorted ? [...lines].sort() : [...lines]);

  const problems: string[] = [];
  if (result.exitCode !== 0) {
    problems.push(`exit code ${result.exitCode ?? "none"}`);
  }
  if (!sameLines(order(stdout), order(expectation.stdout))) {
    problems.push(`stdout ${JSON.stringify(stdout)} — expected ${JSON.stringify(expectation.stdout)}`);
  }
  if (result.stderr.trim() !== "") {
    problems.push(`stderr ${JSON.stringify(result.stderr)}`);
  }
  if (problems.length === 0) {
    return;
  }
  throw new Error(`devcontainer exec ${result.command.join(" ")}:\n${problems.join("\n")}`);
};

export const assertions = { exec: assertExec } as const;
