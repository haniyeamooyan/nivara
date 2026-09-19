import { ServiceStatus, UserRole } from "@prisma/client";
import {
  createServiceAction,
  deactivateServiceAction,
  updateServiceAction,
} from "@/app/services/actions";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type ServicesPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

const errors: Record<string, string> = {
  "invalid-service": "نام سرویس یا دسته‌بندی معتبر نیست.",
  "service-exists": "سرویسی با این نام از قبل ثبت شده است.",
  "service-unavailable": "سرویس فعال پیدا نشد.",
};

const successes: Record<string, string> = {
  "service-created": "سرویس به فهرست اضافه شد.",
  "service-updated": "اطلاعات سرویس ذخیره شد.",
  "service-deactivated": "سرویس soft-delete شد و در سابقهٔ خریدها حفظ می‌شود.",
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const [{ error, success }, services] = await Promise.all([
    searchParams,
    prisma.service.findMany({
      where: { status: ServiceStatus.ACTIVE, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
  ]);

  return (
    <main className="app-shell">
      <AppHeader firstName={actor.firstName} role={actor.role} />
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">کاتالوگ</p>
            <h1>سرویس‌ها</h1>
            <p className="muted">فهرست متمرکز agentها و سرویس‌هایی که در درخواست‌های خرید استفاده می‌شوند.</p>
          </div>
          <span className="count-chip">{services.length} سرویس فعال</span>
        </div>

        {error && <p className="notice notice-error" role="alert">{errors[error] ?? "عملیات انجام نشد؛ اطلاعات را بررسی کن."}</p>}
        {success && <p className="notice notice-success" role="status">{successes[success] ?? "تغییرات ذخیره شد."}</p>}

        <section className="panel" aria-labelledby="new-service-title">
          <div className="panel-heading">
            <div><p className="eyebrow">افزودن به کاتالوگ</p><h2 id="new-service-title">ثبت سرویس</h2></div>
          </div>
          <form action={createServiceAction} className="form-grid form-grid-service">
            <label>نام سرویس<input name="name" required minLength={2} maxLength={100} placeholder="مثلاً OpenAI" /></label>
            <label>دسته‌بندی<input name="category" maxLength={80} placeholder="مثلاً AI" /></label>
            <button className="button button-primary" type="submit">افزودن سرویس</button>
          </form>
        </section>

        <section className="panel team-list-panel" aria-labelledby="service-list-title">
          <div className="panel-heading">
            <div><p className="eyebrow">فهرست</p><h2 id="service-list-title">سرویس‌های فعال</h2></div>
          </div>
          {services.length === 0 ? (
            <div className="empty-state"><h3>کاتالوگ خالی است</h3><p>اولین سرویس را از فرم بالا اضافه کن.</p></div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th scope="col">سرویس</th><th scope="col">دسته‌بندی</th><th scope="col">اقدام</th></tr></thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td colSpan={3}>
                        <div className="team-row">
                          <form action={updateServiceAction} className="inline-edit-form service-edit-form">
                            <input type="hidden" name="serviceId" value={service.id} />
                            <label className="sr-only" htmlFor={`service-${service.id}`}>نام سرویس</label>
                            <input id={`service-${service.id}`} name="name" defaultValue={service.name} required minLength={2} maxLength={100} />
                            <label className="sr-only" htmlFor={`category-${service.id}`}>دسته‌بندی سرویس</label>
                            <input id={`category-${service.id}`} name="category" defaultValue={service.category ?? ""} maxLength={80} placeholder="دسته‌بندی اختیاری" />
                            <button className="button button-secondary" type="submit">ذخیره</button>
                          </form>
                          <form action={deactivateServiceAction}>
                            <input type="hidden" name="serviceId" value={service.id} />
                            <button className="button button-danger-quiet" type="submit">غیرفعال‌سازی</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
