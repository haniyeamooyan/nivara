"use server";

import {
  AllocationSource,
  BudgetPeriodStatus,
  BudgetTransactionType,
  Prisma,
  TeamBudgetAllocationStatus,
  TeamStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { carriedBalance } from "@/lib/budgets/calculations";

const moneySchema = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function periodDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const result = {
    startsAt: new Date(Date.UTC(year, monthNumber - 1, 1)),
    endsAt: new Date(Date.UTC(year, monthNumber, 1)),
  };
  return result;
}

function isCurrentMonth(month: string) {
  return month === new Date().toISOString().slice(0, 7);
}

function decimal(value: string) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

async function managedTeam(managerId: string) {
  const team = await prisma.team.findFirst({
    where: { managerId, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) redirect("/unauthorized");
  return team;
}

function redirectBudget(month: string, query: string): never {
  redirect(`/team/budgets?month=${encodeURIComponent(month)}&${query}`);
}

export async function saveBudgetDraftAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const month = monthSchema.safeParse(formData.get("month"));
  const defaultAmount = moneySchema.safeParse(formData.get("defaultAmount"));
  if (!month.success || !defaultAmount.success) redirectBudget(new Date().toISOString().slice(0, 7), "error=invalid-budget");
  if (!isCurrentMonth(month.data)) redirectBudget(month.data, "error=current-month-only");

  const { startsAt, endsAt } = periodDates(month.data);
  const roster = await prisma.teamMembership.findMany({
    where: {
      teamId: team.id,
      leftAt: null,
      user: { status: UserStatus.ACTIVE, deletedAt: null, role: { in: [UserRole.MANAGER, UserRole.EMPLOYEE] } },
    },
    select: { userId: true },
  });
  if (roster.length === 0) redirectBudget(month.data, "error=empty-team");

  const base = decimal(defaultAmount.data);
  const rows = roster.map(({ userId }) => {
    const submitted = formData.get(`override_${userId}`);
    if (submitted === null || submitted === "") {
      return { userId, amount: base, source: AllocationSource.TEAM_DEFAULT };
    }
    const parsed = moneySchema.safeParse(submitted);
    if (!parsed.success) redirectBudget(month.data, "error=invalid-budget");
    return { userId, amount: decimal(parsed.data), source: AllocationSource.INDIVIDUAL_OVERRIDE };
  });

  try {
    await prisma.$transaction(async (tx) => {
      const period = await tx.budgetPeriod.upsert({
        where: { startsAt },
        create: {
          name: month.data,
          startsAt,
          endsAt,
          status: BudgetPeriodStatus.DRAFT,
        },
        update: {},
        select: { id: true, status: true },
      });
      if (period.status === BudgetPeriodStatus.LOCKED || period.status === BudgetPeriodStatus.CLOSED) {
        throw new Error("PERIOD_CLOSED");
      }

      const existing = await tx.teamBudgetAllocation.findUnique({
        where: { periodId_teamId: { periodId: period.id, teamId: team.id } },
        select: { id: true, status: true },
      });
      if (existing?.status === TeamBudgetAllocationStatus.CONFIRMED) throw new Error("ALLOCATION_CONFIRMED");

      const plan = existing
        ? await tx.teamBudgetAllocation.update({
            where: { id: existing.id },
            data: { defaultAmount: base },
            select: { id: true },
          })
        : await tx.teamBudgetAllocation.create({
            data: { periodId: period.id, teamId: team.id, defaultAmount: base },
            select: { id: true },
          });

      await tx.budgetAllocation.deleteMany({ where: { teamBudgetAllocationId: plan.id } });
      await tx.budgetAllocation.createMany({
        data: rows.map((row) => ({
          periodId: period.id,
          teamId: team.id,
          teamBudgetAllocationId: plan.id,
          userId: row.userId,
          amount: row.amount,
          source: row.source,
        })),
      });
      await tx.auditLog.create({
        data: {
          actorId: manager.id,
          action: "budget_allocation.draft_saved",
          entityType: "budget_period",
          entityId: period.id,
          metadata: {
            teamId: team.id,
            defaultAmount: base.toFixed(2),
            memberCount: rows.length,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PERIOD_CLOSED") redirectBudget(month.data, "error=period-closed");
    if (error instanceof Error && error.message === "ALLOCATION_CONFIRMED") redirectBudget(month.data, "error=already-confirmed");
    throw error;
  }

  revalidatePath("/team/budgets");
  redirectBudget(month.data, "success=draft-saved");
}

export async function confirmBudgetAllocationAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const month = monthSchema.safeParse(formData.get("month"));
  if (!month.success) redirectBudget(new Date().toISOString().slice(0, 7), "error=invalid-budget");
  if (!isCurrentMonth(month.data)) redirectBudget(month.data, "error=current-month-only");
  const { startsAt } = periodDates(month.data);

  try {
    await prisma.$transaction(async (tx) => {
      const period = await tx.budgetPeriod.findUnique({ where: { startsAt } });
      if (!period || period.status === BudgetPeriodStatus.LOCKED || period.status === BudgetPeriodStatus.CLOSED) {
        throw new Error("PERIOD_CLOSED");
      }
      const plan = await tx.teamBudgetAllocation.findUnique({
        where: { periodId_teamId: { periodId: period.id, teamId: team.id } },
        include: { allocations: true },
      });
      if (!plan || plan.allocations.length === 0) throw new Error("DRAFT_MISSING");
      if (plan.status === TeamBudgetAllocationStatus.CONFIRMED) throw new Error("ALLOCATION_CONFIRMED");

      const currentRoster = await tx.teamMembership.findMany({
        where: {
          teamId: team.id,
          leftAt: null,
          user: { status: UserStatus.ACTIVE, deletedAt: null, role: { in: [UserRole.MANAGER, UserRole.EMPLOYEE] } },
        },
        select: { userId: true },
      });
      const draftedIds = new Set(plan.allocations.map((allocation) => allocation.userId));
      if (currentRoster.length !== draftedIds.size || currentRoster.some(({ userId }) => !draftedIds.has(userId))) {
        throw new Error("ROSTER_CHANGED");
      }

      const now = new Date();
      let carryTotal = new Prisma.Decimal(0);
      let grantTotal = new Prisma.Decimal(0);
      for (const allocation of plan.allocations) {
        const account = await tx.budgetAccount.upsert({
          where: { userId: allocation.userId },
          create: { ownerType: "USER", userId: allocation.userId },
          update: {},
          select: { id: true },
        });
        const balance = await tx.budgetTransaction.aggregate({
          where: { accountId: account.id },
          _sum: { amount: true },
        });
        const carriedAmount = new Prisma.Decimal(carriedBalance(Number((balance._sum.amount ?? new Prisma.Decimal(0)).toFixed(2))).toFixed(2));
        carryTotal = carryTotal.plus(carriedAmount);
        grantTotal = grantTotal.plus(allocation.amount);

        await tx.budgetAllocation.update({
          where: { id: allocation.id },
          data: { carriedAmount, confirmedBy: manager.id, confirmedAt: now },
        });
        if (!allocation.amount.isZero()) {
          await tx.budgetTransaction.create({
            data: {
              accountId: account.id,
              periodId: period.id,
              type: BudgetTransactionType.ALLOCATION,
              amount: allocation.amount,
              referenceType: "BUDGET_ALLOCATION",
              referenceId: allocation.id,
              description: `Monthly allocation for ${month.data}`,
              createdBy: manager.id,
            },
          });
        }
        await tx.notification.create({
          data: {
            recipientId: allocation.userId,
            type: "BUDGET_ALLOCATION",
            title: "بودجهٔ ماهانه تخصیص یافت",
            body: `برای دورهٔ ${month.data} مبلغ ${allocation.amount.toFixed(2)} دلار به اعتبار شما اضافه شد. ماندهٔ منتقل‌شده: ${carriedAmount.toFixed(2)} دلار.`,
          },
        });
      }

      await tx.teamBudgetAllocation.update({
        where: { id: plan.id },
        data: { status: TeamBudgetAllocationStatus.CONFIRMED, confirmedBy: manager.id, confirmedAt: now },
      });
      if (period.status === BudgetPeriodStatus.DRAFT) {
        await tx.budgetPeriod.update({ where: { id: period.id }, data: { status: BudgetPeriodStatus.OPEN } });
      }
      await tx.auditLog.create({
        data: {
          actorId: manager.id,
          action: "budget_allocation.confirmed",
          entityType: "team_budget_allocation",
          entityId: plan.id,
          metadata: {
            teamId: team.id,
            periodId: period.id,
            month: month.data,
            memberCount: plan.allocations.length,
            newAllocationTotal: grantTotal.toFixed(2),
            carriedBalanceSnapshot: carryTotal.toFixed(2),
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "PERIOD_CLOSED") redirectBudget(month.data, "error=period-closed");
    if (error instanceof Error && error.message === "ALLOCATION_CONFIRMED") redirectBudget(month.data, "error=already-confirmed");
    if (error instanceof Error && error.message === "DRAFT_MISSING") redirectBudget(month.data, "error=draft-missing");
    if (error instanceof Error && error.message === "ROSTER_CHANGED") redirectBudget(month.data, "error=roster-changed");
    throw error;
  }

  revalidatePath("/team/budgets");
  revalidatePath("/");
  redirectBudget(month.data, "success=allocation-confirmed");
}
