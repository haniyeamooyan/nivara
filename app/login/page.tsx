import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { loginAction } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getCurrentSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">N</div>
        <p className="eyebrow">مدیریت خرید و بودجهٔ تیم فنی</p>
        <h1 id="login-title">ورود به Nivara</h1>
        <p className="muted">برای ادامه، با حساب سازمانی خود وارد شوید.</p>

        <form action={loginAction} className="auth-form">
          <label htmlFor="email">ایمیل</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="name@company.com"
            required
          />

          <label htmlFor="password">گذرواژه</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {error === "invalid" && (
            <p className="form-error" role="alert">
              ایمیل یا گذرواژه درست نیست، یا حساب فعال نیست.
            </p>
          )}

          <button type="submit">ورود امن</button>
        </form>
        <p className="security-note">نشست شما به‌صورت امن و محدود به این مرورگر نگهداری می‌شود.</p>
      </section>
    </main>
  );
}
