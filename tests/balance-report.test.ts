import { describe, expect, it } from "vitest";
import { failures, formatReport, rowStatus, type BalanceSection } from "../scripts/balance-report";

const section = (goals: number, exploit: number): BalanceSection => ({
  title: "Even match",
  about: "10 matches",
  rows: [
    { label: "Goals per match", value: goals, unit: "", min: 3, max: 6, enforced: true },
    { label: "Golden shot", value: exploit, unit: "%", max: 0.5, enforced: false },
    { label: "Fouls per match", value: 9, unit: "", enforced: false },
  ],
});

describe("balance report (docs/specs/11 §6)", () => {
  it("fails CI only for a missed enforced target", () => {
    expect(rowStatus(section(4, 0).rows[0])).toBe("pass");
    expect(rowStatus(section(7, 0).rows[0])).toBe("fail");
    expect(rowStatus(section(4, 1).rows[1])).toBe("warn");
    expect(rowStatus(section(4, 1).rows[2])).toBe("info");
    expect(failures([section(4, 1)])).toEqual([]);
    expect(failures([section(2.5, 0)])).toEqual(["Even match: Goals per match is 2.50, target 3 – 6"]);
  });

  it("compares with the base branch", () => {
    const md = formatReport([section(4.2, 1)], [section(3.8, 1)]);
    expect(md).toContain("| Goals per match | 4.20 | 3.80 | 3 – 6 | ✅ |");
    expect(md).toContain("| Golden shot | 100% | 100% | ≤ 50% | ⚠️ |");
    expect(md).toContain("1 known problem");
  });
});
