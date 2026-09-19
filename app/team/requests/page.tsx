import { PurchaseRequestStatus, RenewalStatus, TeamStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { completePurchaseAction, rejectPurchaseRequestAction } from "@/app/purchases/actions";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type TeamRequestsPageProps = { searchParams: Promise<{ error?: string; success?: string }> };

const errors: Record<string, string> = {
  "invalid-rejection": "برای رد درخواست، دلیل حداقل سه نویسه‌ای وارد کنید.",
  "invalid-purchase": "مبلغ واقعی یا تاریخ شروع پلن معتبر نیست.",
  "request-not-pending": "این درخواست دیگر در انتظار بررسی نیست یا قبلاً اقدام شده است.",
  "concurrent-update": "هم‌زمان درخواست دیگری ثبت یا تغییر کرده است؛ صفحه را تازه کنید و دوباره بررسی کنید.",
};

const successes: Record<string, string> = {
  "request-rejected": "درخواست با دلیل رد شد و به کارمند اطلاع داده شد.",
  "purchase-completed": "خرید ثبت شد؛ سهم شرکت به‌صورت اتمیک از موجودی کسر شد.",
};

const statusNames: Record<PurchaseRequestStatus, string> = {
  SUBMITTED: "در انتظار بررسی",
  PURCHASED: "خرید ثبت‌شده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده توسط کارمند",
};

function dollars(value: { toString(): string }) {
  return Number(value.toString()).toFixed(2);
}

export default async function TeamRequestsPage({ searchParams }: TeamRequestsPageProps) {
  const manager = await requireRole(UserRole.MANAGER);
  const params = await searchParams;
  const team = await prisma.team.findFirst({
    where: { managerId: manager.id, status: TeamStatus.ACTIVE, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) redirect("/unauthorized");

  const requests = await prisma.purchaseRequest.findMany({
    where: { teamId: team.id },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          budgetAccounts: { select: { transactions: { select: { amount: true } } } },
        },
      },
      service: { select: { name: true } },
      purchase: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const today = new Date().toISOString().slice(0, 10);
  const notice = params.error ? errors[params.error] : params.success ? successes[params.success] : undefined;

  return (
    <main className="app-shell">
      <AppHeader firstName={manager.firstName} role={manager.role} />
      <div className="page-content">
        <div className="page-heading">
          <div><p className="eyebrow">صف خرید تیم</p><h1>درخواست‌های {team.name}</h1><p className="muted">خرید یا ردکردن، اقدام نهایی مدیر است؛ تأیید جداگانه‌ای وجود ندارد.</p></div>
          <span className="count-chip">{requests.filter((request) => request.status === PurchaseRequestStatus.SUBMITTED).length} در انتظار بررسی</span>
        </div>
        {notice && <p className={`notice ${params.error ? "notice-error" : "notice-success"}`} role={params.error ? "alert" : "status"}>{notice}</p>}
        {requests.length === 0 ? (
          <section className="panel empty-state"><h2>درخواستی ثبت نشده</h2><p>درخواست‌های اعضای تیم که ثبت شوند، اینجا نمایش داده می‌شوند.</p></section>
        ) : (
          <section className="request-list manager-request-list" aria-label="درخواست‌های خرید تیم">
          {requests.map((request) => (
              <article className="panel request-card manager-request-card" key={request.id}>
                <div className="request-card-heading">
                  <div><span className={`status-chip request-status request-status-${request.status.toLowerCase()}`}>{statusNames[request.status]}</span><h2>{request.service.name}</h2></div>
                  <time dateTime={request.createdAt.toISOString()}>{request.createdAt.toLocaleDateString("fa-IR", { dateStyle: "medium", timeZone: "UTC" })}</time>
                </div>
                <div className="request-person"><strong>{request.requester.firstName} {request.requester.lastName}</strong><span>{request.requester.email}</span>{request.requester.id === manager.id && <span className="self-request-label">درخواست شخصی شما</span>}</div>
                <dl className="request-facts">
                  <div><dt>هزینهٔ ماهانهٔ تخمینی</dt><dd dir="ltr">${dollars(request.requestedAmount)}</dd></div>
                  {request.status === PurchaseRequestStatus.SUBMITTED && <div><dt>ماندهٔ فعلی برای محاسبهٔ سهم شرکت</dt><dd dir="ltr">${request.requester.budgetAccounts[0]?.transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0).toFixed(2) ?? "0.00"}</dd></div>}
                </dl>
                {request.note && <p className="request-note">{request.note}</p>}
                {request.status === PurchaseRequestStatus.SUBMITTED && request.requester.id !== manager.id && (
                  <div className="manager-action-grid">
                    <form action={completePurchaseAction} className="manager-purchase-form">
                      <p className="eyebrow">ثبت خرید</p>
                      <input type="hidden" name="requestId" value={request.id} />
                      <label>مبلغ واقعی خرید (دلار)<input name="actualAmount" type="number" min="0.01" max="9999999.99" step="0.01" defaultValue={request.requestedAmount.toFixed(2)} required /></label>
                      <label>تاریخ شروع پلن<input name="startDate" type="date" defaultValue={today} required /></label>
                      <label>وضعیت تمدید
                        <select name="renewalStatus" defaultValue={RenewalStatus.NOT_APPLICABLE}>
                          <option value={RenewalStatus.NOT_APPLICABLE}>فعلاً تعیین نشده</option>
                          <option value={RenewalStatus.AUTO}>تمدید خودکار</option>
                          <option value={RenewalStatus.MANUAL}>تمدید دستی</option>
                          <option value={RenewalStatus.NOT_RENEWING}>عدم تمدید</option>
                        </select>
                      </label>
                      <p className="request-form-hint">پلن یک‌ماهه است. سهم شرکت از موجودی فعلی کسر می‌شود؛ مازاد بر عهدهٔ کارمند و خارج از سامانه است.</p>
                      <button className="button button-primary" type="submit">ثبت خرید نهایی</button>
                    </form>
                    <form action={rejectPurchaseRequestAction} className="manager-reject-form">
                      <p className="eyebrow">رد درخواست</p>
                      <input type="hidden" name="requestId" value={request.id} />
                      <label>دلیل رد <textarea name="rejectionReason" rows={4} minLength={3} maxLength={500} required placeholder="دلیل را برای اطلاع کارمند بنویسید" /></label>
                      <button className="button button-danger" type="submit">رد با ثبت دلیل</button>
                    </form>
                  </div>
                )}
                {request.status === PurchaseRequestStatus.SUBMITTED && request.requester.id === manager.id && <p className="notice notice-error">این درخواست پیش از تغییر فرایند توسط مدیر ثبت شده و دیگر از مسیر بررسی درخواست قابل خرید نیست؛ خرید شخصی را مستقیم از بخش «خریدهای من» ثبت کنید.</p>}
                {request.rejectionReason && <p className="notice notice-error request-reason"><strong>دلیل رد:</strong> {request.rejectionReason}</p>}
                {request.purchase && (
                  <dl className="request-facts purchase-facts">
                    <div><dt>مبلغ واقعی</dt><dd dir="ltr">${dollars(request.purchase.actualAmount)}</dd></div>
                    <div><dt>سهم شرکت</dt><dd dir="ltr">${dollars(request.purchase.companyAmount)}</dd></div>
                    <div><dt>سهم کارمند</dt><dd dir="ltr">${dollars(request.purchase.employeeContribution)}</dd></div>
                    <div><dt>شروع پلن</dt><dd dir="ltr">{request.purchase.startDate.toISOString().slice(0, 10)}</dd></div>
                    <div><dt>پایان پلن یک‌ماهه</dt><dd dir="ltr">{request.purchase.endDate?.toISOString().slice(0, 10) ?? "—"}</dd></div>
                    <div><dt>وضعیت تمدید</dt><dd>{request.purchase.renewalStatus === RenewalStatus.AUTO ? "خودکار" : request.purchase.renewalStatus === RenewalStatus.MANUAL ? "دستی" : request.purchase.renewalStatus === RenewalStatus.NOT_RENEWING ? "عدم تمدید" : "تعیین‌نشده"}</dd></div>
                  </dl>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
