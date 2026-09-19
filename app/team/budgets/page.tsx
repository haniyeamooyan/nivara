import { AllocationSource, TeamBudgetAllocationStatus, TeamStatus, UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { confirmBudgetAllocationAction, saveBudgetDraftAction } from "@/app/team/budgets/actions";

type BudgetPageProps = { searchParams: Promise<{ month?: string; error?: string; success?: string }> };

const messages: Record<string, { text: string; kind: "error" | "success" }> = {
  "invalid-budget": { text: "ماه یا مبلغ معتبر نیست. مبلغ را با حداکثر دو رقم اعشار وارد کنید.", kind: "error" },
  "empty-team": { text: "برای این تیم عضو فعالی وجود ندارد.", kind: "error" },
  "period-closed": { text: "این دوره بسته شده و امکان تغییر تخصیص ندارد.", kind: "error" },
  "already-confirmed": { text: "تخصیص تیم برای این دوره قبلاً تأیید شده و قفل است.", kind: "error" },
  "draft-missing": { text: "ابتدا پیش‌نویس تخصیص را ذخیره کنید.", kind: "error" },
  "roster-changed": { text: "اعضای تیم بعد از ذخیره پیش‌نویس تغییر کرده‌اند؛ پیش‌نویس را دوباره ذخیره کنید.", kind: "error" },
  "current-month-only": { text: "در این نسخه فقط می‌توان دورهٔ ماه جاری را تخصیص داد.", kind: "error" },
  "draft-saved": { text: "پیش‌نویس ذخیره شد؛ هنوز اعتباری به موجودی کسی اضافه نشده است.", kind: "success" },
  "allocation-confirmed": { text: "تخصیص تأیید شد، موجودی‌ها به‌روز شدند و اعلان داخل سامانه فرستاده شد.", kind: "success" },
};

function money(value: number | string | { toString(): string }) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value.toString()));
}

function validMonth(month?: string) {
  return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : new Date().toISOString().slice(0, 7);
}

export default async function TeamBudgetsPage({ searchParams }: BudgetPageProps) {
  const manager = await requireRole(UserRole.MANAGER);
  const params = await searchParams;
  const month = validMonth(params.month);
  const [year, monthNumber] = month.split("-").map(Number);
  const startsAt = new Date(Date.UTC(year, monthNumber - 1, 1));

  const team = await prisma.team.findFirst({
    where: { managerId: manager.id, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) redirect("/unauthorized");

  const [roster, period] = await Promise.all([
    prisma.teamMembership.findMany({
      where: {
        teamId: team.id,
        leftAt: null,
        user: { status: UserStatus.ACTIVE, deletedAt: null, role: { in: [UserRole.MANAGER, UserRole.EMPLOYEE] } },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            budgetAccounts: { select: { transactions: { select: { amount: true } } } },
          },
        },
      },
      orderBy: [{ user: { role: "asc" } }, { joinedAt: "asc" }],
    }),
    prisma.budgetPeriod.findUnique({
      where: { startsAt },
      include: {
        teamAllocations: {
          where: { teamId: team.id },
          include: { allocations: true },
        },
      },
    }),
  ]);

  const plan = period?.teamAllocations[0] ?? null;
  const confirmed = plan?.status === TeamBudgetAllocationStatus.CONFIRMED;
  const allocations = new Map((plan?.allocations ?? []).map((allocation) => [allocation.userId, allocation]));
  const totals = roster.map(({ user }) => {
    const transactions = user.budgetAccounts[0]?.transactions ?? [];
    const balance = transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const allocation = allocations.get(user.id);
    return { user, balance, allocation };
  });
  const sumNew = totals.reduce((sum, row) => sum + Number(row.allocation?.amount ?? 0), 0);
  const sumCarry = totals.reduce((sum, row) => sum + Number(confirmed ? row.allocation?.carriedAmount ?? 0 : row.balance), 0);
  const notice = params.error ? messages[params.error] : params.success ? messages[params.success] : undefined;

  return (
    <main className="app-shell">
      <AppHeader firstName={manager.firstName} role={manager.role} />
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">مدیریت اعتبار</p>
            <h1>تخصیص بودجهٔ {team.name}</h1>
            <p className="muted">بودجهٔ ماهانه را گروهی تعیین کنید، برای افراد استثنا بگذارید و پیش از تأیید جمع مبالغ را بررسی کنید.</p>
          </div>
          <span className="count-chip">{roster.length} عضو فعال</span>
        </div>

        {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}

        <section className="panel budget-period-panel" aria-labelledby="budget-period-title">
          <div className="panel-heading">
            <div><p className="eyebrow">دورهٔ ماهانه · میلادی</p><h2 id="budget-period-title">دورهٔ {month}</h2></div>
            {confirmed ? <span className="status-chip status-confirmed">تأیید و قفل‌شده</span> : <span className="status-chip">{plan ? "پیش‌نویس" : "تخصیص ثبت نشده"}</span>}
          </div>
          <form method="get" className="month-picker">
            <label htmlFor="month">انتخاب ماه</label>
            <input id="month" name="month" type="month" defaultValue={month} />
            <button className="button button-secondary" type="submit">نمایش دوره</button>
          </form>
          <div className="budget-summary-grid">
            <div><span>اعتبار جدید در پیش‌نویس</span><strong>${money(sumNew)}</strong></div>
            <div><span>ماندهٔ قبلی قابل استفاده</span><strong>${money(sumCarry)}</strong></div>
            <div><span>موجودی پس از تأیید</span><strong>${money(sumCarry + sumNew)}</strong></div>
          </div>
          <p className="budget-explainer">اعتبار مصرف‌نشده حذف یا دوباره شارژ نمی‌شود؛ در موجودی حساب می‌ماند. ذخیرهٔ پیش‌نویس موجودی را تغییر نمی‌دهد. پس از تأیید، تخصیص همین تیم برای این ماه قابل ویرایش نیست.</p>
        </section>

        {roster.length === 0 ? (
          <section className="panel empty-state"><h2>عضو فعالی وجود ندارد</h2><p>ابتدا اعضای تیم را اضافه کنید.</p></section>
        ) : (
          <section className="panel budget-members-panel" aria-labelledby="budget-members-title">
            <div className="panel-heading">
              <div><p className="eyebrow">تخصیص فردی</p><h2 id="budget-members-title">اعضای تیم</h2></div>
            </div>
            {!confirmed ? (
              <form action={saveBudgetDraftAction}>
                <input type="hidden" name="month" value={month} />
                <label className="budget-default-field">مبلغ پایه برای همهٔ اعضا (دلار)
                  <input name="defaultAmount" type="number" min="0" max="9999999.99" step="0.01" defaultValue={plan?.defaultAmount.toFixed(2) ?? "20.00"} required />
                </label>
                <div className="table-scroll">
                  <table className="data-table budget-table">
                    <thead><tr><th scope="col">عضو</th><th scope="col">نقش</th><th scope="col">ماندهٔ فعلی</th><th scope="col">نوع تخصیص</th><th scope="col">تخصیص فردی (اختیاری)</th></tr></thead>
                    <tbody>
                      {totals.map(({ user, balance, allocation }) => (
                        <tr key={user.id}>
                          <td>{user.firstName} {user.lastName}</td>
                          <td>{user.role === UserRole.MANAGER ? "مدیر" : "کارمند"}</td>
                          <td dir="ltr">${money(balance)}</td>
                          <td>{allocation?.source === AllocationSource.INDIVIDUAL_OVERRIDE ? "استثنا" : "بودجهٔ پایه"}</td>
                          <td>
                            <label className="sr-only" htmlFor={`override-${user.id}`}>مبلغ اختصاصی برای {user.firstName} {user.lastName}</label>
                            <input id={`override-${user.id}`} name={`override_${user.id}`} type="number" min="0" max="9999999.99" step="0.01" placeholder="برابر مبلغ پایه" defaultValue={allocation?.source === AllocationSource.INDIVIDUAL_OVERRIDE ? allocation.amount.toFixed(2) : ""} disabled={confirmed} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!confirmed && <div className="budget-actions"><button className="button button-secondary" type="submit">ذخیرهٔ پیش‌نویس و محاسبه</button></div>}
              </form>
            ) : (
              <div className="table-scroll">
                <table className="data-table budget-table">
                  <thead><tr><th scope="col">عضو</th><th scope="col">نقش</th><th scope="col">ماندهٔ منتقل‌شده</th><th scope="col">اعتبار جدید</th><th scope="col">منبع تخصیص</th></tr></thead>
                  <tbody>{totals.map(({ user, allocation }) => (
                    <tr key={user.id}>
                      <td>{user.firstName} {user.lastName}</td>
                      <td>{user.role === UserRole.MANAGER ? "مدیر" : "کارمند"}</td>
                      <td dir="ltr">${money(allocation?.carriedAmount ?? 0)}</td>
                      <td dir="ltr">${money(allocation?.amount ?? 0)}</td>
                      <td>{allocation?.source === AllocationSource.INDIVIDUAL_OVERRIDE ? "اختصاصی" : "پایهٔ تیم"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {plan && !confirmed && (
              <div className="budget-confirm-box">
                <div><strong>پیش‌نویس آمادهٔ بررسی است</strong><p>جمع اعتبار جدید ${money(sumNew)} است. این مبلغ تا تأیید نهایی به حساب‌ها اضافه نمی‌شود.</p></div>
                <form action={confirmBudgetAllocationAction}>
                  <input type="hidden" name="month" value={month} />
                  <button className="button button-primary" type="submit">تأیید و اعمال تخصیص</button>
                </form>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
