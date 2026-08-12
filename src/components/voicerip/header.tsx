"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Heart, Moon, Settings2, Shield, FileText, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/voicerip/logo";
import { FeedbackButton } from "@/components/feedback-button";

const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";
const GITHUB_URL = "https://github.com/JeffreyHamilton6399/voicerip";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <Logo className="size-5" />
        <span className="text-sm font-semibold tracking-tight">
          VoiceRip
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <FeedbackButton />
        <Button
          variant="outline"
          size="sm"
          asChild
          className="h-7 gap-1.5 rounded-full border-rose-200 px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <Heart className="size-3.5" />
            <span className="hidden sm:inline">Donate</span>
          </a>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-full"
            >
              <Settings2 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Moon className="size-4" />
              <span>Dark mode</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Legal
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href="#privacy">
                <Shield className="size-4" />
                <span>Privacy Policy</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#terms">
                <FileText className="size-4" />
                <span>Terms of Service</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Github className="size-4" />
                <span>GitHub</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
