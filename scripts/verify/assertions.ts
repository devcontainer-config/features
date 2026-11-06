import type { CommandResult } from "./lifecycle.js";

export interface Expectation {
  stdout?: readonly string[];
  sorted?: boolean;
  exitCode?: number;
}

const linesOf = (text: string): string[] => (text.trim() === "" ? [] : text.trimEnd().split("\n"));

const sameLines = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((line, index) => line === expected[index]);

export const assertExec = (result: CommandResult, expectation: Expectation): void => {
  const stdout = linesOf(result.stdout);
  const sorted = expectation.sorted === true;
  const order = (lines: readonly string[]): string[] => (sorted ? [...lines].sort() : [...lines]);
  const exitCode = expectation.exitCode ?? 0;

  const problems: string[] = [];
  if (result.exitCode !== exitCode) {
    problems.push(`exit code ${result.exitCode ?? "none"}, expected ${exitCode}`);
  }
  if (expectation.stdout !== undefined && !sameLines(order(stdout), order(expectation.stdout))) {
    problems.push(`stdout ${JSON.stringify(stdout)}, expected ${JSON.stringify(expectation.stdout)}`);
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
