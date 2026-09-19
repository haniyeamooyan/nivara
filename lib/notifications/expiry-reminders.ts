import { NotificationType, PlanStatus, PrismaClient, UserStatus } from "@prisma/client";

export async function createExpiryReminders(prisma: PrismaClient, now = new Date()) {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3));
  const targetLabel = target.toISOString().slice(0, 10);
  const purchases = await prisma.purchase.findMany({
    where: {
      planStatus: PlanStatus.ACTIVE,
      endDate: target,
      OR: [
        { team: { status: "ACTIVE", deletedAt: null } },
        { teamId: null, user: { isNot: null } },
      ],
    },
    include: {
      user: { select: { id: true, firstName: true, status: true, deletedAt: true } },
      buyer: { select: { id: true, firstName: true, status: true, deletedAt: true } },
      service: { select: { name: true } },
      team: { include: { manager: { select: { id: true, firstName: true, status: true, deletedAt: true } } } },
    },
  });

  const notifications = purchases.flatMap((purchase) => {
    const recipients = [
      purchase.user && purchase.user.status === UserStatus.ACTIVE && !purchase.user.deletedAt
        ? { id: purchase.user.id, name: purchase.user.firstName }
        : null,
      purchase.team?.manager.status === UserStatus.ACTIVE && !purchase.team.manager.deletedAt
        ? { id: purchase.team.manager.id, name: purchase.team.manager.firstName }
        : purchase.team === null && purchase.buyer.status === UserStatus.ACTIVE && !purchase.buyer.deletedAt
          ? { id: purchase.buyer.id, name: purchase.buyer.firstName }
          : null,
    ].filter((recipient): recipient is { id: string; name: string } => recipient !== null);
    return recipients.map((recipient) => ({
      recipientId: recipient.id,
      type: NotificationType.EXPIRY_REMINDER,
      title: "پلن تا سه روز دیگر به پایان می‌رسد",
      body: `پلن ${purchase.service.name} برای ${purchase.user?.firstName ?? purchase.team?.name ?? "حساب سازمانی"} در تاریخ ${targetLabel} تمام می‌شود. وضعیت تمدید را بررسی کنید.`,
      dedupeKey: `expiry:${purchase.id}:${recipient.id}:${targetLabel}`,
    }));
  });

  if (notifications.length === 0) return { remindersCreated: 0, plansFound: purchases.length };
  const result = await prisma.notification.createMany({ data: notifications, skipDuplicates: true });
  return { remindersCreated: result.count, plansFound: purchases.length };
}
