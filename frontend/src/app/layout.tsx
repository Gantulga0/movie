import type { Metadata } from "next";
import { Inter, Sofia_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";

// Inter carries all body text — full Cyrillic coverage for Mongolian.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

// Tall condensed display face — movie-poster headings, Cyrillic included.
const display = Sofia_Sans_Condensed({
  variable: "--font-display-face",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Infinite — Хязгааргүй кино, цуврал, анимэ",
  description:
    "Infinite дээр дуртай кино, цуврал, анимэгээ хаанаас ч, хэзээ ч тасралтгүй үзээрэй.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className={`${inter.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
