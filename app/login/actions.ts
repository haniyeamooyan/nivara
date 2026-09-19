"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteCurrentSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { redirect } from "next/navigation";

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(1024),
});

export async function loginAction(formData: FormData) {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) redirect("/login?error=invalid");

  const user = await prisma.user.findUnique({ where: { email: result.data.email } });
  const validPassword = user
    ? await verifyPassword(user.passwordHash, result.data.password)
    : false;

  if (!user || !validPassword || user.status !== "ACTIVE" || user.deletedAt) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  await deleteCurrentSession();
  redirect("/login");
}
