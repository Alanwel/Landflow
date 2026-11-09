import type { Metadata } from "next";
import { Inter } from "next/font/google";

import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import "./globals.css";

// next/font downloads and self-hosts the font at build time —
// no Google Fonts request at runtime, so no CDN dependency.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://landown.vercel.app",
  ),
  title: {
    default: "LandFlow — Land for sale in Uganda",
    template: "%s — LandFlow",
  },
  description:
    "Browse verified residential, commercial, agricultural and industrial land across Uganda. Post your own land free, and talk directly to the seller.",
  openGraph: {
    title: "LandFlow — Land for sale in Uganda",
    description:
      "A digital land marketplace for Uganda. Browse listings, save the ones you like, and send enquiries straight to the seller.",
    type: "website",
    locale: "en_UG",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-sand-50 text-ink-900">
        <Nav />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
