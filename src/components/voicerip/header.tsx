"use client";

import * as React from "react";
import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackButton } from "@/components/feedback-button";
import { SiteSettingsMenu } from "@/components/site-settings-menu";
import { Logo } from "@/components/voicerip/logo";

const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <Logo className="size-5" />
        <span className="text-sm font-semibold tracking-tight">VoiceRip</span>
      </div>

      <div className="flex items-center gap-1.5">
        <FeedbackButton />
        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-7 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <Heart className="size-3.5" />
            <span className="hidden sm:inline">Donate</span>
          </a>
        </Button>
        <SiteSettingsMenu />
      </div>
    </header>
  );
}
