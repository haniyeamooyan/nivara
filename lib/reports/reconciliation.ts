type PurchaseAmount = { id: string; companyAmount: string };
type PurchaseDebit = { referenceId: string | null; amount: string };

function toCents(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error(`Invalid currency amount: ${value}`);
  const cents = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}

function dollars(cents: bigint) {
  const sign = cents < BigInt(0) ? "-" : "";
  const absolute = cents < BigInt(0) ? -cents : cents;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

export function reconcilePurchaseDebits(purchases: PurchaseAmount[], debits: PurchaseDebit[]) {
  const byPurchase = new Map<string, PurchaseDebit[]>();
  const unexpectedDebitIds: string[] = [];
  const purchaseIds = new Set(purchases.map(({ id }) => id));

  for (const debit of debits) {
    if (!debit.referenceId || !purchaseIds.has(debit.referenceId)) {
      unexpectedDebitIds.push(debit.referenceId ?? "(بدون شناسهٔ خرید)");
      continue;
    }
    const entries = byPurchase.get(debit.referenceId) ?? [];
    entries.push(debit);
    byPurchase.set(debit.referenceId, entries);
  }

  let expectedDebitCents = BigInt(0);
  let actualDebitCents = BigInt(0);
  const missingPurchaseIds: string[] = [];
  const duplicatePurchaseIds: string[] = [];
  const mismatchedPurchaseIds: string[] = [];

  for (const purchase of purchases) {
    const expected = toCents(purchase.companyAmount);
    if (expected < BigInt(0)) throw new Error("Company purchase amount cannot be negative");
    expectedDebitCents += expected;
    const entries = byPurchase.get(purchase.id) ?? [];
    if (expected > BigInt(0) && entries.length === 0) missingPurchaseIds.push(purchase.id);
    if (entries.length > 1) duplicatePurchaseIds.push(purchase.id);
    const actual = entries.reduce((sum, entry) => sum + toCents(entry.amount), BigInt(0));
    actualDebitCents += -actual;
    if (actual !== -expected) mismatchedPurchaseIds.push(purchase.id);
  }

  const isReconciled = missingPurchaseIds.length === 0
    && duplicatePurchaseIds.length === 0
    && mismatchedPurchaseIds.length === 0
    && unexpectedDebitIds.length === 0;

  return {
    isReconciled,
    expectedDebit: dollars(expectedDebitCents),
    actualDebit: dollars(actualDebitCents),
    difference: dollars(expectedDebitCents - actualDebitCents),
    missingPurchaseIds,
    duplicatePurchaseIds,
    mismatchedPurchaseIds,
    unexpectedDebitIds,
  };
}
