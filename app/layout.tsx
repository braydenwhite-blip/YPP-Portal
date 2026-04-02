import "./globals.css";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display, Nunito, Lora } from "next/font/google";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Youth Passion Project - Pathways Portal",
  description: "Portal for Youth Passion Project curriculum, training, mentorship, and chapter management.",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#6b21c8"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const fontVars = `${dmSans.variable} ${playfair.variable} ${nunito.variable} ${lora.variable}`;

  return (
    <html lang="en" className={fontVars}>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
