import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
    "Generate ironclad liability shields, privacy policies, and pre-launch checklists in 30 seconds. Map your tech stack to compliance documents across 6 jurisdictions. Trusted by Shopify, WordPress, Next.js, Wix & Squarespace developers.",
  keywords: [
    "compliance generator",
    "privacy policy generator",
    "web agency compliance",
    "GDPR compliance tool",
    "CCPA compliance",
    "developer liability shield",
    "cookie consent",
    "HIPAA compliance",
    "web developer contracts",
    "freelancer compliance",
  ],
  authors: [{ name: "Comply-Quick" }],
  creator: "Comply-Quick",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Comply-Quick",
    title: "Comply-Quick — The 30-Second Liability Shield for Web Agencies",
    description:
      "Answer 4 questions about your tech stack. Get a ready-to-deploy liability shield, privacy policy, and pre-launch checklist — with a compliance score.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comply-Quick — Compliance Package Generator",
    description:
      "Map your tech stack to ironclad compliance documents in 30 seconds. 5 frameworks, 6 pixels, 6 jurisdictions, enterprise modules.",
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
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
