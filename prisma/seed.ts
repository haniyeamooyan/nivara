import { PrismaClient, UserRole } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The development seed must not run in production.");
  }

  const password = process.env.SEED_PASSWORD;
  if (!password || password === "replace-with-a-development-only-password") {
    throw new Error("Set a non-placeholder SEED_PASSWORD before running the seed.");
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@nivara.local" },
      update: {},
      create: {
        email: "admin@nivara.local",
        passwordHash,
        firstName: "Nivara",
        lastName: "Admin",
        role: UserRole.SUPER_ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: "cto@nivara.local" },
      update: {},
      create: {
        email: "cto@nivara.local",
        passwordHash,
        firstName: "Nivara",
        lastName: "CTO",
        role: UserRole.CTO,
      },
    }),
    prisma.user.upsert({
      where: { email: "manager@nivara.local" },
      update: {},
      create: {
        email: "manager@nivara.local",
        passwordHash,
        firstName: "Nivara",
        lastName: "Manager",
        role: UserRole.MANAGER,
      },
    }),
    prisma.user.upsert({
      where: { email: "employee@nivara.local" },
      update: {},
      create: {
        email: "employee@nivara.local",
        passwordHash,
        firstName: "Nivara",
        lastName: "Employee",
        role: UserRole.EMPLOYEE,
      },
    }),
  ]);
  const [, , manager, employee] = users;

  const team = await prisma.team.upsert({
    where: { id: "10000000-0000-4000-8000-000000000001" },
    update: { managerId: manager.id },
    create: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Platform",
      managerId: manager.id,
    },
  });

  await prisma.budgetAccount.upsert({
    where: { teamId: team.id },
    update: {},
    create: { ownerType: "TEAM", teamId: team.id },
  });

  await prisma.teamMembership.upsert({
    where: { teamId_userId: { teamId: "10000000-0000-4000-8000-000000000001", userId: manager.id } },
    update: { leftAt: null },
    create: { teamId: "10000000-0000-4000-8000-000000000001", userId: manager.id },
  });

  await prisma.teamMembership.upsert({
    where: { teamId_userId: { teamId: "10000000-0000-4000-8000-000000000001", userId: employee.id } },
    update: { leftAt: null },
    create: { teamId: "10000000-0000-4000-8000-000000000001", userId: employee.id },
  });

  for (const service of [
    { name: "OpenAI", category: "AI" },
    { name: "Anthropic", category: "AI" },
    { name: "GitHub", category: "Development" },
  ]) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: { category: service.category },
      create: service,
    });
  }

  for (const user of users) {
    await prisma.budgetAccount.upsert({
      where: { userId: user.id },
      update: {},
      create: { ownerType: "USER", userId: user.id },
    });
  }

  console.info("Nivara development seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Nivara development seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
