import "./globals.css";
// Design System 2.0 (Tailwind v4, no preflight) — must load AFTER globals.css
// so ui-v2 utilities win on source order during the hybrid period.
import "./ui-v2.css";
import type { Metadata, Viewport } from "next";
import { Inter, EB_Garamond, DM_Sans, Nunito } from "next/font/google";

import { MotionInitScript } from "@/components/motion-init-script";

// Professional two-font system. We keep the original CSS variable names
// (--font-dm-sans / --font-nunito / --font-playfair / --font-lora) so the
// rest of the design system needs no changes — we simply repoint the
// casual/editorial faces (DM Sans, Nunito, Playfair, Lora) onto a cleaner,
// more corporate pairing: Inter for UI text and EB Garamond for display.

// Inter: crisp, neutral UI sans — drives all body copy and labels.
const inter = Inter({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const interLabel = Inter({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// EB Garamond: a classic, elegant serif for display headings.
const ebGaramond = EB_Garamond({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const ebGaramondAlt = EB_Garamond({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Real DM Sans + Nunito for the reskinned "YPP Portal" leadership surfaces.
// These are exposed as their OWN CSS variables and applied scoped (via the
// .portalSkin module) so the global UI font (Inter, aliased to --font-dm-sans)
// is left exactly as-is.
const dmSansReal = DM_Sans({
  variable: "--font-dm-sans-real",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const nunitoReal = Nunito({
  variable: "--font-nunito-real",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
  const fontVars = `${inter.variable} ${ebGaramond.variable} ${interLabel.variable} ${ebGaramondAlt.variable} ${dmSansReal.variable} ${nunitoReal.variable}`;

  return (
    <html lang="en" className={fontVars}>
      <body suppressHydrationWarning>
        <MotionInitScript />
        {children}
      </body>
    </html>
  );
}
