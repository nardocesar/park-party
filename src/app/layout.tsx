import type { Metadata } from "next";
import { Geist, Geist_Mono, Rye } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// títulos no estilo de cartaz de faroeste
const rye = Rye({
  variable: "--font-rye",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Park Party",
  description: "A Wild West co-op platformer in the browser for 2 to 8 players.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: extensões do navegador (modo leitura, temas) alteram <html>/<body>
    // antes da hidratação; só vale para atributos destes dois elementos, não para os filhos.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${rye.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
