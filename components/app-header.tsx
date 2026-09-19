import Link from "next/link";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/app/login/actions";

type AppHeaderProps = {
  firstName: string;
  role: UserRole;
};

export function AppHeader({ firstName, role }: AppHeaderProps) {
  return (
    <header className="app-header">
      <Link className="app-brand" href="/" aria-label="Nivara، صفحهٔ اصلی">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span>Nivara</span>
      </Link>
      <nav className="app-nav" aria-label="ناوبری اصلی">
        {role === UserRole.SUPER_ADMIN && (
          <>
            <Link href="/teams">تیم‌ها</Link>
            <Link href="/services">سرویس‌ها</Link>
          </>
        )}
        {role === UserRole.MANAGER && (
          <>
            <Link href="/team/members">اعضای تیم</Link>
            <Link href="/team/budgets">بودجهٔ تیم</Link>
            <Link href="/team/shared-budget">خریدهای تیمی</Link>
            <Link href="/team/requests">درخواست‌های تیم</Link>
            <Link href="/team/renewals">تمدید پلن‌ها</Link>
            <Link href="/purchases">خریدهای من</Link>
          </>
        )}
        {role === UserRole.EMPLOYEE && <Link href="/purchases">خریدهای من</Link>}
        {role === UserRole.CTO && <Link href="/reports">گزارش شرکت</Link>}
      </nav>
      <div className="app-account">
        <span className="app-account-name">{firstName}</span>
        <form action={logoutAction}>
          <button className="button button-quiet" type="submit">خروج</button>
        </form>
      </div>
    </header>
  );
}
