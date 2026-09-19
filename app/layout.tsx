import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nivara",
  description: "مدیریت داخلی بودجه و خرید سرویس‌ها",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {children}
        <Link href="/redesign" className="prototype-floating-badge" aria-label="پیش‌نمایش بازطراحی نیوارا">
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#4ADE80" }} />
          <span>🎨 پیش‌نمایش زنده بازطراحی (fix/style)</span>
        </Link>
      </body>
    </html>
  );
}

