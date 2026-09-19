"use server";

import { Prisma, ServiceStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const idSchema = z.uuid();
const serviceFields = {
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().max(80).transform((value) => value || null),
};

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createServiceAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const input = z.object(serviceFields).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/services?error=invalid-service");

  try {
    await prisma.$transaction(async (tx) => {
      const service = await tx.service.create({ data: input.data });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "service.created",
          entityType: "service",
          entityId: service.id,
          metadata: { name: service.name, category: service.category },
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/services?error=service-exists");
    throw error;
  }

  revalidatePath("/services");
  redirect("/services?success=service-created");
}

const updateServiceSchema = z.object({ ...serviceFields, serviceId: idSchema });

export async function updateServiceAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const input = updateServiceSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) redirect("/services?error=invalid-service");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.service.findFirst({
        where: {
          id: input.data.serviceId,
          status: ServiceStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true, name: true, category: true },
      });
      if (!existing) return false;

      const updated = await tx.service.update({
        where: { id: existing.id },
        data: { name: input.data.name, category: input.data.category },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "service.updated",
          entityType: "service",
          entityId: updated.id,
          metadata: {
            previousName: existing.name,
            name: updated.name,
            previousCategory: existing.category,
            category: updated.category,
          },
        },
      });
      return true;
    });
    if (!result) redirect("/services?error=service-unavailable");
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/services?error=service-exists");
    throw error;
  }

  revalidatePath("/services");
  redirect("/services?success=service-updated");
}

export async function deactivateServiceAction(formData: FormData) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const serviceId = idSchema.safeParse(formData.get("serviceId"));
  if (!serviceId.success) redirect("/services?error=service-unavailable");

  const result = await prisma.$transaction(async (tx) => {
    const service = await tx.service.findFirst({
      where: {
        id: serviceId.data,
        status: ServiceStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!service) return false;

    await tx.service.update({
      where: { id: service.id },
      data: { status: ServiceStatus.INACTIVE, deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "service.soft_deleted",
        entityType: "service",
        entityId: service.id,
        metadata: { name: service.name },
      },
    });
    return true;
  });

  if (!result) redirect("/services?error=service-unavailable");
  revalidatePath("/services");
  redirect("/services?success=service-deactivated");
}
