import "./globals.css";
import { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "Youth Passion Project - Pathways Portal",
  description: "Portal for Youth Passion Project curriculum, training, mentorship, and chapter management.",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo-icon.svg"
  },
  themeColor: "#7c3aed"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
