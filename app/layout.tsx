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
  // Vigtigt: Sikrer at links til billeder bliver korrekte
  metadataBase: new URL('https://www.liguster-app.dk'),
  
  title: {
    default: "Liguster - Foreningsliv & Naboskab",
    template: "%s | Liguster",
  },
  
  description: "Liguster er det digitale samlingspunkt for din forening og dit nabolag. Køb, sælg, byt og udlej ting lokalt. Styrk fællesskabet i din grundejerforening.",
  
  keywords: [
    "grundejerforening", 
    "nabohjælp", 
    "deleøkonomi", 
    "udlejning af værktøj", 
    "lokalsamfund", 
    "genbrug", 
    "foreningsapp",
    "naboskab"
  ],
  
  authors: [{ name: "Liguster Teamet" }],
  
  openGraph: {
    title: "Liguster - Foreningsliv gjort nemt",
    description: "Saml kommunikation, dokumenter og naboskab ét sted. Køb, sælg og hjælp hinanden lokalt.",
    url: "https://www.liguster-app.dk",
    siteName: "Liguster",
    locale: "da_DK",
    type: "website",
    // JEG HAR TILFØJET DENNE LINJE FOR SIKKERHEDS SKYLD:
    images: ['/opengraph-image.png'],
  },
  
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}