import { describe, it, expect } from "vitest";
import { cn, formatTime, startOfDay, endOfDay, startOfWeek } from "./utils";

describe("formatTime", () => {
  it("formats seconds to MM:SS", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(125)).toBe("02:05");
    expect(formatTime(3599)).toBe("59:59");
    expect(formatTime(1500)).toBe("25:00");
  });
});

describe("startOfDay", () => {
  it("returns midnight of the same day", () => {
    const d = new Date(2026, 5, 24, 14, 30, 45, 123);
    const sod = startOfDay(d);
    expect(sod.getHours()).toBe(0);
    expect(sod.getMinutes()).toBe(0);
    expect(sod.getSeconds()).toBe(0);
    expect(sod.getMilliseconds()).toBe(0);
    expect(sod.getDate()).toBe(24);
  });

  it("defaults to today", () => {
    const sod = startOfDay();
    expect(sod.getHours()).toBe(0);
  });
});

describe("endOfDay", () => {
  it("returns last ms of the day", () => {
    const d = new Date(2026, 5, 24, 14, 30);
    const eod = endOfDay(d);
    expect(eod.getHours()).toBe(23);
    expect(eod.getMinutes()).toBe(59);
    expect(eod.getSeconds()).toBe(59);
    expect(eod.getMilliseconds()).toBe(999);
  });
});

describe("startOfWeek", () => {
  it("returns Monday for any day in week", () => {
    // 2026-06-24 is Wednesday
    const wed = new Date(2026, 5, 24);
    const sow = startOfWeek(wed);
    expect(sow.getDay()).toBe(1); // Monday
    expect(sow.getDate()).toBe(22); // Monday before Wed 24
  });

  it("handles Sunday correctly (should go back 6 days)", () => {
    // 2026-06-28 is Sunday
    const sun = new Date(2026, 5, 28);
    const sow = startOfWeek(sun);
    expect(sow.getDay()).toBe(1); // Monday
    expect(sow.getDate()).toBe(22); // Monday of that week
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-2 p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});
