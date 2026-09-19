import { describe, expect, it } from "@jest/globals";
import { carriedBalance, hasRequestableBalance, paginate, purchaseSplit } from "@/lib/budgets/calculations";

describe("budget calculations", () => {
  it.each([
    [20, 20, { actual: 20, company: 20, employee: 0 }],
    [12.35, 20, { actual: 12.35, company: 12.35, employee: 0 }],
    [25, 20, { actual: 25, company: 20, employee: 5 }],
    [25, 0, { actual: 25, company: 0, employee: 25 }],
  ])("splits an actual purchase of %s against balance %s", (actual, balance, expected) => {
    expect(purchaseSplit(actual, balance)).toEqual(expected);
  });

  it("carries positive unused money and never carries a negative balance", () => {
    expect(carriedBalance(7.29)).toBe(7.29);
    expect(carriedBalance(-2)).toBe(0);
  });

  it("allows a request only when spendable balance is greater than zero", () => {
    expect(hasRequestableBalance(0.01)).toBe(true);
    expect(hasRequestableBalance(0)).toBe(false);
    expect(hasRequestableBalance(-0.01)).toBe(false);
  });

  it("calculates audit pagination and handles an empty result", () => {
    expect(paginate(101, 2, 50)).toEqual({ skip: 100, take: 50, pages: 3 });
    expect(paginate(0, 0, 50)).toEqual({ skip: 0, take: 50, pages: 0 });
    expect(() => paginate(10, -1, 50)).toThrow("Invalid pagination");
  });
});
