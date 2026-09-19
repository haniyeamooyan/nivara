"use client";

export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-shell">
      <section className="panel report-error-panel" role="alert">
        <p className="eyebrow">گزارش شرکت</p>
        <h1>بارگذاری گزارش انجام نشد</h1>
        <p className="muted">اتصال داده‌ها یا فیلترهای گزارش موقتاً در دسترس نیست. دوباره تلاش کنید.</p>
        <button className="button button-primary" type="button" onClick={reset}>تلاش دوباره</button>
      </section>
    </main>
  );
}
