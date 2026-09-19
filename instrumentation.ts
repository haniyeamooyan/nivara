export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startExpiryReminderScheduler } = await import("@/lib/notifications/scheduler");
  startExpiryReminderScheduler();
}
