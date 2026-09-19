"use server";

import { Prisma, TeamStatus, UserRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function requireManagedTeam(managerId: string) {
  const team = await prisma.team.findFirst({
    where: { managerId, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true },
  });
  if (!team) redirect("/unauthorized");
  return team.id;
}

const memberSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
});

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createMemberAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const teamId = await requireManagedTeam(manager.id);
  const input = memberSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/team/members?error=invalid-member");

  const { password, ...profile } = input.data;
  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { ...profile, passwordHash, role: UserRole.EMPLOYEE },
      });
      await tx.budgetAccount.create({ data: { ownerType: "USER", userId: user.id } });
      await tx.teamMembership.create({ data: { teamId, userId: user.id } });
      await tx.auditLog.create({
        data: {
          actorId: manager.id,
          action: "team_member.created",
          entityType: "user",
          entityId: user.id,
          metadata: { teamId, email: user.email },
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/team/members?error=email-exists");
    throw error;
  }

  revalidatePath("/team/members");
  redirect("/team/members?success=member-created");
}

const updateMemberSchema = z.object({
  userId: z.uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
});

export async function updateMemberAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const teamId = await requireManagedTeam(manager.id);
  const input = updateMemberSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/team/members?error=invalid-member");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.teamMembership.findFirst({
        where: {
          teamId,
          userId: input.data.userId,
          leftAt: null,
          user: { role: UserRole.EMPLOYEE, status: UserStatus.ACTIVE, deletedAt: null },
        },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      });
      if (!membership) return false;

      const updated = await tx.user.update({
        where: { id: input.data.userId },
        data: {
          firstName: input.data.firstName,
          lastName: input.data.lastName,
          email: input.data.email,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: manager.id,
          action: "team_member.updated",
          entityType: "user",
          entityId: updated.id,
          metadata: {
            teamId,
            previousEmail: membership.user.email,
            email: updated.email,
          },
        },
      });
      return true;
    });
    if (!result) redirect("/team/members?error=member-unavailable");
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/team/members?error=email-exists");
    throw error;
  }

  revalidatePath("/team/members");
  redirect("/team/members?success=member-updated");
}

const memberIdSchema = z.uuid();

export async function deactivateMemberAction(formData: FormData) {
  const manager = await requireRole(UserRole.MANAGER);
  const teamId = await requireManagedTeam(manager.id);
  const userId = memberIdSchema.safeParse(formData.get("userId"));
  if (!userId.success) redirect("/team/members?error=member-unavailable");

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.teamMembership.findFirst({
      where: {
        teamId,
        userId: userId.data,
        leftAt: null,
        user: { role: UserRole.EMPLOYEE, status: UserStatus.ACTIVE, deletedAt: null },
      },
      select: { id: true, userId: true },
    });
    if (!membership) return false;

    const now = new Date();
    await tx.user.update({
      where: { id: membership.userId },
      data: { status: UserStatus.INACTIVE, deletedAt: now },
    });
    await tx.teamMembership.update({
      where: { id: membership.id },
      data: { leftAt: now },
    });
    await tx.session.deleteMany({ where: { userId: membership.userId } });
    await tx.auditLog.create({
      data: {
        actorId: manager.id,
        action: "team_member.soft_deleted",
        entityType: "user",
        entityId: membership.userId,
        metadata: { teamId },
      },
    });
    return true;
  });

  if (!result) redirect("/team/members?error=member-unavailable");
  revalidatePath("/team/members");
  redirect("/team/members?success=member-deactivated");
}
