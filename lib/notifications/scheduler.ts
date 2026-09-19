import { createExpiryReminders } from "@/lib/notifications/expiry-reminders";
import { prisma } from "@/lib/db";

let started = false;

function nextUtcRun(now: Date) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 5));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

async function runReminderJob() {
  try {
    const result = await createExpiryReminders(prisma);
    console.info(`[expiry-reminders] created=${result.remindersCreated} plans=${result.plansFound}`);
  } catch (error) {
    console.error("[expiry-reminders] daily run failed", error instanceof Error ? error.message : "Unknown error");
  }
}

export function startExpiryReminderScheduler() {
  if (started) return;
  started = true;

  void runReminderJob();
  const scheduleNext = () => {
    const delay = nextUtcRun(new Date()).getTime() - Date.now();
    const timer = setTimeout(async () => {
      await runReminderJob();
      scheduleNext();
    }, delay);
    timer.unref();
  };
  scheduleNext();
}
