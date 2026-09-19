"use server";

import { BudgetTransactionType, NotificationType, PlanStatus, Prisma, RenewalRequestStatus, RenewalStatus, TeamStatus, UserRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { purchaseSplit } from "@/lib/budgets/calculations";

const idSchema = z.uuid();
const amountSchema = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/);
const nonRenewSchema = z.object({ purchaseId: idSchema, note: z.string().trim().max(500).optional() });
const renewalSchema = z.object({ purchaseId: idSchema, actualAmount: amountSchema, renewalStatus: z.nativeEnum(RenewalStatus), note: z.string().trim().max(500).optional() });

function money(value: string) { return new Prisma.Decimal(value).toDecimalPlaces(2); }
function day(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function plusOneCalendarMonth(value: Date) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const date = value.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date, lastDay)));
}

async function managedTeam(managerId: string) {
  const team = await prisma.team.findFirst({ where: { managerId, status: TeamStatus.ACTIVE, deletedAt: null }, select: { id: true } });
  if (!team) redirect("/unauthorized");
  return team;
}

export async function requestNonRenewalAction(formData: FormData) {
  const requester = await requireRole(UserRole.EMPLOYEE);
  const input = nonRenewSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/purchases?error=invalid-renewal-request");
  const membership = await prisma.teamMembership.findFirst({
    where: { userId: requester.id, leftAt: null, team: { status: TeamStatus.ACTIVE, deletedAt: null }, user: { status: UserStatus.ACTIVE, deletedAt: null } },
    select: { team: { select: { id: true, managerId: true } } },
  });
  if (!membership) redirect("/purchases?error=no-team");

  let submitted = false;
  try {
    submitted = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: { id: input.data.purchaseId, userId: requester.id, teamId: membership.team.id, planStatus: PlanStatus.ACTIVE, endDate: { gte: day(new Date()) } },
      select: { id: true, service: { select: { name: true } }, renewalRequests: { where: { status: RenewalRequestStatus.SUBMITTED }, select: { id: true }, take: 1 } },
    });
    if (!purchase || purchase.renewalRequests.length > 0) return false;
    const request = await tx.renewalRequest.create({
      data: { purchaseId: purchase.id, requestedBy: requester.id, note: input.data.note || null },
    });
    if (membership.team.managerId !== requester.id) {
      await tx.notification.create({ data: {
        recipientId: membership.team.managerId,
        type: NotificationType.RENEWAL_REQUEST,
        title: "درخواست عدم تمدید پلن",
        body: `${requester.firstName} درخواست داده پلن ${purchase.service.name} تمدید نشود.`,
      } });
    }
    await tx.auditLog.create({ data: {
      actorId: requester.id, action: "renewal.non_renewal_requested", entityType: "renewal_request", entityId: request.id,
      metadata: { purchaseId: purchase.id, teamId: membership.team.id, note: input.data.note ?? null },
    } });
    return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      redirect("/purchases?error=renewal-request-exists");
    }
    throw error;
  }
  if (!submitted) redirect("/purchases?error=renewal-request-exists");
  revalidatePath("/purchases"); revalidatePath("/team/renewals"); revalidatePath("/");
  redirect("/purchases?success=renewal-request-submitted");
}

export async function cancelNonRenewalAction(formData: FormData) {
  const requester = await requireRole(UserRole.EMPLOYEE);
  const requestId = idSchema.safeParse(formData.get("requestId"));
  if (!requestId.success) redirect("/purchases?error=renewal-request-not-cancellable");
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.renewalRequest.findFirst({ where: { id: requestId.data, requestedBy: requester.id, status: RenewalRequestStatus.SUBMITTED }, select: { id: true, purchaseId: true } });
    if (!request) return false;
    await tx.renewalRequest.update({ where: { id: request.id }, data: { status: RenewalRequestStatus.CANCELLED } });
    await tx.auditLog.create({ data: { actorId: requester.id, action: "renewal.non_renewal_cancelled", entityType: "renewal_request", entityId: request.id, metadata: { purchaseId: request.purchaseId } } });
    return true;
  });
  if (!result) redirect("/purchases?error=renewal-request-not-cancellable");
  revalidatePath("/purchases"); revalidatePath("/team/renewals");
  redirect("/purchases?success=renewal-request-cancelled");
}

export async function acknowledgeNonRenewalAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const requestId = idSchema.safeParse(formData.get("requestId"));
  if (!requestId.success) redirect("/team/renewals?error=invalid-renewal-request");
  const acknowledged = await prisma.$transaction(async (tx) => {
    const request = await tx.renewalRequest.findFirst({
      where: { id: requestId.data, status: RenewalRequestStatus.SUBMITTED, purchase: { teamId: team.id } },
      include: { purchase: { include: { service: { select: { name: true } } } }, requester: { select: { id: true } } },
    });
    if (!request) return false;
    const changed = await tx.renewalRequest.updateMany({ where: { id: request.id, status: RenewalRequestStatus.SUBMITTED }, data: { status: RenewalRequestStatus.ACKNOWLEDGED } });
    if (changed.count !== 1) return false;
    await tx.purchase.updateMany({ where: { id: request.purchaseId, teamId: team.id, planStatus: PlanStatus.ACTIVE }, data: { renewalStatus: RenewalStatus.NOT_RENEWING } });
    await tx.auditLog.create({ data: { actorId: manager.id, action: "renewal.non_renewal_acknowledged", entityType: "renewal_request", entityId: request.id, metadata: { purchaseId: request.purchaseId } } });
    await tx.auditLog.create({ data: { actorId: manager.id, action: "purchase.renewal_status_changed", entityType: "purchase", entityId: request.purchaseId, metadata: { renewalStatus: RenewalStatus.NOT_RENEWING, renewalRequestId: request.id } } });
    await tx.notification.create({ data: { recipientId: request.requester.id, type: NotificationType.RENEWAL_REQUEST, title: "درخواست عدم تمدید بررسی شد", body: `مدیر درخواست عدم تمدید پلن ${request.purchase.service.name} را ثبت کرد.` } });
    return true;
  });
  if (!acknowledged) redirect("/team/renewals?error=renewal-request-not-pending");
  revalidatePath("/team/renewals"); revalidatePath("/purchases"); revalidatePath("/");
  redirect("/team/renewals?success=non-renewal-acknowledged");
}

export async function registerRenewalPurchaseAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const input = renewalSchema.safeParse(Object.fromEntries(formData));
  if (!input.success || money(input.success ? input.data.actualAmount : "0").lte(0)) redirect("/team/renewals?error=invalid-renewal-purchase");

  let result: "ok" | "invalid" | "funds" = "invalid";
  try {
    result = await prisma.$transaction(async (tx) => {
      const previous = await tx.purchase.findFirst({
        where: {
          id: input.data.purchaseId,
          teamId: team.id,
          planStatus: PlanStatus.ACTIVE,
          renewalStatus: { not: RenewalStatus.NOT_RENEWING },
          endDate: { gte: day(new Date()) },
          renewedInto: null,
          renewalRequests: { none: { status: { in: [RenewalRequestStatus.SUBMITTED, RenewalRequestStatus.ACKNOWLEDGED] } } },
        },
        include: { service: { select: { name: true } } },
      });
      if (!previous?.endDate) return "invalid";
      if (previous.userId) {
        const activeMember = await tx.teamMembership.findFirst({ where: { teamId: team.id, userId: previous.userId, leftAt: null, user: { status: UserStatus.ACTIVE, deletedAt: null } }, select: { id: true } });
        if (!activeMember) return "invalid";
      }
      const startsAt = day(previous.endDate);
      const endsAt = plusOneCalendarMonth(startsAt);
      const ownerWhere = previous.userId ? { userId: previous.userId } : { teamId: team.id };
      const ownerType = previous.userId ? "USER" : "TEAM";
      const account = await tx.budgetAccount.upsert({ where: ownerWhere, create: { ownerType, ...ownerWhere }, update: {}, select: { id: true } });
      const aggregate = await tx.budgetTransaction.aggregate({ where: { accountId: account.id }, _sum: { amount: true } });
      const available = Prisma.Decimal.max(aggregate._sum.amount ?? new Prisma.Decimal(0), 0);
      const actualAmount = money(input.data.actualAmount);
      const split = previous.userId
        ? purchaseSplit(Number(actualAmount.toFixed(2)), Number(available.toFixed(2)))
        : { company: Number(actualAmount.toFixed(2)), employee: 0 };
      const companyAmount = new Prisma.Decimal(split.company.toFixed(2));
      if (!previous.userId && available.lt(actualAmount)) return "funds";
      const employeeContribution = new Prisma.Decimal(split.employee.toFixed(2));

      const changed = await tx.purchase.updateMany({
        where: { id: previous.id, teamId: team.id, planStatus: PlanStatus.ACTIVE, renewedInto: null },
        data: { planStatus: PlanStatus.RENEWED },
      });
      if (changed.count !== 1) return "invalid";
      const purchase = await tx.purchase.create({ data: {
        requestId: null,
        renewedFromId: previous.id,
        teamId: team.id,
        userId: previous.userId,
        serviceId: previous.serviceId,
        actualAmount,
        companyAmount,
        employeeContribution,
        startDate: startsAt,
        endDate: endsAt,
        planStatus: PlanStatus.ACTIVE,
        renewalStatus: input.data.renewalStatus,
        note: input.data.note || null,
        purchasedBy: manager.id,
      } });
      const now = new Date();
      const currentPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const period = await tx.budgetPeriod.findUnique({ where: { startsAt: currentPeriod }, select: { id: true } });
      if (!companyAmount.isZero()) await tx.budgetTransaction.create({ data: {
        accountId: account.id, periodId: period?.id, type: BudgetTransactionType.PURCHASE_DEBIT,
        amount: companyAmount.negated(), referenceType: "PURCHASE", referenceId: purchase.id,
        description: `Renewal: ${previous.service.name}`, createdBy: manager.id,
      } });
      await tx.auditLog.create({ data: {
        actorId: manager.id, action: "purchase.renewed", entityType: "purchase", entityId: purchase.id,
        metadata: { previousPurchaseId: previous.id, teamId: team.id, actualAmount: actualAmount.toFixed(2), companyAmount: companyAmount.toFixed(2), employeeContribution: employeeContribution.toFixed(2) },
      } });
      await tx.auditLog.create({ data: {
        actorId: manager.id, action: "purchase.renewed_into_new_plan", entityType: "purchase", entityId: previous.id,
        metadata: { renewedPurchaseId: purchase.id, teamId: team.id },
      } });
      if (previous.userId) await tx.notification.create({ data: {
        recipientId: previous.userId, type: NotificationType.SYSTEM, title: "تمدید پلن ثبت شد",
        body: `مدیر پلن ${previous.service.name} را تا ${endsAt.toISOString().slice(0, 10)} تمدید کرد. سهم شرکت ${companyAmount.toFixed(2)} دلار و سهم شما ${employeeContribution.toFixed(2)} دلار است.`,
      } });
      return "ok";
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") redirect("/team/renewals?error=concurrent-update");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") redirect("/team/renewals?error=renewal-not-available");
    throw error;
  }
  if (result === "funds") redirect("/team/renewals?error=insufficient-renewal-funds");
  if (result !== "ok") redirect("/team/renewals?error=renewal-not-available");
  revalidatePath("/team/renewals"); revalidatePath("/purchases"); revalidatePath("/");
  redirect("/team/renewals?success=renewal-purchased");
}

export async function markPlanExpiredAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const team = await managedTeam(manager.id);
  const purchaseId = idSchema.safeParse(formData.get("purchaseId"));
  if (!purchaseId.success) redirect("/team/renewals?error=invalid-renewal-request");
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId.data, teamId: team.id, planStatus: PlanStatus.ACTIVE, endDate: { lt: day(new Date()) } },
    select: { id: true, userId: true, service: { select: { name: true } }, endDate: true },
  });
  if (!purchase) redirect("/team/renewals?error=plan-not-expired");
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.purchase.updateMany({ where: { id: purchase.id, teamId: team.id, planStatus: PlanStatus.ACTIVE, endDate: { lt: day(new Date()) } }, data: { planStatus: PlanStatus.EXPIRED } });
    if (changed.count !== 1) return false;
    await tx.auditLog.create({ data: { actorId: manager.id, action: "purchase.expired", entityType: "purchase", entityId: purchase.id, metadata: { teamId: team.id, endDate: purchase.endDate?.toISOString().slice(0, 10) } } });
    if (purchase.userId) await tx.notification.create({ data: { recipientId: purchase.userId, type: NotificationType.SYSTEM, title: "پلن منقضی شد", body: `مدیر وضعیت پلن ${purchase.service.name} را منقضی‌شده ثبت کرد.` } });
    return true;
  });
  if (!result) redirect("/team/renewals?error=plan-not-expired");
  revalidatePath("/team/renewals"); revalidatePath("/purchases"); revalidatePath("/");
  redirect("/team/renewals?success=plan-expired");
}
