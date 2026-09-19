import { PlanStatus, RenewalRequestStatus, RenewalStatus, TeamStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { acknowledgeNonRenewalAction, markPlanExpiredAction, registerRenewalPurchaseAction } from "@/app/team/renewals/actions";

type PageProps = { searchParams: Promise<{ error?: string; success?: string }> };

const messages: Record<string, { text: string; kind: "error" | "success" }> = {
  "invalid-renewal-request": { text: "درخواست یا پلن انتخابی معتبر نیست.", kind: "error" },
  "renewal-request-not-pending": { text: "این درخواست قبلاً بررسی شده یا دیگر در انتظار بررسی نیست.", kind: "error" },
  "invalid-renewal-purchase": { text: "مبلغ تمدید باید معتبر و بیشتر از صفر باشد.", kind: "error" },
  "insufficient-renewal-funds": { text: "موجودی حساب تیم برای این تمدید کافی نیست.", kind: "error" },
  "renewal-not-available": { text: "این پلن قابل تمدید نیست؛ وضعیت یا درخواست عدم تمدید را بررسی کنید.", kind: "error" },
  "concurrent-update": { text: "تغییر هم‌زمانی رخ داد؛ صفحه را تازه و وضعیت را دوباره بررسی کنید.", kind: "error" },
  "plan-not-expired": { text: "فقط پلن فعالی را می‌توان منقضی ثبت کرد که تاریخ پایانش قبل از امروز باشد.", kind: "error" },
  "non-renewal-acknowledged": { text: "درخواست عدم تمدید ثبت و وضعیت پلن به‌روزرسانی شد.", kind: "success" },
  "renewal-purchased": { text: "تمدید به‌عنوان خرید جدید ثبت و موجودی مربوطه کسر شد.", kind: "success" },
  "plan-expired": { text: "پلن منقضی ثبت شد و در تاریخچه باقی می‌ماند.", kind: "success" },
};

const renewalNames: Record<RenewalStatus, string> = {
  AUTO: "تمدید خودکار", MANUAL: "تمدید دستی", NOT_RENEWING: "عدم تمدید", NOT_APPLICABLE: "تعیین‌نشده",
};

function dollars(value: { toString(): string }) { return Number(value.toString()).toFixed(2); }
function formatDate(value: Date) { return value.toISOString().slice(0, 10); }

export default async function TeamRenewalsPage({ searchParams }: PageProps) {
  const manager = await requireRole(UserRole.MANAGER);
  const params = await searchParams;
  const team = await prisma.team.findFirst({ where: { managerId: manager.id, status: TeamStatus.ACTIVE, deletedAt: null }, select: { id: true, name: true } });
  if (!team) redirect("/unauthorized");
  const purchases = await prisma.purchase.findMany({
      where: { teamId: team.id },
      include: {
        service: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        renewedFrom: { select: { id: true } },
        renewedInto: { select: { id: true } },
        renewalRequests: { where: { status: RenewalRequestStatus.SUBMITTED }, include: { requester: { select: { firstName: true, lastName: true } } }, take: 1 },
      },
      orderBy: [{ endDate: "asc" }, { createdAt: "desc" }], take: 100,
    });
  const today = new Date().toISOString().slice(0, 10);
  const notice = params.error ? messages[params.error] : params.success ? messages[params.success] : undefined;

  return (
    <main className="app-shell">
      <AppHeader firstName={manager.firstName} role={manager.role} />
      <div className="page-content">
        <div className="page-heading"><div><p className="eyebrow">چرخهٔ پلن‌ها</p><h1>تمدید و انقضای {team.name}</h1><p className="muted">درخواست عدم تمدید را بررسی کنید، تمدید را به‌شکل خرید جدید ثبت کنید یا پلن پایان‌یافته را منقضی علامت بزنید.</p></div><span className="count-chip">{purchases.filter((item) => item.planStatus === PlanStatus.ACTIVE).length} پلن فعال</span></div>
        {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
        {purchases.length === 0 ? <section className="panel empty-state"><h2>پلنی ثبت نشده است</h2><p>پس از ثبت خریدهای تیم، تاریخ و وضعیت پلن‌ها در این بخش مدیریت می‌شوند.</p></section> : (
          <section className="renewal-list" aria-label="پلن‌های تیم">
            {purchases.map((purchase) => {
              const request = purchase.renewalRequests[0];
              const isActive = purchase.planStatus === PlanStatus.ACTIVE;
              const isExpiredByDate = Boolean(purchase.endDate && formatDate(purchase.endDate) < today);
              const renewalAllowed = isActive && Boolean(purchase.endDate) && !isExpiredByDate && !request && !purchase.renewedInto && purchase.renewalStatus !== RenewalStatus.NOT_RENEWING;
              return <article className="panel renewal-card" key={purchase.id}>
                <div className="panel-heading"><div><p className="eyebrow">{purchase.user ? `${purchase.user.firstName} ${purchase.user.lastName}` : "خرید غیرشخصی تیم"}</p><h2>{purchase.service.name}</h2></div><span className={`status-chip ${purchase.planStatus === PlanStatus.ACTIVE ? "status-confirmed" : ""}`}>{purchase.planStatus === PlanStatus.ACTIVE ? "فعال" : purchase.planStatus === PlanStatus.RENEWED ? "تمدیدشده" : "منقضی"}</span></div>
                <dl className="request-facts">
                  <div><dt>شروع</dt><dd dir="ltr">{formatDate(purchase.startDate)}</dd></div>
                  <div><dt>پایان</dt><dd dir="ltr">{purchase.endDate ? formatDate(purchase.endDate) : "ثبت نشده"}</dd></div>
                  <div><dt>تمدید فعلی</dt><dd>{renewalNames[purchase.renewalStatus]}</dd></div>
                  <div><dt>هزینهٔ پلن</dt><dd dir="ltr">${dollars(purchase.actualAmount)}</dd></div>
                  {purchase.renewedFrom && <div><dt>سابقه</dt><dd>این پلن تمدید پلن قبلی است</dd></div>}
                  {purchase.renewedInto && <div><dt>سابقه</dt><dd>برای این پلن، تمدید جدید ثبت شده است</dd></div>}
                </dl>
                {request && <div className="renewal-request-box"><div><strong>درخواست عدم تمدید · {request.requester.firstName} {request.requester.lastName}</strong><p>{request.note || "دلیلی ثبت نشده است."}</p></div><form action={acknowledgeNonRenewalAction}><input type="hidden" name="requestId" value={request.id} /><button className="button button-primary" type="submit">تأیید عدم تمدید</button></form></div>}
                {isActive && isExpiredByDate && <form action={markPlanExpiredAction} className="renewal-action-form"><input type="hidden" name="purchaseId" value={purchase.id} /><p>تاریخ پایان رسیده است؛ وضعیت انقضا را در سامانه ثبت کنید.</p><button className="button button-secondary" type="submit">ثبت وضعیت Expired</button></form>}
                {renewalAllowed && <details className="renewal-details"><summary>ثبت تمدید به‌عنوان خرید جدید</summary><form action={registerRenewalPurchaseAction} className="renewal-form form-grid">
                  <input type="hidden" name="purchaseId" value={purchase.id} />
                  <label>مبلغ واقعی تمدید (دلار)<input name="actualAmount" type="number" min="0.01" max="9999999.99" step="0.01" defaultValue={purchase.actualAmount.toFixed(2)} required /></label>
                  <label>وضعیت تمدید بعدی<select name="renewalStatus" defaultValue={RenewalStatus.MANUAL}>{Object.values(RenewalStatus).map((status) => <option key={status} value={status}>{renewalNames[status]}</option>)}</select></label>
                  <label className="field-wide">توضیح اختیاری<input name="note" maxLength={500} placeholder="یادداشت خرید تمدید" /></label>
                  <p className="request-form-hint field-wide">خرید جدید از روز پایان پلن فعلی شروع می‌شود. سهم شرکت از موجودی شخصی یا حساب تیم محاسبه خواهد شد.</p>
                  <div className="field-wide"><button className="button button-primary" type="submit">ثبت تمدید و خرید</button></div>
                </form></details>}
                {isActive && request && <p className="request-form-hint">تا تعیین تکلیف درخواست عدم تمدید، ثبت تمدید جدید غیرفعال است.</p>}
                {isActive && purchase.renewalStatus === RenewalStatus.NOT_RENEWING && !request && <p className="request-form-hint">این پلن با تصمیم مدیر تمدید نمی‌شود؛ پس از تاریخ پایان، وضعیت Expired را ثبت کنید.</p>}
              </article>;
            })}
          </section>
        )}
      </div>
    </main>
  );
}
