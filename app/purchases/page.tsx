import { PlanStatus, PurchaseRequestStatus, RenewalRequestStatus, RenewalStatus, ServiceStatus, TeamStatus, UserRole, UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasRequestableBalance } from "@/lib/budgets/calculations";
import { cancelPurchaseRequestAction, createDirectPersonalPurchaseAction, createPurchaseRequestAction, editPurchaseRequestAction } from "@/app/purchases/actions";
import { cancelNonRenewalAction, requestNonRenewalAction } from "@/app/team/renewals/actions";

type PurchasesPageProps = { searchParams: Promise<{ error?: string; success?: string }> };

const errors: Record<string, string> = {
  "no-team": "برای ثبت درخواست باید عضو یک تیم فعال باشید.",
  "budget-required": "برای ثبت یا ارسال دوبارهٔ درخواست، موجودی شما باید بیشتر از صفر باشد. از مدیر تیمتان بخواهید بودجه تخصیص دهد.",
  "invalid-request": "سرویس و مبلغ ماهانه را بررسی کنید؛ مبلغ باید بیشتر از صفر و حداکثر دو رقم اعشار باشد.",
  "invalid-purchase": "سرویس، مبلغ و تاریخ شروع خرید را بررسی کنید.",
  "concurrent-update": "موجودی هم‌زمان تغییر کرد؛ صفحه را تازه کنید و دوباره ثبت کنید.",
  "service-unavailable": "سرویس انتخاب‌شده فعال نیست؛ یک سرویس فعال انتخاب کنید.",
  "request-not-editable": "فقط درخواست ردشده یا لغوشده قابل ویرایش و ارسال مجدد است.",
  "request-not-cancellable": "این درخواست دیگر در وضعیت قابل لغو نیست.",
  "invalid-renewal-request": "پلن انتخابی برای درخواست عدم تمدید معتبر نیست.",
  "renewal-request-exists": "برای این پلن یک درخواست عدم تمدید در حال بررسی است یا پلن فعال نیست.",
  "renewal-request-not-cancellable": "درخواست عدم تمدید دیگر قابل لغو نیست.",
};

const successes: Record<string, string> = {
  "request-submitted": "درخواست ثبت شد و هنوز هیچ اعتباری از موجودی کم نشده است.",
  "request-resubmitted": "درخواست ویرایش و برای بررسی مدیر دوباره ارسال شد.",
  "request-cancelled": "درخواست لغو شد؛ موجودی شما تغییری نکرد.",
  "personal-purchase-registered": "خرید شخصی ثبت و سهم اعتبار از موجودی شما کسر شد.",
  "renewal-request-submitted": "درخواست عدم تمدید به مدیر ارسال شد؛ خود سرویس را باید در وب‌سایت ارائه‌دهنده لغو کنید.",
  "renewal-request-cancelled": "درخواست عدم تمدید لغو شد.",
};

const statusNames: Record<PurchaseRequestStatus, string> = {
  SUBMITTED: "در انتظار بررسی مدیر",
  PURCHASED: "خرید ثبت‌شده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
};

function dollars(value: { toString(): string }) {
  return Number(value.toString()).toFixed(2);
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const user = await requireRole(UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.SUPER_ADMIN);
  const params = await searchParams;
  if (user.role === UserRole.MANAGER || user.role === UserRole.SUPER_ADMIN) {
    const [services, account, purchases] = await Promise.all([
      prisma.service.findMany({ where: { status: ServiceStatus.ACTIVE, deletedAt: null }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
      prisma.budgetAccount.findUnique({ where: { userId: user.id }, include: { transactions: { select: { amount: true } } } }),
      prisma.purchase.findMany({ where: { userId: user.id }, include: { service: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    const balance = account?.transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0) ?? 0;
    return (
      <main className="app-shell">
        <AppHeader firstName={user.firstName} role={user.role} />
        <div className="page-content">
          <div className="page-heading"><div><p className="eyebrow">خرید مستقیم شخصی</p><h1>خریدهای من</h1><p className="muted">خرید شما مستقیماً ثبت می‌شود و نیازی به بررسی مدیر ندارد.</p></div><span className="count-chip">اعتبار قابل استفاده: ${balance.toFixed(2)}</span></div>
          {params.error && <p className="notice notice-error" role="alert">{errors[params.error] ?? "عملیات انجام نشد؛ اطلاعات را بررسی کنید."}</p>}
          {params.success && <p className="notice notice-success" role="status">{successes[params.success] ?? "تغییرات ذخیره شد."}</p>}
          <section className="panel request-create-panel" aria-labelledby="direct-purchase-title">
            <div className="panel-heading"><div><p className="eyebrow">ثبت نهایی</p><h2 id="direct-purchase-title">خرید اکانت یا سرویس برای خودم</h2></div></div>
            {services.length === 0 ? <div className="empty-state"><p>فعلاً سرویس فعالی برای خرید وجود ندارد.</p></div> : <form action={createDirectPersonalPurchaseAction} className="request-form">
              <label>سرویس<select name="serviceId" required defaultValue=""><option value="" disabled>انتخاب سرویس</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.category ? ` · ${service.category}` : ""}</option>)}</select></label>
              <label>مبلغ واقعی خرید (دلار)<input name="actualAmount" type="number" min="0.01" max="9999999.99" step="0.01" required /></label>
              <label>تاریخ شروع پلن<input name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
              <label>وضعیت تمدید<select name="renewalStatus" defaultValue={RenewalStatus.MANUAL}>{Object.values(RenewalStatus).map((status) => <option key={status} value={status}>{status === RenewalStatus.AUTO ? "خودکار" : status === RenewalStatus.MANUAL ? "دستی" : status === RenewalStatus.NOT_RENEWING ? "عدم تمدید" : "تعیین‌نشده"}</option>)}</select></label>
              <label className="request-note-field">یادداشت <span className="optional-label">اختیاری</span><textarea name="note" rows={2} maxLength={500} /></label>
              <p className="request-form-hint">تا سقف موجودی از اعتبار شما کسر می‌شود؛ مبلغ بیشتر از موجودی به‌عنوان سهم پرداختی شخصی ثبت خواهد شد.</p>
              <button className="button button-primary" type="submit">ثبت خرید</button>
            </form>}
          </section>
          <section className="panel request-list-panel" aria-labelledby="direct-history-title">
            <div className="panel-heading"><div><p className="eyebrow">تاریخچهٔ شخصی</p><h2 id="direct-history-title">خریدهای ثبت‌شده</h2></div><span className="count-chip">{purchases.length} مورد</span></div>
            {purchases.length === 0 ? <div className="empty-state"><p>هنوز خرید شخصی‌ای ثبت نشده است.</p></div> : <div className="request-list">{purchases.map((purchase) => <article className="request-card" key={purchase.id}><div className="request-card-heading"><h3>{purchase.service.name}</h3><time>{purchase.startDate.toISOString().slice(0, 10)}</time></div><dl className="request-facts"><div><dt>مبلغ خرید</dt><dd dir="ltr">${dollars(purchase.actualAmount)}</dd></div><div><dt>سهم اعتبار</dt><dd dir="ltr">${dollars(purchase.companyAmount)}</dd></div><div><dt>سهم پرداختی شخصی</dt><dd dir="ltr">${dollars(purchase.employeeContribution)}</dd></div><div><dt>پایان پلن</dt><dd dir="ltr">{purchase.endDate?.toISOString().slice(0, 10) ?? "—"}</dd></div></dl></article>)}</div>}
          </section>
        </div>
      </main>
    );
  }
  const membership = await prisma.teamMembership.findFirst({
    where: { userId: user.id, leftAt: null, team: { status: TeamStatus.ACTIVE, deletedAt: null }, user: { status: UserStatus.ACTIVE, deletedAt: null } },
    select: { team: { select: { id: true, name: true } } },
  });
  if (!membership) redirect("/unauthorized");

  const [services, requests, activePurchases, personalBalance] = await Promise.all([
    prisma.service.findMany({
      where: { status: ServiceStatus.ACTIVE, deletedAt: null },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseRequest.findMany({
      where: { requesterId: user.id, teamId: membership.team.id },
      include: { service: { select: { name: true } }, purchase: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchase.findMany({
      where: { userId: user.id, teamId: membership.team.id, planStatus: PlanStatus.ACTIVE },
      include: { service: { select: { name: true } }, renewalRequests: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.budgetTransaction.aggregate({ where: { account: { userId: user.id } }, _sum: { amount: true } }).then((result) => result._sum.amount ?? 0),
  ]);
  const hasSpendableBalance = hasRequestableBalance(Number(personalBalance.toString()));

  return (
    <main className="app-shell">
      <AppHeader firstName={user.firstName} role={user.role} />
      <div className="page-content">
        <div className="page-heading">
          <div><p className="eyebrow">درخواست شخصی</p><h1>خریدهای من</h1><p className="muted">درخواست را اینجا ثبت کنید؛ مدیر تیم آن را بررسی و خرید را ثبت می‌کند.</p></div>
          <span className="count-chip">{membership.team.name}</span>
        </div>
        <section className="panel employee-balance-card" aria-label="اعتبار شخصی"><div><p className="eyebrow">اعتبار قابل استفاده</p><h2>موجودی فعلی</h2></div><strong dir="ltr">${Number(personalBalance.toString()).toFixed(2)}</strong><p>برای ثبت درخواست، موجودی باید بیشتر از صفر باشد. ثبت درخواست اعتبار را رزرو یا کم نمی‌کند.</p></section>
        {params.error && <p className="notice notice-error" role="alert">{errors[params.error] ?? "عملیات انجام نشد؛ اطلاعات را بررسی کنید."}</p>}
        {params.success && <p className="notice notice-success" role="status">{successes[params.success] ?? "تغییرات ذخیره شد."}</p>}

        <section className="panel request-create-panel" aria-labelledby="request-create-title">
          <div className="panel-heading"><div><p className="eyebrow">ثبت درخواست</p><h2 id="request-create-title">درخواست حساب یا سرویس جدید</h2></div></div>
          {!hasSpendableBalance ? <div className="empty-state"><p>برای ثبت درخواست موجودی ندارید. از مدیر تیم بخواهید ابتدا برایتان بودجه تخصیص دهد.</p></div> : services.length === 0 ? <div className="empty-state"><p>فعلاً سرویس فعالی برای درخواست وجود ندارد.</p></div> : (
            <form action={createPurchaseRequestAction} className="request-form">
              <label>سرویس
                <select name="serviceId" required defaultValue="">
                  <option value="" disabled>انتخاب سرویس</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.category ? ` · ${service.category}` : ""}</option>)}
                </select>
              </label>
              <label>هزینهٔ ماهانهٔ تقریبی (دلار)
                <input name="requestedAmount" type="number" min="0.01" max="9999999.99" step="0.01" placeholder="مثلاً 20.00" required />
              </label>
              <label className="request-note-field">توضیح نیاز <span className="optional-label">اختیاری</span>
                <textarea name="note" rows={3} maxLength={500} placeholder="برای چه کاری به این سرویس نیاز دارید؟" />
              </label>
              <p className="request-form-hint">ثبت درخواست موجودی را رزرو یا کم نمی‌کند. مبلغ واقعی و سهم پرداختی شما پس از خرید مشخص می‌شود.</p>
              <button className="button button-primary" type="submit">ارسال برای مدیر</button>
            </form>
          )}
        </section>

        <section className="panel request-list-panel" aria-labelledby="my-requests-title">
          <div className="panel-heading"><div><p className="eyebrow">تاریخچه</p><h2 id="my-requests-title">درخواست‌ها و خریدها</h2></div><span className="count-chip">{requests.length} مورد</span></div>
          {requests.length === 0 ? <div className="empty-state"><h3>درخواستی ثبت نشده</h3><p>فرم بالا را برای ثبت اولین درخواست استفاده کنید.</p></div> : (
            <div className="request-list">
              {requests.map((request) => {
                const editable = request.status === PurchaseRequestStatus.REJECTED || request.status === PurchaseRequestStatus.CANCELLED;
                return (
                  <article className="request-card" key={request.id}>
                    <div className="request-card-heading">
                      <div><span className={`status-chip request-status request-status-${request.status.toLowerCase()}`}>{statusNames[request.status]}</span><h3>{request.service.name}</h3></div>
                      <time dateTime={request.createdAt.toISOString()}>{request.createdAt.toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "UTC" })}</time>
                    </div>
                    <dl className="request-facts"><div><dt>هزینهٔ ماهانهٔ درخواستی</dt><dd dir="ltr">${dollars(request.requestedAmount)}</dd></div></dl>
                    {request.note && <p className="request-note">{request.note}</p>}
                    {request.rejectionReason && <p className="notice notice-error request-reason"><strong>دلیل رد:</strong> {request.rejectionReason}</p>}
                    {request.purchase && (
                      <dl className="request-facts purchase-facts">
                        <div><dt>مبلغ واقعی خرید</dt><dd dir="ltr">${dollars(request.purchase.actualAmount)}</dd></div>
                        <div><dt>سهم اعتبار شرکت</dt><dd dir="ltr">${dollars(request.purchase.companyAmount)}</dd></div>
                        <div><dt>سهم پرداختی شما</dt><dd dir="ltr">${dollars(request.purchase.employeeContribution)}</dd></div>
                        <div><dt>پایان پلن یک‌ماهه</dt><dd dir="ltr">{request.purchase.endDate?.toISOString().slice(0, 10) ?? "—"}</dd></div>
                      </dl>
                    )}
                    {request.status === PurchaseRequestStatus.SUBMITTED && (
                      <form action={cancelPurchaseRequestAction} className="request-card-actions">
                        <input type="hidden" name="requestId" value={request.id} />
                        <button className="button button-danger-quiet" type="submit">انصراف از درخواست</button>
                      </form>
                    )}
                    {editable && services.length > 0 && hasSpendableBalance && (
                      <details className="request-edit-details">
                        <summary>ویرایش و ارسال دوباره</summary>
                        <form action={editPurchaseRequestAction} className="request-form request-edit-form">
                          <input type="hidden" name="requestId" value={request.id} />
                          <label>سرویس<select name="serviceId" defaultValue={services.some((service) => service.id === request.serviceId) ? request.serviceId : ""} required><option value="" disabled>انتخاب سرویس فعال</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
                          <label>هزینهٔ ماهانهٔ تقریبی (دلار)<input name="requestedAmount" type="number" min="0.01" max="9999999.99" step="0.01" defaultValue={request.requestedAmount.toFixed(2)} required /></label>
                          <label className="request-note-field">توضیح نیاز<textarea name="note" rows={3} maxLength={500} defaultValue={request.note ?? ""} /></label>
                          <button className="button button-primary" type="submit">ذخیره و ارسال دوباره</button>
                        </form>
                      </details>
                    )}
                    {editable && !hasSpendableBalance && <p className="request-form-hint">برای ارسال دوباره باید ابتدا از مدیر تیم بودجه دریافت کنید.</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel request-list-panel" aria-labelledby="my-plans-title">
          <div className="panel-heading"><div><p className="eyebrow">پیگیری پایان پلن</p><h2 id="my-plans-title">پلن‌های فعال من</h2></div><span className="count-chip">{activePurchases.length} پلن</span></div>
          <p className="panel-description">درخواست عدم تمدید فقط مدیر را باخبر می‌کند؛ لغو واقعی باید در وب‌سایت سرویس‌دهنده انجام شود. ثبت تمدید در سامانه به‌عنوان خرید جدید توسط مدیر انجام می‌شود.</p>
          {activePurchases.length === 0 ? <div className="empty-state"><p>پلن فعالی ندارید.</p></div> : <div className="renewal-list">
            {activePurchases.map((purchase) => {
              const latestRequest = purchase.renewalRequests[0];
              const pendingRequest = latestRequest?.status === RenewalRequestStatus.SUBMITTED;
              return <article className="request-card renewal-card" key={purchase.id}>
                <div className="request-card-heading"><div><h3>{purchase.service.name}</h3><span className="status-chip">{purchase.renewalStatus === RenewalStatus.NOT_RENEWING ? "در حال عدم تمدید" : "پلن فعال"}</span></div>
                  <time>{purchase.endDate?.toISOString().slice(0, 10) ?? "تاریخ پایان ثبت نشده"}</time></div>
                <dl className="request-facts"><div><dt>مبلغ پلن</dt><dd dir="ltr">${dollars(purchase.actualAmount)}</dd></div><div><dt>تمدید</dt><dd>{purchase.renewalStatus === RenewalStatus.AUTO ? "خودکار" : purchase.renewalStatus === RenewalStatus.MANUAL ? "دستی" : purchase.renewalStatus === RenewalStatus.NOT_RENEWING ? "عدم تمدید" : "تعیین‌نشده"}</dd></div></dl>
                {pendingRequest ? <div className="renewal-request-box"><p>درخواست عدم تمدید در انتظار بررسی مدیر است.</p><form action={cancelNonRenewalAction}><input type="hidden" name="requestId" value={latestRequest.id} /><button className="button button-secondary" type="submit">لغو درخواست</button></form></div> : purchase.renewalStatus !== RenewalStatus.NOT_RENEWING && purchase.endDate && purchase.endDate.toISOString().slice(0, 10) >= new Date().toISOString().slice(0, 10) ? <details className="renewal-details"><summary>درخواست عدم تمدید</summary><form action={requestNonRenewalAction} className="renewal-form"><input type="hidden" name="purchaseId" value={purchase.id} /><label>توضیح برای مدیر <span className="optional-label">اختیاری</span><input name="note" maxLength={500} placeholder="مثلاً این سرویس دیگر مورد نیاز نیست" /></label><button className="button button-danger-quiet" type="submit">ارسال درخواست عدم تمدید</button></form></details> : <p className="request-form-hint">برای این پلن درخواست عدم تمدید دیگری ثبت نمی‌شود.</p>}
              </article>;
            })}
          </div>}
        </section>
      </div>
    </main>
  );
}
