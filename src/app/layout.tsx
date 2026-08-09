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
  title: "VoiceRip — Extract audio from video, privately in your browser",
  description:
    "Drop a video, pick MP3 or WAV, download the audio. 100% client-side — your files never leave your device. No uploads, no sign-up, no server.",
  keywords: [
    "audio extractor",
    "video to mp3",
    "video to wav",
    "ffmpeg wasm",
    "client-side audio",
    "private audio extraction",
  ],
  authors: [{ name: "Jeffrey Hamilton" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "VoiceRip — Extract audio from video, privately",
    description:
      "Drop a video, pick MP3 or WAV, download the audio. Your files never leave your device.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VoiceRip — Extract audio from video, privately",
    description:
      "Drop a video, pick MP3 or WAV, download the audio. 100% client-side.",
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
          defaultTheme="dark"
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
