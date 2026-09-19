"use server";

import {
  BudgetTransactionType,
  NotificationType,
  PlanStatus,
  Prisma,
  PurchaseRequestStatus,
  RenewalStatus,
  ServiceStatus,
  TeamStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasRequestableBalance, purchaseSplit } from "@/lib/budgets/calculations";

const idSchema = z.uuid();
const moneySchema = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/);
const requestSchema = z.object({
  serviceId: idSchema,
  requestedAmount: moneySchema,
  note: z.string().trim().max(500),
});
const purchaseSchema = z.object({
  requestId: idSchema,
  actualAmount: moneySchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  renewalStatus: z.nativeEnum(RenewalStatus),
});
const directPurchaseSchema = z.object({
  serviceId: idSchema,
  actualAmount: moneySchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  renewalStatus: z.nativeEnum(RenewalStatus),
  note: z.string().trim().max(500),
});

function amount(value: string) {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}

function utcDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function plusOneCalendarMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

async function activeMembership(userId: string) {
  return prisma.teamMembership.findFirst({
    where: {
      userId,
      leftAt: null,
      team: { status: TeamStatus.ACTIVE, deletedAt: null },
      user: { status: UserStatus.ACTIVE, deletedAt: null },
    },
    select: { team: { select: { id: true, name: true, managerId: true } } },
  });
}

async function managedTeam(managerId: string) {
  const team = await prisma.team.findFirst({
    where: { managerId, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) redirect("/unauthorized");
  return team;
}

export async function createDirectPersonalPurchaseAction(formData: FormData) {
  const buyer = await requireRole(UserRole.MANAGER, UserRole.SUPER_ADMIN);
  const input = directPurchaseSchema.safeParse(Object.fromEntries(formData));
  const startDate = input.success ? utcDate(input.data.startDate) : null;
  if (!input.success || !startDate || amount(input.data.actualAmount).lte(0)) {
    redirect("/purchases?error=invalid-purchase");
  }
  const service = await prisma.service.findFirst({
    where: { id: input.data.serviceId, status: ServiceStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!service) redirect("/purchases?error=service-unavailable");

  const managedTeam = buyer.role === UserRole.MANAGER
    ? await prisma.team.findFirst({ where: { managerId: buyer.id, status: TeamStatus.ACTIVE, deletedAt: null }, select: { id: true } })
    : null;
  if (buyer.role === UserRole.MANAGER && !managedTeam) redirect("/unauthorized");

  try {
    await prisma.$transaction(async (tx) => {
      const account = await tx.budgetAccount.upsert({
        where: { userId: buyer.id },
        create: { ownerType: "USER", userId: buyer.id },
        update: {},
        select: { id: true },
      });
      const balance = await tx.budgetTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
      const available = Prisma.Decimal.max(balance._sum.amount ?? new Prisma.Decimal(0), 0);
      const actualAmount = amount(input.data.actualAmount);
      const split = purchaseSplit(Number(actualAmount.toFixed(2)), Number(available.toFixed(2)));
      const companyAmount = new Prisma.Decimal(split.company.toFixed(2));
      const employeeContribution = new Prisma.Decimal(split.employee.toFixed(2));
      const purchase = await tx.purchase.create({
        data: {
          requestId: null,
          teamId: managedTeam?.id ?? null,
          userId: buyer.id,
          serviceId: service.id,
          actualAmount,
          companyAmount,
          employeeContribution,
          startDate,
          endDate: plusOneCalendarMonth(startDate),
          planStatus: PlanStatus.ACTIVE,
          renewalStatus: input.data.renewalStatus,
          note: input.data.note || null,
          purchasedBy: buyer.id,
        },
      });
      const now = new Date();
      const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const period = await tx.budgetPeriod.findUnique({ where: { startsAt: currentMonth }, select: { id: true } });
      if (!companyAmount.isZero()) {
        await tx.budgetTransaction.create({
          data: {
            accountId: account.id,
            periodId: period?.id,
            type: BudgetTransactionType.PURCHASE_DEBIT,
            amount: companyAmount.negated(),
            referenceType: "PURCHASE",
            referenceId: purchase.id,
            description: `Personal purchase: ${service.name}`,
            createdBy: buyer.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: buyer.id,
          action: "purchase.personal_direct_registered",
          entityType: "purchase",
          entityId: purchase.id,
          metadata: { teamId: managedTeam?.id ?? null, serviceId: service.id, actualAmount: actualAmount.toFixed(2), companyAmount: companyAmount.toFixed(2), employeeContribution: employeeContribution.toFixed(2) },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") redirect("/purchases?error=concurrent-update");
    throw error;
  }

  revalidatePath("/purchases");
  revalidatePath("/reports");
  revalidatePath("/");
  redirect("/purchases?success=personal-purchase-registered");
}

export async function createPurchaseRequestAction(formData: FormData) {
  const requester = await requireRole(UserRole.EMPLOYEE);
  const membership = await activeMembership(requester.id);
  if (!membership) redirect("/purchases?error=no-team");
  const input = requestSchema.safeParse(Object.fromEntries(formData));
  if (!input.success || amount(input.success ? input.data.requestedAmount : "0").lte(0)) {
    redirect("/purchases?error=invalid-request");
  }

  const service = await prisma.service.findFirst({
    where: { id: input.data.serviceId, status: ServiceStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!service) redirect("/purchases?error=service-unavailable");

  let created: boolean;
  try {
    created = await prisma.$transaction(async (tx) => {
    const balance = await tx.budgetTransaction.aggregate({ where: { account: { userId: requester.id } }, _sum: { amount: true } });
    if (!hasRequestableBalance(Number(balance._sum.amount?.toString() ?? "0"))) return false;
    const request = await tx.purchaseRequest.create({
      data: {
        requesterId: requester.id,
        teamId: membership.team.id,
        serviceId: service.id,
        requestedAmount: amount(input.data.requestedAmount),
        note: input.data.note || null,
      },
    });
    if (requester.id !== membership.team.managerId) {
      await tx.notification.create({
        data: {
          recipientId: membership.team.managerId,
          type: NotificationType.SYSTEM,
          title: "درخواست خرید جدید",
          body: `${requester.firstName} ${requester.lastName} برای ${service.name} درخواست خرید ثبت کرد.`,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: requester.id,
        action: "purchase_request.submitted",
        entityType: "purchase_request",
        entityId: request.id,
        metadata: { teamId: membership.team.id, serviceId: service.id, requestedAmount: request.requestedAmount.toFixed(2) },
      },
    });
    return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") redirect("/purchases?error=concurrent-update");
    throw error;
  }
  if (!created) redirect("/purchases?error=budget-required");

  revalidatePath("/purchases");
  revalidatePath("/team/requests");
  revalidatePath("/");
  redirect("/purchases?success=request-submitted");
}

const editRequestSchema = requestSchema.extend({ requestId: idSchema });

export async function editPurchaseRequestAction(formData: FormData) {
  const requester = await requireRole(UserRole.EMPLOYEE);
  const input = editRequestSchema.safeParse(Object.fromEntries(formData));
  if (!input.success || amount(input.success ? input.data.requestedAmount : "0").lte(0)) {
    redirect("/purchases?error=invalid-request");
  }
  const membership = await activeMembership(requester.id);
  if (!membership) redirect("/purchases?error=no-team");
  const service = await prisma.service.findFirst({
    where: { id: input.data.serviceId, status: ServiceStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  if (!service) redirect("/purchases?error=service-unavailable");

  let updateResult: "updated" | "not-editable" | "budget-required";
  try {
    updateResult = await prisma.$transaction(async (tx) => {
    const balance = await tx.budgetTransaction.aggregate({ where: { account: { userId: requester.id } }, _sum: { amount: true } });
    if (!hasRequestableBalance(Number(balance._sum.amount?.toString() ?? "0"))) return "budget-required";
    const result = await tx.purchaseRequest.updateMany({
      where: {
        id: input.data.requestId,
        requesterId: requester.id,
        teamId: membership.team.id,
        status: { in: [PurchaseRequestStatus.REJECTED, PurchaseRequestStatus.CANCELLED] },
      },
      data: {
        serviceId: service.id,
        requestedAmount: amount(input.data.requestedAmount),
        note: input.data.note || null,
        status: PurchaseRequestStatus.SUBMITTED,
        rejectionReason: null,
      },
    });
    if (result.count !== 1) return "not-editable";
    const request = await tx.purchaseRequest.findUniqueOrThrow({ where: { id: input.data.requestId } });
    await tx.auditLog.create({
      data: {
        actorId: requester.id,
        action: "purchase_request.resubmitted",
        entityType: "purchase_request",
        entityId: request.id,
        metadata: { teamId: membership.team.id, serviceId: service.id, requestedAmount: request.requestedAmount.toFixed(2) },
      },
    });
    if (requester.id !== membership.team.managerId) {
      await tx.notification.create({
        data: {
          recipientId: membership.team.managerId,
          type: NotificationType.SYSTEM,
          title: "درخواست خرید دوباره ارسال شد",
          body: `${requester.firstName} ${requester.lastName} درخواست خرید ویرایش‌شده‌ای را برای بررسی فرستاد.`,
        },
      });
    }
    return "updated";
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") redirect("/purchases?error=concurrent-update");
    throw error;
  }
  if (updateResult === "budget-required") redirect("/purchases?error=budget-required");
  if (updateResult !== "updated") redirect("/purchases?error=request-not-editable");
  revalidatePath("/purchases");
  revalidatePath("/team/requests");
  revalidatePath("/");
  redirect("/purchases?success=request-resubmitted");
}

export async function cancelPurchaseRequestAction(formData: FormData) {
  const requester = await requireRole(UserRole.EMPLOYEE);
  const requestId = idSchema.safeParse(formData.get("requestId"));
  if (!requestId.success) redirect("/purchases?error=request-not-cancellable");
  const membership = await activeMembership(requester.id);
  if (!membership) redirect("/purchases?error=no-team");

  const cancelled = await prisma.$transaction(async (tx) => {
    const result = await tx.purchaseRequest.updateMany({
      where: { id: requestId.data, requesterId: requester.id, teamId: membership.team.id, status: PurchaseRequestStatus.SUBMITTED },
      data: { status: PurchaseRequestStatus.CANCELLED },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: { actorId: requester.id, action: "purchase_request.cancelled", entityType: "purchase_request", entityId: requestId.data, metadata: { teamId: membership.team.id } },
    });
    if (requester.id !== membership.team.managerId) {
      await tx.notification.create({
        data: {
          recipientId: membership.team.managerId,
          type: NotificationType.SYSTEM,
          title: "درخواست خرید لغو شد",
          body: `${requester.firstName} ${requester.lastName} درخواست خرید را پس گرفت.`,
        },
      });
    }
    return true;
  });
  if (!cancelled) redirect("/purchases?error=request-not-cancellable");
  revalidatePath("/purchases");
  revalidatePath("/team/requests");
  revalidatePath("/");
  redirect("/purchases?success=request-cancelled");
}

const rejectionSchema = z.object({ requestId: idSchema, rejectionReason: z.string().trim().min(3).max(500) });

export async function rejectPurchaseRequestAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const input = rejectionSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/team/requests?error=invalid-rejection");

  const rejected = await prisma.$transaction(async (tx) => {
    const result = await tx.purchaseRequest.updateMany({
      where: { id: input.data.requestId, teamId: team.id, status: PurchaseRequestStatus.SUBMITTED },
      data: { status: PurchaseRequestStatus.REJECTED, rejectionReason: input.data.rejectionReason },
    });
    if (result.count !== 1) return false;
    const request = await tx.purchaseRequest.findUniqueOrThrow({
      where: { id: input.data.requestId },
      select: { requesterId: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: manager.id,
        action: "purchase_request.rejected",
        entityType: "purchase_request",
        entityId: input.data.requestId,
        metadata: { teamId: team.id, rejectionReason: input.data.rejectionReason },
      },
    });
    await tx.notification.create({
      data: {
        recipientId: request.requesterId,
        type: NotificationType.SYSTEM,
        title: "درخواست خرید رد شد",
        body: `مدیر درخواست را رد کرد: ${input.data.rejectionReason}`,
      },
    });
    return true;
  });
  if (!rejected) redirect("/team/requests?error=request-not-pending");
  revalidatePath("/team/requests");
  revalidatePath("/purchases");
  revalidatePath("/");
  redirect("/team/requests?success=request-rejected");
}

export async function completePurchaseAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const input = purchaseSchema.safeParse(Object.fromEntries(formData));
  const startDate = input.success ? utcDate(input.data.startDate) : null;
  if (!input.success || !startDate || amount(input.success ? input.data.actualAmount : "0").lte(0)) {
    redirect("/team/requests?error=invalid-purchase");
  }
  const actualAmount = amount(input.data.actualAmount);

  let completed: boolean;
  try {
    completed = await prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findFirst({
      where: { id: input.data.requestId, teamId: team.id, status: PurchaseRequestStatus.SUBMITTED, requester: { role: UserRole.EMPLOYEE } },
      include: { requester: { select: { id: true, role: true } }, service: { select: { name: true } } },
    });
    if (!request) return false;
    const account = await tx.budgetAccount.upsert({
      where: { userId: request.requesterId },
      create: { ownerType: "USER", userId: request.requesterId },
      update: {},
      select: { id: true },
    });
    const balance = await tx.budgetTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
    const available = Prisma.Decimal.max(balance._sum.amount ?? new Prisma.Decimal(0), 0);
    const split = purchaseSplit(Number(actualAmount.toFixed(2)), Number(available.toFixed(2)));
    const companyAmount = new Prisma.Decimal(split.company.toFixed(2));
    const employeeContribution = new Prisma.Decimal(split.employee.toFixed(2));
    const endDate = plusOneCalendarMonth(startDate);

    const changed = await tx.purchaseRequest.updateMany({
      where: { id: request.id, teamId: team.id, status: PurchaseRequestStatus.SUBMITTED },
      data: { status: PurchaseRequestStatus.PURCHASED },
    });
    if (changed.count !== 1) return false;

    const purchase = await tx.purchase.create({
      data: {
        requestId: request.id,
        teamId: team.id,
        userId: request.requesterId,
        serviceId: request.serviceId,
        actualAmount,
        companyAmount,
        employeeContribution,
        startDate,
        endDate,
        planStatus: PlanStatus.ACTIVE,
        renewalStatus: input.data.renewalStatus,
        purchasedBy: manager.id,
      },
    });
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const period = await tx.budgetPeriod.findUnique({ where: { startsAt: currentMonth }, select: { id: true } });
    if (!companyAmount.isZero()) {
      await tx.budgetTransaction.create({
        data: {
          accountId: account.id,
          periodId: period?.id,
          type: BudgetTransactionType.PURCHASE_DEBIT,
          amount: companyAmount.negated(),
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          description: `Company budget share for ${request.service.name}`,
          createdBy: manager.id,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: manager.id,
        action: "purchase.completed",
        entityType: "purchase",
        entityId: purchase.id,
        metadata: {
          requestId: request.id,
          teamId: team.id,
          serviceId: request.serviceId,
          actualAmount: actualAmount.toFixed(2),
          companyAmount: companyAmount.toFixed(2),
          employeeContribution: employeeContribution.toFixed(2),
        },
      },
    });
    await tx.notification.create({
      data: {
        recipientId: request.requesterId,
        type: NotificationType.SYSTEM,
        title: "خرید درخواست شما ثبت شد",
        body: `سهم بودجهٔ شرکت: ${companyAmount.toFixed(2)} دلار؛ سهم پرداختی شما: ${employeeContribution.toFixed(2)} دلار.`,
      },
    });
    return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      redirect("/team/requests?error=concurrent-update");
    }
    throw error;
  }

  if (!completed) redirect("/team/requests?error=request-not-pending");
  revalidatePath("/team/requests");
  revalidatePath("/purchases");
  revalidatePath("/");
  redirect("/team/requests?success=purchase-completed");
}
