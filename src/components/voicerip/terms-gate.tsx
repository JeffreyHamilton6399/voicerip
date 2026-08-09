"use client";

import * as React from "react";
import { Lock, FileText, ShieldCheck, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "voicerip.termsAccepted";

interface TermsGateProps {
  children: React.ReactNode;
}

const POINTS = [
  {
    icon: Lock,
    title: "Private by design",
    desc: "Your files are processed in your browser and never uploaded anywhere.",
  },
  {
    icon: FileText,
    title: "Your content, your responsibility",
    desc: "Only process files you have the rights to use.",
  },
  {
    icon: ShieldCheck,
    title: "Provided as-is",
    desc: "No warranties — keep backups of anything important.",
  },
  {
    icon: Gift,
    title: "Free & no strings",
    desc: "No sign-up, no tracking, no watermarks. Ever.",
  },
];

export function TermsGate({ children }: TermsGateProps) {
  const [accepted, setAccepted] = React.useState(true);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setAccepted(stored === "1");
  }, []);

  const onAccept = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setAccepted(true);
  };

  if (accepted) return <>{children}</>;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">
          Before you rip
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A few quick things to know.
        </p>

        <div className="mt-6 space-y-4">
          {POINTS.map((p) => (
            <div key={p.title} className="flex gap-3">
              <p.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={onAccept}
          className="mt-6 h-11 w-full gap-2 text-sm font-medium"
        >
          I accept — let&apos;s go
        </Button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms &amp; Privacy Policy (in the
          settings menu).
        </p>
      </div>
    </div>
  );
}
