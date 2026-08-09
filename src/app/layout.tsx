import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VoiceRip — Separate vocals, drums & bass from any song",
  description:
    "Extract audio or separate vocals, drums, bass and music from any song — right in your browser. 100% free, no sign-up, no uploads.",
  keywords: [
    "vocal remover",
    "stem separation",
    "audio extractor",
    "spleeter",
    "isolate vocals",
    "remove vocals",
  ],
  authors: [{ name: "Jeffrey Hamilton" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "VoiceRip — Separate vocals, drums & bass from any song",
    description:
      "Extract audio or separate vocals, drums, bass and music from any song — right in your browser.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VoiceRip — Separate vocals, drums & bass from any song",
    description:
      "Extract audio or separate vocals, drums, bass and music. 100% client-side.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
