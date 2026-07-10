import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TFT Adwer — Canlı Danışman",
  description:
    "TFT (Teamfight Tactics) için VLM tabanlı canlı oyun danışmanı. Ekran görüntüsünden HP, gold, level, shop, board okur ve ekonomi/comp/shop önerileri verir.",
  keywords: ["TFT", "Teamfight Tactics", "advisor", "overlay", "VLM", "OCR", "Set 17"],
  authors: [{ name: "TFT Adwer" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
