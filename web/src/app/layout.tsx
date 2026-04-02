import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import Nav from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parameter Golf Field Guide",
  description:
    "Interactive learning site for OpenAI Parameter Golf competition techniques",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <Nav />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-[var(--border)] py-4 text-center text-sm text-[var(--muted)]">
          Parameter Golf Field Guide &middot; Auto-updated from{" "}
          <a
            href="https://github.com/openai/parameter-golf"
            target="_blank"
            rel="noopener noreferrer"
          >
            openai/parameter-golf
          </a>
        </footer>
      </body>
    </html>
  );
}
