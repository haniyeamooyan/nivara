import { BudgetTransactionType, PlanStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { reconcilePurchaseDebits } from "@/lib/reports/reconciliation";

export type ReportFilters = {
  mode: "month" | "quarter" | "custom";
  month: string;
  quarter: string;
  from: string;
  to: string;
  teamId: string;
  userId: string;
  serviceId: string;
  auditPage: number;
};

function validMonth(value?: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7);
}

function validQuarter(value?: string) {
  return value && /^\d{4}-Q[1-4]$/.test(value) ? value : `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`;
}

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function dateRange(filters: ReportFilters) {
  let start: Date;
  let endExclusive: Date;
  let label: string;
  if (filters.mode === "quarter") {
    const quarter = validQuarter(filters.quarter);
    const [yearPart, quarterPart] = quarter.split("-Q");
    const month = (Number(quarterPart) - 1) * 3;
    start = new Date(Date.UTC(Number(yearPart), month, 1));
    endExclusive = new Date(Date.UTC(Number(yearPart), month + 3, 1));
    label = quarter;
    return { start, endExclusive, label, mode: filters.mode, month: filters.month, quarter, from: start.toISOString().slice(0, 10), to: new Date(endExclusive.getTime() - 86_400_000).toISOString().slice(0, 10) };
  }
  if (filters.mode === "custom") {
    const customStart = validDate(filters.from);
    const customEnd = validDate(filters.to);
    if (customStart && customEnd && customStart <= customEnd) {
      start = customStart;
      endExclusive = new Date(customEnd.getTime() + 86_400_000);
      label = `${filters.from} — ${filters.to}`;
      return { start, endExclusive, label, mode: filters.mode, month: filters.month, quarter: filters.quarter, from: filters.from, to: filters.to };
    }
  }
  const month = validMonth(filters.month);
  const [year, monthNumber] = month.split("-").map(Number);
  start = new Date(Date.UTC(year, monthNumber - 1, 1));
  endExclusive = new Date(Date.UTC(year, monthNumber, 1));
  return { start, endExclusive, label: month, mode: "month" as const, month, quarter: filters.quarter, from: start.toISOString().slice(0, 10), to: new Date(endExclusive.getTime() - 86_400_000).toISOString().slice(0, 10) };
}

function sumDecimals(values: { toString(): string }[]) {
  return values.reduce<Prisma.Decimal>((sum, value) => sum.plus(value.toString()), new Prisma.Decimal(0));
}

export async function getCtoReport(input: ReportFilters) {
  const range = dateRange(input);
  const [teams, users, services] = await Promise.all([
    prisma.team.findMany({ where: { deletedAt: null }, select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: { in: [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE] }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, role: true, status: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.service.findMany({ select: { id: true, name: true, category: true, status: true, deletedAt: true }, orderBy: { name: "asc" } }),
  ]);
  const teamId = teams.some((team) => team.id === input.teamId) ? input.teamId : "";
  const userId = users.some((user) => user.id === input.userId) ? input.userId : "";
  const serviceId = services.some((service) => service.id === input.serviceId) ? input.serviceId : "";
  const purchaseWhere: Prisma.PurchaseWhereInput = {
    startDate: { gte: range.start, lt: range.endExclusive },
    ...(teamId ? { teamId } : {}),
    ...(userId ? { userId } : {}),
    ...(serviceId ? { serviceId } : {}),
  };
  const personAccounts: Prisma.BudgetAccountWhereInput = {
    ownerType: "USER",
    user: {
      role: { in: [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE] },
      deletedAt: null,
      ...(userId ? { id: userId } : {}),
      ...(teamId ? { memberships: { some: { teamId, leftAt: null } } } : {}),
    },
  };
  const accountWhere: Prisma.BudgetAccountWhereInput = teamId
    ? { OR: [{ ownerType: "TEAM", teamId, team: { deletedAt: null } }, personAccounts] }
    : userId
      ? personAccounts
      : { OR: [{ ownerType: "TEAM", team: { deletedAt: null } }, personAccounts] };
  const personalPurchaseWhere: Prisma.PurchaseWhereInput = { ...purchaseWhere, userId: userId || { not: null } };
  const sharedPurchaseWhere: Prisma.PurchaseWhereInput = userId ? { ...purchaseWhere, userId: { in: [] } } : { ...purchaseWhere, userId: null };
  const auditPage = Number.isSafeInteger(input.auditPage) && input.auditPage >= 0 && input.auditPage <= 100_000 ? input.auditPage : 0;
  const auditWhere: Prisma.AuditLogWhereInput = { createdAt: { gte: range.start, lt: range.endExclusive }, ...(userId ? { actorId: userId } : {}) };
  const [total, personal, shared, byTeam, byService, byUser, personalAllocations, teamFunding, accounts, activePlans, expiringPlans, auditLogs, auditCount, purchasesForReconciliation] = await Promise.all([
    prisma.purchase.aggregate({ where: purchaseWhere, _count: { _all: true }, _sum: { actualAmount: true, companyAmount: true, employeeContribution: true } }),
    prisma.purchase.aggregate({ where: personalPurchaseWhere, _count: { _all: true }, _sum: { actualAmount: true, companyAmount: true, employeeContribution: true } }),
    prisma.purchase.aggregate({ where: sharedPurchaseWhere, _count: { _all: true }, _sum: { actualAmount: true, companyAmount: true } }),
    prisma.purchase.groupBy({ by: ["teamId"], where: purchaseWhere, _count: { _all: true }, _sum: { actualAmount: true, companyAmount: true } }),
    prisma.purchase.groupBy({ by: ["serviceId"], where: purchaseWhere, _count: { _all: true }, _sum: { actualAmount: true, companyAmount: true } }),
    prisma.purchase.groupBy({ by: ["userId"], where: personalPurchaseWhere, _count: { _all: true }, _sum: { actualAmount: true, companyAmount: true, employeeContribution: true } }),
    prisma.budgetAllocation.aggregate({ where: { confirmedAt: { gte: range.start, lt: range.endExclusive }, ...(teamId ? { teamId } : {}), ...(userId ? { userId } : {}) }, _sum: { amount: true } }),
    userId ? Promise.resolve({ _sum: { amount: null } }) : prisma.budgetTransaction.aggregate({
      where: { type: BudgetTransactionType.ALLOCATION, referenceType: "TEAM_FUNDING", createdAt: { gte: range.start, lt: range.endExclusive }, account: { ownerType: "TEAM", ...(teamId ? { teamId } : {}) } },
      _sum: { amount: true },
    }),
    prisma.budgetAccount.findMany({ where: accountWhere, include: { user: { select: { id: true, firstName: true, lastName: true, memberships: { where: { leftAt: null }, select: { team: { select: { id: true, name: true } } } } } }, team: { select: { id: true, name: true } } }, orderBy: [{ ownerType: "asc" }] }),
    prisma.purchase.count({ where: { planStatus: PlanStatus.ACTIVE, ...(teamId ? { teamId } : {}), ...(userId ? { userId } : {}), ...(serviceId ? { serviceId } : {}) } }),
    prisma.purchase.count({ where: { planStatus: PlanStatus.ACTIVE, endDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86_400_000) }, ...(teamId ? { teamId } : {}), ...(userId ? { userId } : {}), ...(serviceId ? { serviceId } : {}) } }),
    prisma.auditLog.findMany({ where: auditWhere, include: { actor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 50, skip: auditPage * 50 }),
    prisma.auditLog.count({ where: auditWhere }),
    prisma.purchase.findMany({ where: purchaseWhere, select: { id: true, companyAmount: true } }),
  ]);
  const purchaseDebits = purchasesForReconciliation.length === 0 ? [] : await prisma.budgetTransaction.findMany({
    where: { type: BudgetTransactionType.PURCHASE_DEBIT, referenceType: "PURCHASE", referenceId: { in: purchasesForReconciliation.map(({ id }) => id) } },
    select: { referenceId: true, amount: true },
  });
  const reconciliation = reconcilePurchaseDebits(
    purchasesForReconciliation.map(({ id, companyAmount }) => ({ id, companyAmount: companyAmount.toFixed(2) })),
    purchaseDebits.map(({ referenceId, amount }) => ({ referenceId, amount: amount.toFixed(2) })),
  );
  const balanceGroups = await prisma.budgetTransaction.groupBy({
    by: ["accountId"],
    where: { account: accountWhere },
    _sum: { amount: true },
  });
  const balanceByAccount = new Map(balanceGroups.map((group) => [group.accountId, group._sum.amount ?? new Prisma.Decimal(0)]));
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const userNames = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`]));
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));
  const balances = accounts.map((account) => ({
    id: account.id,
    ownerType: account.ownerType,
    name: account.team?.name ?? (account.user ? `${account.user.firstName} ${account.user.lastName}` : "حساب نامشخص"),
    teamName: account.team?.name ?? account.user?.memberships[0]?.team.name ?? "—",
    balance: balanceByAccount.get(account.id) ?? new Prisma.Decimal(0),
  })).sort((a, b) => Number(b.balance.minus(a.balance)));

  return {
    ...range,
    filters: { teamId, userId, serviceId },
    teams, users, services,
    summary: {
      count: total._count._all,
      actual: total._sum.actualAmount ?? new Prisma.Decimal(0),
      company: total._sum.companyAmount ?? new Prisma.Decimal(0),
      employee: total._sum.employeeContribution ?? new Prisma.Decimal(0),
      personalCompany: personal._sum.companyAmount ?? new Prisma.Decimal(0),
      personalActual: personal._sum.actualAmount ?? new Prisma.Decimal(0),
      personalEmployee: personal._sum.employeeContribution ?? new Prisma.Decimal(0),
      personalCount: personal._count._all,
      sharedCompany: shared._sum.companyAmount ?? new Prisma.Decimal(0),
      sharedActual: shared._sum.actualAmount ?? new Prisma.Decimal(0),
      sharedCount: shared._count._all,
      personalAllocated: personalAllocations._sum.amount ?? new Prisma.Decimal(0),
      teamFunding: teamFunding._sum.amount ?? new Prisma.Decimal(0),
      totalBalance: sumDecimals(balances.map((account) => account.balance)),
      personalBalance: sumDecimals(balances.filter((account) => account.ownerType === "USER").map((account) => account.balance)),
      teamBalance: sumDecimals(balances.filter((account) => account.ownerType === "TEAM").map((account) => account.balance)),
      activePlans,
      expiringPlans,
    },
    reconciliation,
    byTeam: byTeam.map((row) => ({ id: row.teamId ?? "organization", name: row.teamId ? teamNames.get(row.teamId) ?? "تیم حذف‌شده" : "خرید سازمانی · بدون تیم", count: row._count._all, actual: row._sum.actualAmount ?? new Prisma.Decimal(0), company: row._sum.companyAmount ?? new Prisma.Decimal(0) })).sort((a, b) => Number(b.company.minus(a.company))),
    byService: byService.map((row) => ({ id: row.serviceId, name: serviceNames.get(row.serviceId) ?? "سرویس حذف‌شده", count: row._count._all, actual: row._sum.actualAmount ?? new Prisma.Decimal(0), company: row._sum.companyAmount ?? new Prisma.Decimal(0) })).sort((a, b) => Number(b.company.minus(a.company))),
    byUser: byUser.filter((row) => row.userId !== null).map((row) => ({ id: row.userId!, name: userNames.get(row.userId!) ?? "کاربر حذف‌شده", count: row._count._all, actual: row._sum.actualAmount ?? new Prisma.Decimal(0), company: row._sum.companyAmount ?? new Prisma.Decimal(0), employee: row._sum.employeeContribution ?? new Prisma.Decimal(0) })).sort((a, b) => Number(b.company.minus(a.company))),
    balances,
    auditLogs,
    auditPage,
    auditPages: Math.ceil(auditCount / 50),
    scope: { serviceFiltered: Boolean(serviceId), userFiltered: Boolean(userId) },
  };
}
