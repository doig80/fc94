// Fails when the download grows past its budget (docs/specs/01 §4). Run after `pnpm build`: `pnpm check:size`.
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * What a player downloads before the match starts, compressed. Spec 01 §4 allows 15 MB up to the main menu;
 * this tighter budget makes unexpected growth visible early. Raise it on purpose (in a PR) when assets arrive.
 */
export const STARTUP_BUDGET = 2_000_000;
/** Everything in the build, compressed (spec 01 §4: initial download ≤ 15 MB). */
export const TOTAL_BUDGET = 15_000_000;

interface ManifestChunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  css?: string[];
}

/** Files loaded at startup: index.html, the entry chunks and everything they import statically (not lazily). */
export function startupFiles(manifest: Record<string, ManifestChunk>): string[] {
  const seen = new Set<string>();
  const stack = Object.keys(manifest).filter((k) => manifest[k].isEntry);
  while (stack.length > 0) {
    const key = stack.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    stack.push(...(manifest[key].imports ?? []));
  }
  const files = new Set(["index.html"]);
  for (const key of seen) {
    files.add(manifest[key].file);
    for (const css of manifest[key].css ?? []) files.add(css);
  }
  return [...files].sort();
}

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === ".vite") return [];
    return statSync(path).isDirectory() ? allFiles(path) : [path];
  });
}

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`;

if (process.argv[1]?.endsWith("check-size.ts")) {
  const dist = "dist";
  const manifest = JSON.parse(readFileSync(join(dist, ".vite/manifest.json"), "utf8")) as Record<
    string,
    ManifestChunk
  >;
  const gz = (path: string) => gzipSync(readFileSync(path), { level: 9 }).length;
  const startup = startupFiles(manifest).map((f) => ({ file: f, size: gz(join(dist, f)) }));
  const all = allFiles(dist).map((path) => ({ file: relative(dist, path), size: gz(path) }));
  const startupTotal = startup.reduce((sum, f) => sum + f.size, 0);
  const total = all.reduce((sum, f) => sum + f.size, 0);
  const biggest = [...all].sort((a, b) => b.size - a.size).slice(0, 5);

  const lines = [
    "### Download size (compressed)",
    "",
    "| | Size | Budget | Files |",
    "| --- | --- | --- | --- |",
    `| At startup | ${mb(startupTotal)} | ${mb(STARTUP_BUDGET)} | ${startup.length} |`,
    `| Everything | ${mb(total)} | ${mb(TOTAL_BUDGET)} | ${all.length} |`,
    "",
    "Biggest files: " + biggest.map((f) => `\`${f.file}\` ${mb(f.size)}`).join(" · "),
  ];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  const over = [
    startupTotal > STARTUP_BUDGET ? `startup ${mb(startupTotal)} > ${mb(STARTUP_BUDGET)}` : "",
    total > TOTAL_BUDGET ? `total ${mb(total)} > ${mb(TOTAL_BUDGET)}` : "",
  ].filter(Boolean);
  if (over.length > 0) {
    console.error(`Over budget: ${over.join("; ")}`);
    process.exit(1);
  }
}
