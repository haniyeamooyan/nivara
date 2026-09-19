"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = z.uuid().safeParse(formData.get("notificationId"));
  if (!notificationId.success) return;

  await prisma.notification.updateMany({
    where: { id: notificationId.data, recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/");
}
