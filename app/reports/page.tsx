import { UserRole } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { getCtoReport, type ReportFilters } from "@/lib/reports/cto-report";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function single(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function dollars(value: { toString(): string }) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value.toString()));
}
function roleName(role: UserRole) { return role === UserRole.MANAGER ? "مدیر" : "کارمند"; }

export default async function CompanyReportsPage({ searchParams }: PageProps) {
  const cto = await requireRole(UserRole.CTO);
  const params = await searchParams;
  const rawMode = single(params.mode);
  const filters: ReportFilters = {
    mode: rawMode === "quarter" || rawMode === "custom" ? rawMode : "month",
    month: single(params.month),
    quarter: single(params.quarter),
    from: single(params.from),
    to: single(params.to),
    teamId: single(params.teamId),
    userId: single(params.userId),
    serviceId: single(params.serviceId),
    auditPage: Number(single(params.auditPage)),
  };
  const report = await getCtoReport(filters);
  const auditHref = (page: number) => {
    const query = new URLSearchParams({ mode: report.mode, month: report.month, quarter: report.quarter, from: report.from, to: report.to, teamId: report.filters.teamId, userId: report.filters.userId, serviceId: report.filters.serviceId, auditPage: String(page) });
    return `/reports?${query.toString()}`;
  };

  return (
    <main className="app-shell">
      <AppHeader firstName={cto.firstName} role={cto.role} />
      <div className="page-content">
        <div className="page-heading"><div><p className="eyebrow">نمای کل شرکت · فقط CTO</p><h1>گزارش هزینه و بودجه</h1><p className="muted">هزینه بر اساس تاریخ شروع ثبت‌شدهٔ پلن گزارش می‌شود؛ تخصیص در بازهٔ تاریخ تأیید، و مانده‌ها به‌صورت snapshot فعلی هستند.</p></div><span className="count-chip">{report.label}</span></div>

        <section className="panel report-filter-panel" aria-labelledby="report-filters-title">
          <div className="panel-heading"><div><p className="eyebrow">فیلتر گزارش</p><h2 id="report-filters-title">بازه و دامنهٔ گزارش</h2></div></div>
          <form method="get" className="form-grid report-filter-grid">
            <label>نوع بازه<select name="mode" defaultValue={report.mode}><option value="month">ماهانه</option><option value="quarter">فصلی</option><option value="custom">بازهٔ دلخواه</option></select></label>
            <label>ماه میلادی<input name="month" type="month" defaultValue={report.month} /></label>
            <label>فصل میلادی<input name="quarter" pattern="[0-9]{4}-Q[1-4]" placeholder="2026-Q3" defaultValue={report.quarter} /></label>
            <label>از تاریخ<input name="from" type="date" defaultValue={report.mode === "custom" ? report.from : ""} /></label>
            <label>تا تاریخ<input name="to" type="date" defaultValue={report.mode === "custom" ? report.to : ""} /></label>
            <label>تیم<select name="teamId" defaultValue={report.filters.teamId}><option value="">همهٔ تیم‌ها</option>{report.teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.status === "INACTIVE" ? " · غیرفعال" : ""}</option>)}</select></label>
            <label>فرد<select name="userId" defaultValue={report.filters.userId}><option value="">همهٔ افراد</option>{report.users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} · {roleName(user.role)}{user.status === "INACTIVE" ? " · غیرفعال" : ""}</option>)}</select></label>
            <label>سرویس<select name="serviceId" defaultValue={report.filters.serviceId}><option value="">همهٔ سرویس‌ها</option>{report.services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.deletedAt ? " · آرشیوشده" : ""}</option>)}</select></label>
            <div className="report-filter-submit"><button className="button button-primary" type="submit">اعمال فیلتر</button></div>
          </form>
        </section>

        <section className="report-metric-grid" aria-label="خلاصهٔ مالی">
          <article className="report-metric-card"><span>ارزش کل خرید</span><strong dir="ltr">{dollars(report.summary.actual)}</strong><small>{report.summary.count} خرید در این بازه</small></article>
          <article className="report-metric-card report-metric-primary"><span>هزینهٔ سهم شرکت</span><strong dir="ltr">{dollars(report.summary.company)}</strong><small>مبنای مصرف بودجه</small></article>
          <article className="report-metric-card"><span>سهم پرداختی کارکنان</span><strong dir="ltr">{dollars(report.summary.employee)}</strong><small>پرداخت خارج از سامانه</small></article>
          <article className="report-metric-card"><span>تخصیص/شارژ در بازه</span><strong dir="ltr">{dollars(report.summary.personalAllocated.plus(report.summary.teamFunding))}</strong><small>شخصی {dollars(report.summary.personalAllocated)} · تیمی {dollars(report.summary.teamFunding)}</small></article>
        </section>

        <section className="report-metric-grid report-balance-grid" aria-label="موجودی و پلن‌ها">
          <article className="report-metric-card"><span>ماندهٔ شخصی فعلی</span><strong dir="ltr">{dollars(report.summary.personalBalance)}</strong><small>از مجموع دفترکل افراد در دامنهٔ فعلی</small></article>
          <article className="report-metric-card"><span>ماندهٔ حساب‌های تیم</span><strong dir="ltr">{dollars(report.summary.teamBalance)}</strong><small>ماندهٔ استفاده‌نشدهٔ حساب‌های تیم</small></article>
          <article className="report-metric-card"><span>پلن‌های فعال</span><strong>{report.summary.activePlans}</strong><small>وضعیت فعلی، مستقل از بازهٔ گزارش</small></article>
          <article className="report-metric-card"><span>پایان در ۳۰ روز آینده</span><strong>{report.summary.expiringPlans}</strong><small>بر اساس تاریخ پایان پلن فعال</small></article>
        </section>
        <section className={`report-reconciliation ${report.reconciliation.isReconciled ? "is-reconciled" : "has-discrepancy"}`} role="status" aria-label="تطبیق دفترکل خرید">
          <div><strong>{report.reconciliation.isReconciled ? "تطبیق دفترکل موفق بود" : "اختلاف بین خریدها و دفترکل پیدا شد"}</strong><p>مبنای مورد انتظار {dollars(report.reconciliation.expectedDebit)} · ثبت‌شده در دفترکل {dollars(report.reconciliation.actualDebit)} · اختلاف {dollars(report.reconciliation.difference)}</p></div>
          {!report.reconciliation.isReconciled && <small>کسری {report.reconciliation.missingPurchaseIds.length} · مبلغ نامنطبق {report.reconciliation.mismatchedPurchaseIds.length} · تکراری {report.reconciliation.duplicatePurchaseIds.length} · بدون خرید مرتبط {report.reconciliation.unexpectedDebitIds.length}</small>}
        </section>
        <p className="report-scope-note">ماندهٔ کل {dollars(report.summary.totalBalance)}، snapshot امروز است و نه ماندهٔ پایان بازه. {report.scope.serviceFiltered ? "فیلتر سرویس بر تخصیص و مانده اثر ندارد، چون بودجه به سرویس خاصی متصل نیست." : "ماندهٔ فعلی با فیلترهای تیم و فرد محدود می‌شود."}</p>

        <section className="panel report-panel" aria-labelledby="purchase-type-title">
          <div className="panel-heading"><div><p className="eyebrow">ترکیب خرید</p><h2 id="purchase-type-title">شخصی در برابر غیرشخصی</h2></div></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>نوع</th><th>تعداد</th><th>ارزش کل خرید</th><th>هزینهٔ سهم شرکت</th><th>سهم کارمند</th></tr></thead><tbody>
            <tr><td>شخصی</td><td>{report.summary.personalCount}</td><td dir="ltr">{dollars(report.summary.personalActual)}</td><td dir="ltr">{dollars(report.summary.personalCompany)}</td><td dir="ltr">{dollars(report.summary.personalEmployee)}</td></tr>
            <tr><td>غیرشخصی تیم</td><td>{report.summary.sharedCount}</td><td dir="ltr">{dollars(report.summary.sharedActual)}</td><td dir="ltr">{dollars(report.summary.sharedCompany)}</td><td dir="ltr">{dollars(0)}</td></tr>
          </tbody></table></div>
        </section>

        <div className="report-table-grid">
          <section className="panel report-panel" aria-labelledby="team-cost-title">
            <div className="panel-heading"><div><p className="eyebrow">مقایسهٔ تیم‌ها</p><h2 id="team-cost-title">هزینه به تفکیک تیم</h2></div></div>
            {report.byTeam.length === 0 ? <p className="report-empty">در این بازه خریدی ثبت نشده است.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>تیم</th><th>تعداد</th><th>ارزش خرید</th><th>سهم شرکت</th></tr></thead><tbody>{report.byTeam.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td><td dir="ltr">{dollars(row.actual)}</td><td dir="ltr">{dollars(row.company)}</td></tr>)}</tbody></table></div>}
          </section>

          <section className="panel report-panel" aria-labelledby="service-cost-title">
            <div className="panel-heading"><div><p className="eyebrow">سرویس‌ها و agentها</p><h2 id="service-cost-title">هزینه به تفکیک سرویس</h2></div></div>
            {report.byService.length === 0 ? <p className="report-empty">در این بازه خریدی ثبت نشده است.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>سرویس</th><th>تعداد</th><th>ارزش خرید</th><th>سهم شرکت</th></tr></thead><tbody>{report.byService.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td><td dir="ltr">{dollars(row.actual)}</td><td dir="ltr">{dollars(row.company)}</td></tr>)}</tbody></table></div>}
          </section>
        </div>

        <section className="panel report-panel" aria-labelledby="person-cost-title">
          <div className="panel-heading"><div><p className="eyebrow">خریدهای شخصی</p><h2 id="person-cost-title">هزینه به تفکیک فرد</h2></div></div>
          {report.byUser.length === 0 ? <p className="report-empty">خرید شخصی‌ای در این بازه و فیلترها ثبت نشده است.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>فرد</th><th>تعداد</th><th>ارزش خرید</th><th>سهم شرکت</th><th>سهم کارمند</th></tr></thead><tbody>{report.byUser.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td><td dir="ltr">{dollars(row.actual)}</td><td dir="ltr">{dollars(row.company)}</td><td dir="ltr">{dollars(row.employee)}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="panel report-panel" aria-labelledby="account-balances-title">
          <div className="panel-heading"><div><p className="eyebrow">وضعیت فعلی دفترکل</p><h2 id="account-balances-title">ماندهٔ حساب‌ها</h2></div><span className="count-chip">{report.balances.length} حساب</span></div>
          {report.balances.length === 0 ? <p className="report-empty">حسابی در دامنهٔ انتخاب‌شده وجود ندارد.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>نوع حساب</th><th>دارنده</th><th>تیم</th><th>ماندهٔ فعلی</th></tr></thead><tbody>{report.balances.map((account) => <tr key={account.id}><td>{account.ownerType === "TEAM" ? "تیمی" : "شخصی"}</td><td>{account.name}</td><td>{account.teamName}</td><td dir="ltr">{dollars(account.balance)}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="panel report-panel" aria-labelledby="audit-title">
          <div className="panel-heading"><div><p className="eyebrow">ردیابی تغییرات · حداکثر ۵۰ مورد</p><h2 id="audit-title">Audit log</h2></div></div>
          <p className="report-audit-note">گزارش رخدادها بر اساس بازه و فیلتر فرد است؛ فیلتر تیم و سرویس روی audit log اعمال نمی‌شود.</p>
          {report.auditLogs.length === 0 ? <p className="report-empty">رخدادی برای این بازه پیدا نشد.</p> : <><div className="table-scroll"><table className="data-table"><thead><tr><th>زمان (UTC)</th><th>انجام‌دهنده</th><th>عمل</th><th>نوع رکورد</th><th>شناسه</th><th>جزئیات</th></tr></thead><tbody>{report.auditLogs.map((log) => <tr key={log.id}><td dir="ltr">{log.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td><td>{log.actor.firstName} {log.actor.lastName}</td><td dir="ltr">{log.action}</td><td dir="ltr">{log.entityType}</td><td dir="ltr">{log.entityId.slice(0, 8)}</td><td><details><summary>نمایش</summary><code className="report-audit-metadata">{JSON.stringify(log.metadata) ?? "—"}</code></details></td></tr>)}</tbody></table></div><div className="report-pagination" aria-label="صفحه‌بندی audit log">{report.auditPage > 0 ? <a className="button button-secondary" href={auditHref(report.auditPage - 1)}>رخدادهای جدیدتر</a> : <span />}{report.auditPages > 1 && <span>صفحهٔ {report.auditPage + 1} از {report.auditPages}</span>}{report.auditPage + 1 < report.auditPages && <a className="button button-secondary" href={auditHref(report.auditPage + 1)}>رخدادهای قدیمی‌تر</a>}</div></>}
        </section>
      </div>
    </main>
  );
}
