import { mkdirSync, writeFileSync } from "node:fs";
import { expect } from "vitest";
import { failures, formatReport, type BalanceSection } from "../scripts/balance-report";

/** Where `pnpm balance` writes its results, for `pnpm balance:report` and CI. */
export const RESULTS_DIR = "balance-report";

/** Save a section of the report, print it, and fail if an enforced target is missed. */
export function report(file: string, section: BalanceSection): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(`${RESULTS_DIR}/${file}.json`, JSON.stringify(section, null, 2) + "\n");
  console.log(formatReport([section]));
  expect(failures([section])).toEqual([]);
}

export function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** The value below which `share` (0..1) of `values` fall. */
export function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] : 0;
}
