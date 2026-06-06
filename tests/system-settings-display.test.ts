import { describe, expect, it } from "vitest";
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from "../src/features/system-settings/lib/display";

describe("system settings display formatting", () => {
  it("formats dates consistently in the IEEE UoM timezone", () => {
    expect(formatDisplayDate("2026-06-06T18:45:00.000Z")).toBe("07/06/2026");
  });

  it("formats audit timestamps consistently in the IEEE UoM timezone", () => {
    expect(formatDisplayDateTime("2026-06-06T18:45:00.000Z")).toBe(
      "07/06/2026, 00:15:00",
    );
  });
});
