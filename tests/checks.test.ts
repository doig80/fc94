import { describe, expect, it } from "vitest";
import { allowed, offenders, SHIPPED_OK, TOOLS_OK } from "../scripts/check-licences";
import { startupFiles } from "../scripts/check-size";

describe("licence check", () => {
  it("accepts permissive licences and rejects copyleft in the game", () => {
    expect(allowed("MIT", SHIPPED_OK)).toBe(true);
    expect(allowed("GPL-3.0", SHIPPED_OK)).toBe(false);
    expect(allowed("MPL-2.0", SHIPPED_OK)).toBe(false);
    expect(allowed("MPL-2.0", TOOLS_OK)).toBe(true);
  });

  it("reads SPDX expressions", () => {
    expect(allowed("(MIT OR GPL-3.0)", SHIPPED_OK)).toBe(true);
    expect(allowed("MIT AND GPL-3.0", SHIPPED_OK)).toBe(false);
    expect(allowed("(BSD-2-Clause AND ISC)", SHIPPED_OK)).toBe(true);
  });

  it("names the offending packages", () => {
    const list = {
      MIT: [{ name: "fine", versions: ["1.0.0"] }],
      "GPL-3.0": [{ name: "sticky", versions: ["2.1.0"] }],
    };
    expect(offenders(list, SHIPPED_OK)).toEqual(["sticky@2.1.0 (GPL-3.0)"]);
  });
});

describe("size check", () => {
  it("counts the entry and its static imports, not lazy chunks", () => {
    const manifest = {
      "index.html": {
        file: "assets/index.js",
        isEntry: true,
        imports: ["_shared.js"],
        css: ["assets/index.css"],
      },
      "_shared.js": { file: "assets/shared.js" },
      "src/lazy.ts": { file: "assets/lazy.js", imports: ["_shared.js"] },
    };
    expect(startupFiles(manifest)).toEqual([
      "assets/index.css",
      "assets/index.js",
      "assets/shared.js",
      "index.html",
    ]);
  });
});
