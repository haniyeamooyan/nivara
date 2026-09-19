import { BudgetTransactionType, RenewalStatus, TeamStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { addTeamFundsAction, registerTeamPurchaseAction } from "@/app/team/shared-budget/actions";

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

const notices: Record<string, { text: string; kind: "error" | "success" }> = {
  "invalid-funding": { text: "مبلغ شارژ یا توضیح معتبر نیست.", kind: "error" },
  "invalid-purchase": { text: "اطلاعات خرید معتبر نیست؛ مبلغ و تاریخ‌ها را بررسی کنید.", kind: "error" },
  "service-unavailable": { text: "سرویس انتخاب‌شده فعال نیست. فهرست سرویس‌ها را تازه‌سازی کنید.", kind: "error" },
  "insufficient-funds": { text: "موجودی حساب تیم برای این خرید کافی نیست. ابتدا شارژ تیم را ثبت کنید.", kind: "error" },
  "concurrent-update": { text: "هم‌زمانی یک تغییر دیگر مانع ثبت امن شد. صفحه را تازه کنید و دوباره تلاش کنید.", kind: "error" },
  "funds-added": { text: "شارژ به موجودی تیم اضافه شد؛ این مانده به دورهٔ بعد منتقل می‌شود.", kind: "success" },
  "purchase-registered": { text: "خرید تیمی ثبت شد و از موجودی تیم کسر شد.", kind: "success" },
};

function money(value: { toString(): string } | number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value.toString()));
}

function date(value: Date) {
  return value.toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "UTC" });
}

const renewalNames: Record<RenewalStatus, string> = {
  AUTO: "تمدید خودکار",
  MANUAL: "تمدید دستی",
  NOT_RENEWING: "تمدید نمی‌شود",
  NOT_APPLICABLE: "ثبت نشده",
};

export default async function SharedTeamBudgetPage({ searchParams }: PageProps) {
  const manager = await requireRole(UserRole.MANAGER);
  const params = await searchParams;
  const team = await prisma.team.findFirst({
    where: { managerId: manager.id, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true, accounts: { take: 1, select: { id: true } } },
  });
  if (!team) redirect("/unauthorized");

  const accountId = team.accounts[0]?.id;
  const [services, transactions, purchases, balance] = await Promise.all([
    prisma.service.findMany({ where: { status: "ACTIVE", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, category: true } }),
    accountId ? prisma.budgetTransaction.findMany({ where: { accountId }, include: { creator: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 30 }) : Promise.resolve([]),
    prisma.purchase.findMany({
      where: { teamId: team.id, userId: null, requestId: null },
      include: { service: { select: { name: true } }, buyer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" }, take: 30,
    }),
    accountId ? prisma.budgetTransaction.aggregate({ where: { accountId }, _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: null } }),
  ]);
  const amountAvailable = balance._sum.amount ?? 0;
  const notice = params.error ? notices[params.error] : params.success ? notices[params.success] : undefined;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="app-shell">
      <AppHeader firstName={manager.firstName} role={manager.role} />
      <div className="page-content">
        <div className="page-heading">
          <div><p className="eyebrow">حساب مستقل از اعتبار اشخاص</p><h1>خریدهای تیمی · {team.name}</h1><p className="muted">مدیر، دریافتی واقعی تیم را دستی ثبت می‌کند؛ موجودی خرج‌نشده با دفترکل باقی می‌ماند و به ماه بعد منتقل می‌شود.</p></div>
        </div>
        {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}

        <section className="panel shared-balance-card" aria-label="موجودی حساب تیم">
          <div><p className="eyebrow">ماندهٔ قابل استفاده</p><h2 dir="ltr">${money(amountAvailable)}</h2><p>خرید فقط تا سقف همین موجودی ثبت می‌شود. شارژ و خرید در سابقهٔ تیم باقی می‌مانند.</p></div>
          <span className="count-chip">{transactions.length} تراکنش اخیر</span>
        </section>

        <div className="shared-budget-grid">
          <section className="panel" aria-labelledby="team-fund-title">
            <div className="panel-heading"><div><p className="eyebrow">ثبت دریافتی تیم</p><h2 id="team-fund-title">شارژ دستی موجودی</h2></div></div>
            <p className="panel-description">این فرم فقط مبلغی را ثبت می‌کند که بودجه‌اش خارج از سامانه به مدیر رسیده است؛ به اعتبار شخصی اعضا اضافه نمی‌شود.</p>
            <form action={addTeamFundsAction} className="form-grid">
              <label>مبلغ شارژ (دلار)<input name="amount" type="number" min="0.01" max="9999999.99" step="0.01" required /></label>
              <label className="field-wide">توضیح / مرجع دریافت<input name="note" minLength={3} maxLength={500} required placeholder="مثلاً بودجهٔ سرویس‌های تیم در مهر" /></label>
              <div className="field-wide"><button className="button button-primary" type="submit">ثبت شارژ تیم</button></div>
            </form>
          </section>

          <section className="panel" aria-labelledby="team-purchase-title">
            <div className="panel-heading"><div><p className="eyebrow">هزینه از حساب تیم</p><h2 id="team-purchase-title">ثبت خرید غیرشخصی</h2></div></div>
            {services.length === 0 ? <p className="panel-description">سرویس فعالی برای خرید وجود ندارد. ابتدا از کاتالوگ سرویس‌ها یک سرویس فعال اضافه کنید.</p> : (
              <form action={registerTeamPurchaseAction} className="form-grid">
                <label>سرویس<select name="serviceId" required defaultValue=""><option value="" disabled>انتخاب سرویس</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.category ? ` · ${service.category}` : ""}</option>)}</select></label>
                <label>مبلغ واقعی (دلار)<input name="actualAmount" type="number" min="0.01" max="9999999.99" step="0.01" required /></label>
                <label>تاریخ خرید / شروع<input name="startDate" type="date" defaultValue={today} required /></label>
                <label>تاریخ پایان (اختیاری)<input name="endDate" type="date" /></label>
                <label>وضعیت تمدید<select name="renewalStatus" defaultValue={RenewalStatus.NOT_APPLICABLE}>{Object.values(RenewalStatus).map((status) => <option key={status} value={status}>{renewalNames[status]}</option>)}</select></label>
                <label className="field-wide">توضیح<input name="note" minLength={3} maxLength={500} required placeholder="کاربرد سرویس برای تیم" /></label>
                <div className="field-wide"><button className="button button-primary" type="submit">ثبت خرید و کسر از موجودی</button></div>
              </form>
            )}
          </section>
        </div>

        <section className="panel shared-history-panel" aria-labelledby="team-ledger-title">
          <div className="panel-heading"><div><p className="eyebrow">مانده از جمع تراکنش‌ها محاسبه می‌شود</p><h2 id="team-ledger-title">گردش حساب تیم</h2></div></div>
          {transactions.length === 0 ? <p className="panel-description">هنوز شارژ یا هزینه‌ای برای حساب تیم ثبت نشده است.</p> : (
            <div className="table-scroll"><table className="data-table"><thead><tr><th>تاریخ</th><th>نوع</th><th>توضیح</th><th>ثبت‌کننده</th><th>مبلغ</th></tr></thead><tbody>
              {transactions.map((transaction) => <tr key={transaction.id}>
                <td>{date(transaction.createdAt)}</td>
                <td>{transaction.type === BudgetTransactionType.ALLOCATION ? "شارژ تیم" : transaction.type === BudgetTransactionType.PURCHASE_DEBIT ? "هزینهٔ خرید" : transaction.type === BudgetTransactionType.CARRY_OVER ? "انتقال مانده" : "اصلاح موجودی"}</td>
                <td>{transaction.description ?? "—"}</td>
                <td>{transaction.creator.firstName} {transaction.creator.lastName}</td>
                <td className={transaction.amount.lt(0) ? "amount-negative" : "amount-positive"} dir="ltr">{transaction.amount.lt(0) ? "−" : "+"}${money(transaction.amount.abs())}</td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>

        <section className="panel shared-history-panel" aria-labelledby="team-purchase-history-title">
          <div className="panel-heading"><div><p className="eyebrow">غیرشخصی · بدون انتساب به کارمند</p><h2 id="team-purchase-history-title">تاریخچهٔ خریدهای تیم</h2></div></div>
          {purchases.length === 0 ? <p className="panel-description">خرید تیمی‌ای ثبت نشده است.</p> : (
            <div className="table-scroll"><table className="data-table"><thead><tr><th>سرویس</th><th>تاریخ خرید</th><th>پایان پلن</th><th>تمدید</th><th>ثبت‌کننده</th><th>هزینه</th><th>توضیح</th></tr></thead><tbody>
              {purchases.map((purchase) => <tr key={purchase.id}>
                <td>{purchase.service.name}</td><td>{date(purchase.startDate)}</td><td>{purchase.endDate ? date(purchase.endDate) : "—"}</td><td>{renewalNames[purchase.renewalStatus]}</td>
                <td>{purchase.buyer.firstName} {purchase.buyer.lastName}</td><td dir="ltr">${money(purchase.actualAmount)}</td><td>{purchase.note}</td>
              </tr>)}
            </tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
}
