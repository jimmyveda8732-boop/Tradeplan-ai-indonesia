import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradePlan AI Indonesia",
  description: "Aplikasi analisis screenshot saham dan trading plan harian Indonesia",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
