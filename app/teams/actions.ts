"use server";

import { Prisma, TeamStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const idSchema = z.uuid();
const personSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
});

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createManagerAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const input = personSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/teams?error=invalid-manager");

  const { password, ...profile } = input.data;
  const passwordHash = await hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      const manager = await tx.user.create({
        data: { ...profile, passwordHash, role: UserRole.MANAGER },
      });
      await tx.budgetAccount.create({ data: { ownerType: "USER", userId: manager.id } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "manager.created",
          entityType: "user",
          entityId: manager.id,
          metadata: { email: manager.email, role: manager.role },
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/teams?error=email-exists");
    throw error;
  }

  revalidatePath("/teams");
  redirect("/teams?success=manager-created");
}

const teamSchema = z.object({
  name: z.string().trim().min(2).max(100),
  managerId: idSchema,
});

export async function createTeamAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const input = teamSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/teams?error=invalid-team");

  try {
    await prisma.$transaction(async (tx) => {
      const manager = await tx.user.findFirst({
        where: {
          id: input.data.managerId,
          role: UserRole.MANAGER,
          status: "ACTIVE",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!manager) throw new Error("MANAGER_UNAVAILABLE");

      const membership = await tx.teamMembership.findFirst({
        where: { userId: manager.id, leftAt: null },
        select: { id: true },
      });
      if (membership) throw new Error("MANAGER_ALREADY_ASSIGNED");

      const team = await tx.team.create({
        data: { name: input.data.name, managerId: manager.id },
      });
      await tx.teamMembership.create({ data: { teamId: team.id, userId: manager.id } });
      await tx.budgetAccount.create({ data: { ownerType: "TEAM", teamId: team.id } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "team.created",
          entityType: "team",
          entityId: team.id,
          metadata: { name: team.name, managerId: manager.id },
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/teams?error=duplicate-team");
    if (error instanceof Error && error.message === "MANAGER_UNAVAILABLE") {
      redirect("/teams?error=manager-unavailable");
    }
    if (error instanceof Error && error.message === "MANAGER_ALREADY_ASSIGNED") {
      redirect("/teams?error=manager-assigned");
    }
    throw error;
  }

  revalidatePath("/teams");
  redirect("/teams?success=team-created");
}

const updateTeamSchema = teamSchema.extend({ teamId: idSchema });

export async function updateTeamAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const input = updateTeamSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/teams?error=invalid-team");

  try {
    await prisma.$transaction(async (tx) => {
      const [team, manager] = await Promise.all([
        tx.team.findFirst({
          where: { id: input.data.teamId, status: TeamStatus.ACTIVE, deletedAt: null },
        }),
        tx.user.findFirst({
          where: {
            id: input.data.managerId,
            role: UserRole.MANAGER,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true },
        }),
      ]);
      if (!team) throw new Error("TEAM_UNAVAILABLE");
      if (!manager) throw new Error("MANAGER_UNAVAILABLE");

      if (team.managerId !== manager.id) {
        const membershipElsewhere = await tx.teamMembership.findFirst({
          where: { userId: manager.id, leftAt: null, teamId: { not: team.id } },
          select: { id: true },
        });
        if (membershipElsewhere) throw new Error("MANAGER_ALREADY_ASSIGNED");
        await tx.teamMembership.updateMany({
          where: { teamId: team.id, userId: team.managerId, leftAt: null },
          data: { leftAt: new Date() },
        });
      }

      const updated = await tx.team.update({
        where: { id: team.id },
        data: { name: input.data.name, managerId: manager.id },
      });
      await tx.teamMembership.upsert({
        where: { teamId_userId: { teamId: team.id, userId: manager.id } },
        update: { leftAt: null },
        create: { teamId: team.id, userId: manager.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "team.updated",
          entityType: "team",
          entityId: team.id,
          metadata: {
            previousName: team.name,
            name: updated.name,
            previousManagerId: team.managerId,
            managerId: manager.id,
          },
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/teams?error=duplicate-team");
    if (error instanceof Error && error.message === "TEAM_UNAVAILABLE") {
      redirect("/teams?error=team-unavailable");
    }
    if (error instanceof Error && error.message === "MANAGER_UNAVAILABLE") {
      redirect("/teams?error=manager-unavailable");
    }
    if (error instanceof Error && error.message === "MANAGER_ALREADY_ASSIGNED") {
      redirect("/teams?error=manager-assigned");
    }
    throw error;
  }

  revalidatePath("/teams");
  revalidatePath("/team/members");
  redirect("/teams?success=team-updated");
}

export async function deactivateTeamAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const teamId = idSchema.safeParse(formData.get("teamId"));
  if (!teamId.success) redirect("/teams?error=invalid-team");

  const now = new Date();
  const team = await prisma.$transaction(async (tx) => {
    const activeTeam = await tx.team.findFirst({
      where: { id: teamId.data, status: TeamStatus.ACTIVE, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!activeTeam) return null;

    await tx.teamMembership.updateMany({
      where: { teamId: activeTeam.id, leftAt: null },
      data: { leftAt: now },
    });
    const deactivated = await tx.team.update({
      where: { id: activeTeam.id },
      data: { status: TeamStatus.INACTIVE, deletedAt: now },
      select: { id: true, name: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "team.soft_deleted",
        entityType: "team",
        entityId: activeTeam.id,
        metadata: { name: activeTeam.name },
      },
    });
    return deactivated;
  });

  if (!team) redirect("/teams?error=team-unavailable");
  revalidatePath("/teams");
  revalidatePath("/team/members");
  redirect("/teams?success=team-deactivated");
}
