import type { Metadata, Viewport } from "next";
import { Inter, Sofia_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui/Toast";
import { CursorGlow } from "@/components/CursorGlow";

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
  title: "Infinite Movie",
  description:
    "Infinite дээр дуртай кино, цувралаа хаанаас ч, хэзээ ч тасралтгүй үзээрэй.",
};

// viewport-fit=cover lets the app paint edge-to-edge on notched phones;
// safe-area insets then keep the fixed bars clear of the hardware.
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
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <CursorGlow />
      </body>
    </html>
  );
}
