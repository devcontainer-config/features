import type { CommandResult } from "./lifecycle.js";

export interface Expectation {
  stdout?: readonly string[];
  sorted?: boolean;
  fields?: boolean;
  exitCode?: number;
}

const linesOf = (text: string): string[] => (text.trim() === "" ? [] : text.trimEnd().split("\n"));

const fieldsOf = (line: string): string[] => (line.trim() === "" ? [] : line.trim().split(/\s+/u));

const lineOf = (line: string, fields: boolean): string => (fields ? fieldsOf(line).join(" ") : line);

const sameLines = (actual: readonly string[], expected: readonly string[], fields: boolean): boolean =>
  actual.length === expected.length &&
  actual.every((line, index) => lineOf(line, fields) === lineOf(expected[index], fields));

const describe = (lines: readonly string[], fields: boolean): string =>
  JSON.stringify(lines.map((line) => lineOf(line, fields)));

export const assertExec = (result: CommandResult, expectation: Expectation): void => {
  const stdout = linesOf(result.stdout);
  const sorted = expectation.sorted === true;
  const fields = expectation.fields === true;
  const order = (lines: readonly string[]): string[] =>
    sorted ? lines.map((line) => lineOf(line, fields)).sort() : [...lines];
  const exitCode = expectation.exitCode ?? 0;

  const problems: string[] = [];
  if (result.exitCode !== exitCode) {
    problems.push(`exit code ${result.exitCode ?? "none"}, expected ${exitCode}`);
  }
  if (expectation.stdout !== undefined && !sameLines(order(stdout), order(expectation.stdout), fields)) {
    problems.push(`stdout ${describe(stdout, fields)}, expected ${describe(expectation.stdout, fields)}`);
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
