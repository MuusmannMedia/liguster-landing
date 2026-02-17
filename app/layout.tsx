import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.liguster-app.dk"),
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
    "naboskab",
  ],
  alternates: {
    canonical: "/",
  },
  authors: [{ name: "Liguster Teamet" }],
  openGraph: {
    title: "Liguster - Foreningsliv gjort nemt",
    description: "Saml kommunikation, dokumenter og naboskab ét sted. Køb, sælg og hjælp hinanden lokalt.",
    url: "https://www.liguster-app.dk",
    siteName: "Liguster",
    locale: "da_DK",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Liguster - Foreningsliv og naboskab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Liguster - Foreningsliv gjort nemt",
    description: "Saml kommunikation, dokumenter og naboskab ét sted.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
