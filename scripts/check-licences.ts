// Fails when a dependency's licence isn't on the allowed list (docs/specs/03). Run: `pnpm check:licences`.
import { execFileSync } from "node:child_process";

/** Licences allowed for code that ships to players. */
export const SHIPPED_OK = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "Zlib",
];
/** Build and test tools never reach players, so file-level copyleft (MPL) and data licences are fine there. */
export const TOOLS_OK = [...SHIPPED_OK, "MPL-2.0", "BlueOak-1.0.0", "Python-2.0", "CC-BY-3.0", "CC-BY-4.0"];

/** Does an SPDX expression such as `MIT`, `(MIT OR Apache-2.0)` or `MIT AND ISC` fit the allowed list? */
export function allowed(expression: string, ok: readonly string[]): boolean {
  const e = expression.replace(/[()]/g, "").trim();
  if (e.includes(" OR ")) return e.split(" OR ").some((part) => allowed(part, ok));
  if (e.includes(" AND ")) return e.split(" AND ").every((part) => allowed(part, ok));
  return ok.includes(e);
}

type LicenceList = Record<string, { name: string; versions: string[] }[]>;

/** Packages whose licence isn't allowed, as "name@version (licence)". */
export function offenders(list: LicenceList, ok: readonly string[]): string[] {
  return Object.entries(list).flatMap(([licence, packages]) =>
    allowed(licence, ok) ? [] : packages.map((p) => `${p.name}@${p.versions.join(",")} (${licence})`),
  );
}

function licences(prodOnly: boolean): LicenceList {
  const args = ["licenses", "list", "--json", ...(prodOnly ? ["--prod"] : [])];
  return JSON.parse(execFileSync("pnpm", args, { encoding: "utf8" })) as LicenceList;
}

if (process.argv[1]?.endsWith("check-licences.ts")) {
  const shipped = offenders(licences(true), SHIPPED_OK);
  const tools = offenders(licences(false), TOOLS_OK);
  for (const p of shipped) console.error(`Not allowed in the game: ${p}`);
  for (const p of tools) console.error(`Not allowed, even as a tool: ${p}`);
  if (shipped.length + tools.length > 0) process.exit(1);
  console.log(
    "Licences OK: shipped packages",
    SHIPPED_OK.join(", "),
    "· tools may also use",
    TOOLS_OK.slice(SHIPPED_OK.length).join(", "),
  );
}
