import { describe, expect, it } from "vitest";
import { parseOptions, toSearch } from "../src/looktest/options";

describe("look-test options", () => {
  it("uses defaults for an empty query", () => {
    const o = parseOptions("", false);
    expect(o).toMatchObject({
      look: "stylised",
      time: "day",
      weather: "clear",
      quality: "high",
      camera: "classic",
    });
    expect(o.freeze).toBe(false);
  });

  it("starts phones on the low preset", () => {
    expect(parseOptions("", true).quality).toBe("low");
  });

  it("reads valid values and ignores invalid ones", () => {
    const o = parseOptions("?look=toon&time=night&weather=hail&freeze=1&hideui", false);
    expect(o.look).toBe("toon");
    expect(o.time).toBe("night");
    expect(o.weather).toBe("clear");
    expect(o.freeze).toBe(true);
    expect(o.hideUi).toBe(true);
  });

  it("round-trips through the share link", () => {
    const o = parseOptions("?look=toon&time=dusk&weather=snow&quality=low&camera=orbit", false);
    expect(parseOptions(toSearch(o), false)).toEqual(o);
  });
});
