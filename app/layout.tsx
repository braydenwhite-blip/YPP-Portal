import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

// Professional two-font system. We keep the original CSS variable names
// (--font-dm-sans / --font-nunito / --font-playfair / --font-lora) so the
// rest of the design system needs no changes — we simply repoint the
// casual/editorial faces (DM Sans, Nunito, Playfair, Lora) onto a cleaner,
// more corporate pairing: Inter for UI text and Source Serif 4 for display.

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

// Source Serif 4: a restrained, professional serif for display headings.
const sourceSerif = Source_Serif_4({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const sourceSerifAlt = Source_Serif_4({
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
  const fontVars = `${inter.variable} ${sourceSerif.variable} ${interLabel.variable} ${sourceSerifAlt.variable}`;

  // Apply the saved motion preference before first paint so a forced "always
  // on" choice never flashes a reduced-motion frame. Mirrors lib/motion-preference.ts.
  const motionInit = `(function(){try{if(localStorage.getItem('ypp-motion-pref')==='on'){document.documentElement.setAttribute('data-motion','on');}}catch(e){}})();`;

  return (
    <html lang="en" className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionInit }} />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
