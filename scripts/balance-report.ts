// The balance report each PR gets (docs/specs/11 §6): `pnpm balance:report [results] [base results]`.
// `pnpm balance` plays the matches and writes the results; this turns them into a table, comparing with the
// base branch when its results are given.
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** One number the balance runs measure, with its target if it has one. */
export interface BalanceRow {
  label: string;
  value: number;
  /** "%" values are stored as 0..1. */
  unit: "" | "%" | "s";
  /** The allowed range; a row without one is shown for information. */
  min?: number;
  max?: number;
  /**
   * Out of range fails CI. A target that isn't enforced yet is a known problem waiting for a decision: it shows
   * as a warning instead.
   */
  enforced: boolean;
  note?: string;
}

export interface BalanceSection {
  title: string;
  /** What was played, e.g. "300 CPU-vs-CPU matches". */
  about: string;
  rows: BalanceRow[];
}

export type RowStatus = "pass" | "fail" | "warn" | "info";

export function rowStatus(row: BalanceRow): RowStatus {
  if (row.min === undefined && row.max === undefined) return "info";
  const ok =
    (row.min === undefined || row.value >= row.min) && (row.max === undefined || row.value <= row.max);
  return ok ? "pass" : row.enforced ? "fail" : "warn";
}

/** Enforced targets that are missed, as readable lines (empty when all is well). */
export function failures(sections: BalanceSection[]): string[] {
  return sections.flatMap((s) =>
    s.rows
      .filter((r) => rowStatus(r) === "fail")
      .map((r) => `${s.title}: ${r.label} is ${show(r.value, r.unit)}, target ${target(r)}`),
  );
}

export function show(value: number, unit: BalanceRow["unit"]): string {
  if (unit === "%") return `${Math.round(value * 100)}%`;
  if (unit === "s") return `${value.toFixed(2)} s`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function target(row: BalanceRow): string {
  const { min, max, unit } = row;
  if (min !== undefined && max !== undefined) return `${show(min, unit)} – ${show(max, unit)}`;
  if (min !== undefined) return `≥ ${show(min, unit)}`;
  if (max !== undefined) return `≤ ${show(max, unit)}`;
  return "";
}

const MARK: Record<RowStatus, string> = { pass: "✅", fail: "❌", warn: "⚠️", info: "" };

/** The report as Markdown; `base` adds a column with the base branch's numbers. */
export function formatReport(sections: BalanceSection[], base: BalanceSection[] | null = null): string {
  const lines = ["### Balance report", ""];
  const failed = failures(sections).length;
  const warned = sections.flatMap((s) => s.rows).filter((r) => rowStatus(r) === "warn").length;
  lines.push(
    failed > 0
      ? `❌ ${failed} balance target${failed === 1 ? "" : "s"} missed: CI fails until it's fixed or the target is changed on purpose.`
      : "✅ All enforced balance targets met.",
  );
  if (warned > 0)
    lines.push(
      `⚠️ ${warned} known problem${warned === 1 ? "" : "s"}, waiting for a decision (not enforced yet).`,
    );
  for (const section of sections) {
    const before = base?.find((s) => s.title === section.title);
    lines.push("", `**${section.title}** (${section.about})`, "");
    lines.push(base ? "| | Now | Before | Target | |" : "| | Now | Target | |");
    lines.push(base ? "| --- | --- | --- | --- | --- |" : "| --- | --- | --- | --- |");
    for (const row of section.rows) {
      const old = before?.rows.find((r) => r.label === row.label);
      const cells = [row.note ? `${row.label} — _${row.note}_` : row.label, show(row.value, row.unit)];
      if (base) cells.push(old ? show(old.value, old.unit) : "–");
      cells.push(target(row), MARK[rowStatus(row)]);
      lines.push(`| ${cells.join(" | ")} |`);
    }
  }
  lines.push(
    "",
    "_Deterministic: the same code always gives the same numbers, so any change here comes from this PR._",
  );
  return lines.join("\n");
}

/** Every section written by `pnpm balance` into `dir`, in file-name order. */
export function readResults(dir: string): BalanceSection[] | null {
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as BalanceSection);
}

if (process.argv[1]?.endsWith("balance-report.ts")) {
  const dir = process.argv[2] ?? "balance-report";
  const sections = readResults(dir);
  if (!sections || sections.length === 0) {
    console.error(`No balance results in ${dir}: run \`pnpm balance\` first.`);
    process.exit(1);
  }
  const report = formatReport(sections, process.argv[3] ? readResults(process.argv[3]) : null);
  console.log(report);
  writeFileSync(join(dir, "report.md"), report + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
}
