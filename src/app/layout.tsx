import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Comply-Quick — Compliance Package Generator for Web Agencies",
    template: "%s | Comply-Quick",
  },
  description:
    "Generate privacy policies, clear customer terms, and pre-launch checklists in under a minute. Everything your business needs to launch compliant and earn customer trust across 6 jurisdictions. Built for Shopify, WordPress, Next.js, Wix & Squarespace sites.",
  keywords: [
    "compliance generator",
    "privacy policy generator",
    "web agency compliance",
    "GDPR compliance tool",
    "CCPA compliance",
    "customer trust",
    "cookie consent",
    "HIPAA compliance",
    "customer terms of service",
    "freelancer compliance",
  ],
  authors: [{ name: "Comply-Quick" }],
  creator: "Comply-Quick",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Comply-Quick",
    title: "Comply-Quick — Your Entire Compliance Stack in Under a Minute",
    description:
      "Answer a few questions about your website and instantly generate a privacy policy, clear customer terms, and a pre-launch checklist — everything your business needs to launch with confidence.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comply-Quick — Compliance Package Generator",
    description:
      "Turn your tech stack into a complete, launch-ready compliance package in under a minute. 5 frameworks, 6 pixels, 6 jurisdictions, enterprise modules.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
