import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Confidence Journal",
  description: "Own your wins. Build your brag doc.",
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
