import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">N</div>
        <p className="eyebrow">دسترسی محدود</p>
        <h1>اجازهٔ دسترسی ندارید</h1>
        <p className="muted">این بخش برای نقش کاربری شما در دسترس نیست.</p>
        <Link className="text-link" href="/">بازگشت به صفحهٔ اصلی</Link>
      </section>
    </main>
  );
}
