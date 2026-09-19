export function purchaseSplit(actualAmount: number, availableBalance: number) {
  if (!Number.isFinite(actualAmount) || actualAmount <= 0) throw new Error("Purchase amount must be positive");
  if (!Number.isFinite(availableBalance)) throw new Error("Balance must be finite");
  const actualCents = Math.round(actualAmount * 100);
  const availableCents = Math.max(0, Math.round(availableBalance * 100));
  const companyCents = Math.min(actualCents, availableCents);
  return {
    actual: actualCents / 100,
    company: companyCents / 100,
    employee: (actualCents - companyCents) / 100,
  };
}

export function carriedBalance(currentBalance: number) {
  if (!Number.isFinite(currentBalance)) throw new Error("Balance must be finite");
  return Math.max(0, Math.round(currentBalance * 100)) / 100;
}

export function hasRequestableBalance(balance: number) {
  return Number.isFinite(balance) && Math.round(balance * 100) > 0;
}

export function paginate(total: number, page: number, pageSize: number) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("Invalid pagination values");
  }
  return { skip: page * pageSize, take: pageSize, pages: Math.ceil(total / pageSize) };
}
