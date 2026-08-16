import type { Metadata, Viewport } from "next";
import { Inter, Sofia_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { WelcomeProvider } from "@/lib/welcome-context";
import { ToastProvider } from "@/components/ui/Toast";
import { CursorGlow } from "@/components/CursorGlow";
import { ContentProtection } from "@/components/ContentProtection";

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
  title: "Шивнээ",
  description: "Шивнээ",
};

// viewport-fit=cover makes env(safe-area-inset-*) real on iOS, so the
// bottom dock and sheets can pad themselves clear of the home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05080f",
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
          <ToastProvider>
            <WelcomeProvider>{children}</WelcomeProvider>
          </ToastProvider>
        </AuthProvider>
        <CursorGlow />
        <ContentProtection />
      </body>
    </html>
  );
}
