"use server";

import {
  BudgetTransactionType,
  PlanStatus,
  Prisma,
  RenewalStatus,
  ServiceStatus,
  TeamStatus,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const moneySchema = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/);
const fundSchema = z.object({ amount: moneySchema, note: z.string().trim().min(3).max(500) });
const purchaseSchema = z.object({
  serviceId: z.uuid(),
  actualAmount: moneySchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().optional(),
  renewalStatus: z.nativeEnum(RenewalStatus),
  note: z.string().trim().min(3).max(500),
});

function money(value: string) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function dateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
}

async function getManagedTeam(managerId: string) {
  const team = await prisma.team.findFirst({
    where: { managerId, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) redirect("/unauthorized");
  return team;
}

async function ensureTeamAccount(tx: Prisma.TransactionClient, teamId: string) {
  return tx.budgetAccount.upsert({
    where: { teamId },
    create: { ownerType: "TEAM", teamId },
    update: {},
    select: { id: true },
  });
}

function currentPeriodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function addTeamFundsAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await getManagedTeam(manager.id);
  const input = fundSchema.safeParse(Object.fromEntries(formData));
  if (!input.success || money(input.success ? input.data.amount : "0").lte(0)) {
    redirect("/team/shared-budget?error=invalid-funding");
  }

  await prisma.$transaction(async (tx) => {
    const account = await ensureTeamAccount(tx, team.id);
    const period = await tx.budgetPeriod.findUnique({ where: { startsAt: currentPeriodStart() }, select: { id: true } });
    const transaction = await tx.budgetTransaction.create({
      data: {
        accountId: account.id,
        periodId: period?.id,
        type: BudgetTransactionType.ALLOCATION,
        amount: money(input.data.amount),
        referenceType: "TEAM_FUNDING",
        description: input.data.note,
        createdBy: manager.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: manager.id,
        action: "team_budget.funded",
        entityType: "budget_transaction",
        entityId: transaction.id,
        metadata: { teamId: team.id, amount: transaction.amount.toFixed(2), note: input.data.note },
      },
    });
  });

  revalidatePath("/team/shared-budget");
  revalidatePath("/");
  redirect("/team/shared-budget?success=funds-added");
}

export async function registerTeamPurchaseAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await getManagedTeam(manager.id);
  const input = purchaseSchema.safeParse(Object.fromEntries(formData));
  const startDate = input.success ? dateOnly(input.data.startDate) : null;
  const endDate = input.success && input.data.endDate ? dateOnly(input.data.endDate) : null;
  if (
    !input.success ||
    !startDate ||
    (input.data.endDate !== "" && input.data.endDate !== undefined && !endDate) ||
    (endDate && endDate < startDate) ||
    money(input.success ? input.data.actualAmount : "0").lte(0)
  ) {
    redirect("/team/shared-budget?error=invalid-purchase");
  }

  const service = await prisma.service.findFirst({
    where: { id: input.data.serviceId, status: ServiceStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!service) redirect("/team/shared-budget?error=service-unavailable");

  let purchaseId: string | null = null;
  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const account = await ensureTeamAccount(tx, team.id);
      const balance = await tx.budgetTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
      const available = Prisma.Decimal.max(balance._sum.amount ?? new Prisma.Decimal(0), 0);
      const actualAmount = money(input.data.actualAmount);
      if (available.lt(actualAmount)) return null;

      const period = await tx.budgetPeriod.findUnique({ where: { startsAt: currentPeriodStart() }, select: { id: true } });
      const createdPurchase = await tx.purchase.create({
        data: {
          requestId: null,
          teamId: team.id,
          userId: null,
          serviceId: service.id,
          actualAmount,
          companyAmount: actualAmount,
          employeeContribution: new Prisma.Decimal(0),
          startDate,
          endDate,
          planStatus: PlanStatus.ACTIVE,
          renewalStatus: input.data.renewalStatus,
          note: input.data.note,
          purchasedBy: manager.id,
        },
      });
      await tx.budgetTransaction.create({
        data: {
          accountId: account.id,
          periodId: period?.id,
          type: BudgetTransactionType.PURCHASE_DEBIT,
          amount: actualAmount.negated(),
          referenceType: "PURCHASE",
          referenceId: createdPurchase.id,
          description: `Shared team purchase: ${service.name}`,
          createdBy: manager.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: manager.id,
          action: "team_purchase.registered",
          entityType: "purchase",
          entityId: createdPurchase.id,
          metadata: {
            teamId: team.id,
            serviceId: service.id,
            amount: actualAmount.toFixed(2),
            startDate: startDate.toISOString().slice(0, 10),
            endDate: endDate?.toISOString().slice(0, 10) ?? null,
          },
        },
      });
      return createdPurchase;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    purchaseId = purchase?.id ?? null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      redirect("/team/shared-budget?error=concurrent-update");
    }
    throw error;
  }

  if (!purchaseId) redirect("/team/shared-budget?error=insufficient-funds");
  revalidatePath("/team/shared-budget");
  revalidatePath("/");
  redirect("/team/shared-budget?success=purchase-registered");
}
