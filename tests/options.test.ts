import { describe, expect, it } from "vitest";
import { parseMatchOptions } from "../src/game/options";
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

describe("match options: the rules (docs/specs/10 §6)", () => {
  it("plays every rule except extra time by default; offside is off on Easy", () => {
    expect(parseMatchOptions("", false).rules).toEqual({
      fouls: true,
      offside: true,
      cards: true,
      winner: false,
    });
    expect(parseMatchOptions("?difficulty=easy", false).rules.offside).toBe(false);
    expect(parseMatchOptions("?difficulty=easy&offside=1", false).rules.offside).toBe(true);
  });

  it("shows the new player model unless the old placeholders are asked for (?players=old)", () => {
    expect(parseMatchOptions("", false).players).toBe("new");
    expect(parseMatchOptions("?players=old", false).players).toBe("old");
    expect(parseMatchOptions("?players=both", false).players).toBe("new");
  });

  it("can start straight at a penalty shoot-out, for playtests", () => {
    expect(parseMatchOptions("", false).shootout).toBe(false);
    expect(parseMatchOptions("?shootout=1", false).shootout).toBe(true);
  });

  it("switches each rule from the URL, and no ref turns off fouls, offside and cards", () => {
    expect(parseMatchOptions("?offside=0&cards=0&winner=1", false).rules).toEqual({
      fouls: true,
      offside: false,
      cards: false,
      winner: true,
    });
    expect(parseMatchOptions("?ref=0&winner=1", false).rules).toEqual({
      fouls: false,
      offside: false,
      cards: false,
      winner: true,
    });
  });
});
