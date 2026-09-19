import { TeamStatus, UserRole, UserStatus } from "@prisma/client";
import {
  createManagerAction,
  createTeamAction,
  deactivateTeamAction,
  updateTeamAction,
} from "@/app/teams/actions";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type TeamsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

const errors: Record<string, string> = {
  "invalid-manager": "اطلاعات مدیر کامل و معتبر نیست؛ گذرواژه باید دست‌کم ۱۲ نویسه باشد.",
  "invalid-team": "نام تیم و مدیر معتبر را وارد کن.",
  "email-exists": "این ایمیل قبلاً در سامانه ثبت شده است.",
  "duplicate-team": "تیمی با این نام وجود دارد؛ نام دیگری انتخاب کن.",
  "manager-unavailable": "این مدیر فعال نیست یا دیگر امکان انتخابش وجود ندارد.",
  "manager-assigned": "برای ایجاد تیم، ابتدا باید عضویت فعال مدیر انتخاب‌شده در تیم دیگر مشخص شود.",
  "team-unavailable": "تیم فعال پیدا نشد.",
};

const successes: Record<string, string> = {
  "manager-created": "حساب مدیر ساخته شد.",
  "team-created": "تیم ساخته شد.",
  "team-updated": "تغییرات تیم ذخیره شد.",
  "team-deactivated": "تیم غیرفعال شد و در تاریخچه باقی ماند.",
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const actor = await requireRole(UserRole.SUPER_ADMIN);
  const [{ error, success }, teams, managers] = await Promise.all([
    searchParams,
    prisma.team.findMany({
      where: { status: TeamStatus.ACTIVE, deletedAt: null },
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: UserRole.MANAGER, status: UserStatus.ACTIVE, deletedAt: null },
      include: {
        memberships: {
          where: { leftAt: null },
          select: { teamId: true },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);
  const availableManagers = managers.filter((manager) => manager.memberships.length === 0);

  return (
    <main className="app-shell">
      <AppHeader firstName={actor.firstName} role={actor.role} />
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">مدیریت سازمان</p>
            <h1>تیم‌ها و مدیران</h1>
            <p className="muted">ساخت تیم، تعیین مدیر و نگهداری تاریخچهٔ تغییرات.</p>
          </div>
          <span className="count-chip">{teams.length} تیم فعال</span>
        </div>

        {error && <p className="notice notice-error" role="alert">{errors[error] ?? "عملیات انجام نشد؛ اطلاعات را بررسی کن."}</p>}
        {success && <p className="notice notice-success" role="status">{successes[success] ?? "تغییرات ذخیره شد."}</p>}

        <div className="management-grid">
          <section className="panel" aria-labelledby="new-manager-title">
            <div className="panel-heading">
              <div><p className="eyebrow">حساب جدید</p><h2 id="new-manager-title">ایجاد مدیر واحد</h2></div>
            </div>
            <form action={createManagerAction} className="form-grid">
              <label>نام<input name="firstName" autoComplete="given-name" required maxLength={80} /></label>
              <label>نام خانوادگی<input name="lastName" autoComplete="family-name" required maxLength={80} /></label>
              <label className="field-wide">ایمیل سازمانی<input name="email" type="email" autoComplete="email" required /></label>
              <label className="field-wide">گذرواژهٔ اولیه<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>حداقل ۱۲ نویسه؛ آن را جداگانه و امن در اختیار مدیر بگذار.</small></label>
              <button className="button button-primary field-wide" type="submit">ساخت حساب مدیر</button>
            </form>
          </section>

          <section className="panel" aria-labelledby="new-team-title">
            <div className="panel-heading">
              <div><p className="eyebrow">ساختار سازمان</p><h2 id="new-team-title">ایجاد تیم</h2></div>
            </div>
            <form action={createTeamAction} className="form-grid">
              <label className="field-wide">نام تیم<input name="name" required minLength={2} maxLength={100} placeholder="مثلاً Platform" /></label>
              <label className="field-wide">مدیر تیم
                <select name="managerId" required defaultValue="" disabled={availableManagers.length === 0}>
                  <option value="" disabled>{availableManagers.length ? "انتخاب مدیر" : "ابتدا یک مدیر بساز"}</option>
                  {availableManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.email}</option>
                  ))}
                </select>
              </label>
              <button className="button button-primary field-wide" type="submit" disabled={availableManagers.length === 0}>ساخت تیم</button>
            </form>
          </section>
        </div>

        <section className="panel team-list-panel" aria-labelledby="teams-list-title">
          <div className="panel-heading">
            <div><p className="eyebrow">فهرست</p><h2 id="teams-list-title">تیم‌های فعال</h2></div>
          </div>
          {teams.length === 0 ? (
            <div className="empty-state"><h3>هنوز تیمی ساخته نشده</h3><p>برای شروع، یک مدیر ایجاد کن و سپس تیمش را بساز.</p></div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th scope="col">تیم</th><th scope="col">مدیر</th><th scope="col">اقدام</th></tr></thead>
                <tbody>
                  {teams.map((team) => {
                    const managerOptions = managers.filter((manager) =>
                      manager.memberships.length === 0 || manager.memberships.some((membership) => membership.teamId === team.id),
                    );
                    return (
                      <tr key={team.id}>
                        <td colSpan={3}>
                          <div className="team-row">
                            <form action={updateTeamAction} className="inline-edit-form">
                              <input type="hidden" name="teamId" value={team.id} />
                              <label className="sr-only" htmlFor={`team-name-${team.id}`}>نام تیم {team.name}</label>
                              <input id={`team-name-${team.id}`} name="name" defaultValue={team.name} required minLength={2} maxLength={100} />
                              <label className="sr-only" htmlFor={`team-manager-${team.id}`}>مدیر تیم {team.name}</label>
                              <select id={`team-manager-${team.id}`} name="managerId" defaultValue={team.managerId} required>
                                {managerOptions.map((manager) => (
                                  <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.email}</option>
                                ))}
                              </select>
                              <button className="button button-secondary" type="submit">ذخیره</button>
                            </form>
                            <form action={deactivateTeamAction}>
                              <input type="hidden" name="teamId" value={team.id} />
                              <button className="button button-danger-quiet" type="submit">غیرفعال‌سازی</button>
                            </form>
                          </div>
                          <span className="table-subline">مدیر فعلی: {team.manager.firstName} {team.manager.lastName} · {team.manager.email}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
