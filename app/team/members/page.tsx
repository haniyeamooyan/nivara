import { TeamStatus, UserRole, UserStatus } from "@prisma/client";
import {
  createMemberAction,
  deactivateMemberAction,
  updateMemberAction,
} from "@/app/team/members/actions";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type MembersPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

const errors: Record<string, string> = {
  "invalid-member": "نام، ایمیل یا گذرواژهٔ اولیه معتبر نیست؛ گذرواژه باید دست‌کم ۱۲ نویسه باشد.",
  "email-exists": "این ایمیل قبلاً در سامانه ثبت شده است.",
  "member-unavailable": "این عضو دیگر در تیم شما فعال نیست.",
};

const successes: Record<string, string> = {
  "member-created": "حساب کارمند ساخته و به تیم اضافه شد.",
  "member-updated": "اطلاعات کارمند به‌روز شد.",
  "member-deactivated": "حساب کارمند غیرفعال و از تیم خارج شد؛ تاریخچه حفظ شده است.",
};

export default async function TeamMembersPage({ searchParams }: MembersPageProps) {
  const manager = await requireRole(UserRole.MANAGER);
  const [team, { error, success }] = await Promise.all([
    prisma.team.findFirst({
      where: { managerId: manager.id, status: TeamStatus.ACTIVE, deletedAt: null },
      select: { id: true, name: true },
    }),
    searchParams,
  ]);
  if (!team) redirect("/unauthorized");

  const memberships = await prisma.teamMembership.findMany({
    where: {
      teamId: team.id,
      leftAt: null,
      user: { role: UserRole.EMPLOYEE, status: UserStatus.ACTIVE, deletedAt: null },
    },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <main className="app-shell">
      <AppHeader firstName={manager.firstName} role={manager.role} />
      <div className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">مدیریت تیم</p>
            <h1>اعضای {team.name}</h1>
            <p className="muted">فقط اعضای تیم تحت مدیریت شما نمایش داده می‌شوند.</p>
          </div>
          <span className="count-chip">{memberships.length} کارمند فعال</span>
        </div>

        {error && <p className="notice notice-error" role="alert">{errors[error] ?? "عملیات انجام نشد؛ اطلاعات را بررسی کن."}</p>}
        {success && <p className="notice notice-success" role="status">{successes[success] ?? "تغییرات ذخیره شد."}</p>}

        <section className="panel member-create-panel" aria-labelledby="new-member-title">
          <div className="panel-heading">
            <div><p className="eyebrow">افزودن مستقیم</p><h2 id="new-member-title">ساخت حساب کارمند</h2></div>
          </div>
          <p className="panel-description">حساب با نقش کارمند ساخته می‌شود، به تیم {team.name} می‌پیوندد و حساب بودجهٔ شخصی‌اش نیز آماده می‌شود.</p>
          <form action={createMemberAction} className="form-grid form-grid-four">
            <label>نام<input name="firstName" autoComplete="given-name" required maxLength={80} /></label>
            <label>نام خانوادگی<input name="lastName" autoComplete="family-name" required maxLength={80} /></label>
            <label>ایمیل سازمانی<input name="email" type="email" autoComplete="email" required /></label>
            <label>گذرواژهٔ اولیه<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>حداقل ۱۲ نویسه؛ امن در اختیار کارمند بگذار.</small></label>
            <button className="button button-primary field-wide" type="submit">ساخت حساب و افزودن به تیم</button>
          </form>
        </section>

        <section className="panel team-list-panel" aria-labelledby="members-list-title">
          <div className="panel-heading">
            <div><p className="eyebrow">اعضای فعال</p><h2 id="members-list-title">فهرست تیم</h2></div>
          </div>
          {memberships.length === 0 ? (
            <div className="empty-state"><h3>این تیم هنوز کارمندی ندارد</h3><p>با فرم بالا حساب اولین عضو را بساز.</p></div>
          ) : (
            <div className="table-scroll">
              <table className="data-table member-table">
                <thead><tr><th scope="col">نام</th><th scope="col">ایمیل</th><th scope="col">اقدام</th></tr></thead>
                <tbody>
                  {memberships.map(({ user }) => (
                    <tr key={user.id}>
                      <td colSpan={3}>
                        <div className="member-row">
                          <form action={updateMemberAction} className="inline-edit-form member-edit-form">
                            <input type="hidden" name="userId" value={user.id} />
                            <label className="sr-only" htmlFor={`first-${user.id}`}>نام کارمند</label>
                            <input id={`first-${user.id}`} name="firstName" defaultValue={user.firstName} required maxLength={80} />
                            <label className="sr-only" htmlFor={`last-${user.id}`}>نام خانوادگی کارمند</label>
                            <input id={`last-${user.id}`} name="lastName" defaultValue={user.lastName} required maxLength={80} />
                            <label className="sr-only" htmlFor={`email-${user.id}`}>ایمیل کارمند</label>
                            <input id={`email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
                            <button className="button button-secondary" type="submit">ذخیره</button>
                          </form>
                          <form action={deactivateMemberAction}>
                            <input type="hidden" name="userId" value={user.id} />
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
