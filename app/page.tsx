import { UserRole } from "@prisma/client";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { markNotificationReadAction } from "@/app/notifications/actions";

const roleNames: Record<UserRole, string> = {
  SUPER_ADMIN: "مدیر ارشد سامانه",
  CTO: "مدیر سیستم · CTO",
  MANAGER: "مدیر واحد",
  EMPLOYEE: "همکار تیم",
};

export default async function HomePage() {
  const user = await requireUser();
  const [notifications, managerBudgetReminder, employeeBalance] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, createdAt: true },
    }),
    user.role === UserRole.MANAGER
      ? (async () => {
          const month = new Date().toISOString().slice(0, 7);
          const [year, monthNumber] = month.split("-").map(Number);
          const startsAt = new Date(Date.UTC(year, monthNumber - 1, 1));
          const team = await prisma.team.findFirst({
            where: { managerId: user.id, status: "ACTIVE", deletedAt: null },
            select: { id: true, name: true },
          });
          if (!team) return null;
          const period = await prisma.budgetPeriod.findUnique({ where: { startsAt }, select: { id: true } });
          if (!period) return { month, teamName: team.name };
          const allocation = await prisma.teamBudgetAllocation.findUnique({
            where: { periodId_teamId: { periodId: period.id, teamId: team.id } },
            select: { status: true },
          });
          return allocation?.status === "CONFIRMED" ? null : { month, teamName: team.name };
        })()
      : Promise.resolve(null),
    user.role === UserRole.EMPLOYEE
      ? prisma.budgetTransaction.aggregate({
          where: { account: { userId: user.id } },
          _sum: { amount: true },
        }).then((result) => result._sum.amount?.toFixed(2) ?? "0.00")
      : Promise.resolve(null),
  ]);
  const roleLinks = {
    [UserRole.SUPER_ADMIN]: [
      { href: "/teams", title: "تیم‌ها و مدیران", description: "ساخت تیم، تعیین مدیر و مشاهدهٔ فهرست تیم‌های فعال." },
      { href: "/services", title: "کاتالوگ سرویس‌ها", description: "ثبت و نگهداری سرویس‌های قابل خرید سازمان." },
      { href: "/purchases", title: "خرید شخصی من", description: "ثبت مستقیم خرید شخصی و مشاهدهٔ سهم اعتبار مصرف‌شده." },
    ],
    [UserRole.MANAGER]: [
      { href: "/team/members", title: "اعضای تیم", description: "ساخت حساب کارمند، ویرایش مشخصات و مدیریت عضویت‌ها." },
      { href: "/team/budgets", title: "بودجهٔ تیم", description: "تخصیص ماهانه، تعیین مبلغ گروهی و استثنای فردی، و مشاهدهٔ مانده." },
      { href: "/team/shared-budget", title: "حساب خریدهای تیمی", description: "ثبت دستی دریافتی تیم، ثبت خرید غیرشخصی و پیگیری ماندهٔ منتقل‌شده." },
      { href: "/team/requests", title: "درخواست‌های تیم", description: "بررسی درخواست‌ها، ثبت خرید نهایی یا رد با دلیل." },
      { href: "/team/renewals", title: "تمدید و انقضا", description: "رسیدگی به عدم تمدید، ثبت خرید تمدید و مدیریت تاریخ انقضای پلن‌های تیم." },
      { href: "/purchases", title: "خرید شخصی من", description: "ثبت مستقیم خرید شخصی و مشاهدهٔ سهم اعتبار مصرف‌شده." },
    ],
    [UserRole.CTO]: [
      { href: "/reports", title: "گزارش شرکت", description: "مشاهدهٔ هزینه‌ها، تخصیص‌ها، مانده‌ها و تاریخچه با فیلتر ماهانه و فصلی." },
    ],
    [UserRole.EMPLOYEE]: [
      { href: "/purchases", title: "درخواست خرید", description: "ثبت درخواست سرویس و پیگیری وضعیت خرید و سهم بودجه." },
    ],
  }[user.role];

  return (
    <main className="app-shell">
      <AppHeader firstName={user.firstName} role={user.role} />
      <div className="page-content">
        <section className="welcome-card">
          <p className="eyebrow">{roleNames[user.role]}</p>
          <h1>خوش آمدی، {user.firstName}</h1>
          <p className="muted">{user.email}</p>
          <p className="muted">سامانهٔ متمرکز مدیریت خرید و بودجهٔ تیم فنی.</p>
        </section>
        {employeeBalance !== null && (
          <section className="panel employee-balance-card" aria-label="اعتبار شخصی">
            <div><p className="eyebrow">اعتبار شخصی</p><h2>موجودی قابل استفاده</h2></div>
            <strong dir="ltr">${employeeBalance}</strong>
            <p>این موجودی شامل اعتبارهای استفاده‌نشدهٔ دوره‌های قبل است.</p>
          </section>
        )}
        {managerBudgetReminder && (
          <section className="panel notification-panel budget-reminder" aria-labelledby="budget-reminder-title">
            <div><p className="eyebrow">اقدام لازم · {managerBudgetReminder.month}</p><h2 id="budget-reminder-title">تخصیص بودجهٔ این ماه ثبت نشده</h2><p>برای اینکه اعضای {managerBudgetReminder.teamName} اعتبار جدید بگیرند، مبلغ گروهی و استثناهای فردی را بررسی و تأیید کنید.</p></div>
            <Link className="button button-primary" href="/team/budgets">رفتن به تخصیص بودجه</Link>
          </section>
        )}
        {notifications.length > 0 && (
          <section className="panel notification-panel" aria-labelledby="notifications-title">
            <div className="panel-heading"><div><p className="eyebrow">اعلان‌های داخل سامانه</p><h2 id="notifications-title">تازه‌ها</h2></div></div>
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <div><strong>{notification.title}</strong><p>{notification.body}</p><time dateTime={notification.createdAt.toISOString()}>{notification.createdAt.toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "UTC" })}</time></div>
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button className="button button-quiet" type="submit">خواندم</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
        {roleLinks.length > 0 ? (
          <section className="quick-link-grid" aria-label="دسترسی‌های شما">
            {roleLinks.map((item) => (
              <Link className="quick-link-card" href={item.href} key={item.href}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </Link>
            ))}
          </section>
        ) : (
          <section className="panel dashboard-next-step">
            <p className="eyebrow">گام بعدی</p>
            <h2>{user.role === UserRole.CTO ? "گزارش‌های شرکت" : "درخواست خرید"}</h2>
            <p className="muted">این بخش در مرحلهٔ بعدی MVP ساخته می‌شود.</p>
          </section>
        )}
      </div>
    </main>
  );
}
