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
  title: "Liguster - Foreningsliv gjort nemt",
  description: "Liguster samler kommunikation, dokumenter og naboskab ét sted. Det digitale samlingspunkt for din forening.",
  openGraph: {
    title: "Liguster - Foreningsliv gjort nemt",
    description: "Liguster samler kommunikation, dokumenter og naboskab ét sted.",
    url: "https://www.liguster-app.dk",
    siteName: "Liguster",
    locale: "da_DK",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}