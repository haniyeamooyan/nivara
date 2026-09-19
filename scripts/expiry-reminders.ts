import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createExpiryReminders } from "../lib/notifications/expiry-reminders";

const prisma = new PrismaClient();

createExpiryReminders(prisma)
  .then((result) => console.info(`Expiry reminder run completed: ${result.remindersCreated} reminder(s) created for ${result.plansFound} plan(s).`))
  .catch((error: unknown) => {
    console.error("Expiry reminder run failed.", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
