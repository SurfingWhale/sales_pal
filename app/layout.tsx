import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SALESPAL – AI-Powered Lead Tracker",
  description: "AI-powered CRM + outreach tracker buat sales yang mau scale di era otomasi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
