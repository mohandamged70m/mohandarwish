import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/layouts/nav";
import { PathMemory } from "@/components/layouts/path-memory";
import { Providers } from "@/components/layouts/providers";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mohand Darwish | Software Engineer",
  description: "Personal website and portfolio of Mohand Darwish, a software engineer.",
};

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
        <Providers>
          <PathMemory />
          <Nav />
          {children}
          {modal}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
