import { describe, expect, it } from "@jest/globals";
import { reconcilePurchaseDebits } from "@/lib/reports/reconciliation";

describe("reconcilePurchaseDebits", () => {
  it("reconciles personal and team purchases exactly to cents", () => {
    const result = reconcilePurchaseDebits(
      [{ id: "personal", companyAmount: "12.50" }, { id: "team", companyAmount: "20.00" }, { id: "zero", companyAmount: "0.00" }],
      [{ referenceId: "personal", amount: "-12.50" }, { referenceId: "team", amount: "-20.00" }],
    );

    expect(result).toMatchObject({ isReconciled: true, expectedDebit: "32.50", actualDebit: "32.50", difference: "0.00" });
  });

  it("reports a missing debit and a mismatched partial debit", () => {
    const result = reconcilePurchaseDebits(
      [{ id: "missing", companyAmount: "4.00" }, { id: "partial", companyAmount: "7.25" }],
      [{ referenceId: "partial", amount: "-7.00" }],
    );

    expect(result.isReconciled).toBe(false);
    expect(result.expectedDebit).toBe("11.25");
    expect(result.actualDebit).toBe("7.00");
    expect(result.difference).toBe("4.25");
    expect(result.missingPurchaseIds).toEqual(["missing"]);
    expect(result.mismatchedPurchaseIds).toEqual(["missing", "partial"]);
  });

  it("detects duplicate and orphan debit entries", () => {
    const result = reconcilePurchaseDebits(
      [{ id: "p1", companyAmount: "10.00" }],
      [{ referenceId: "p1", amount: "-6.00" }, { referenceId: "p1", amount: "-4.00" }, { referenceId: "deleted", amount: "-1.00" }],
    );

    expect(result.isReconciled).toBe(false);
    expect(result.duplicatePurchaseIds).toEqual(["p1"]);
    expect(result.unexpectedDebitIds).toEqual(["deleted"]);
    expect(result.mismatchedPurchaseIds).toEqual([]);
  });

  it("rejects amounts that cannot be represented in cents", () => {
    expect(() => reconcilePurchaseDebits([{ id: "p1", companyAmount: "1.001" }], [])).toThrow("Invalid currency amount");
    expect(() => reconcilePurchaseDebits([{ id: "p1", companyAmount: "-1.00" }], [])).toThrow("cannot be negative");
  });
});
