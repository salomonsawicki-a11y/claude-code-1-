import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Margin — AI resale arbitrage agents",
  description:
    "AI agents that search the internet for items selling under retail, surface the best margins, and draft your resale listings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
