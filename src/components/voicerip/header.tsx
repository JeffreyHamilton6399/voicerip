"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Heart, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Logo } from "@/components/voicerip/logo";

const DONATE_URL = "https://buymeacoffee.com/jeffreyscof";

interface HeaderProps {
  debug: boolean;
  onDebugChange: (v: boolean) => void;
}

export function Header({ debug, onDebugChange }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
          <Logo className="size-4" />
        </div>
        <span className="font-mono text-[15px] font-semibold tracking-tight">
          VoiceRip
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
        >
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <Heart className="size-3.5" />
            <span className="hidden text-xs sm:inline">Donate</span>
          </a>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="size-3.5" />
              <span className="hidden text-xs sm:inline">Settings</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xs">
            <ToggleGroup
              type="single"
              value={mounted ? theme : "system"}
              onValueChange={(v) => {
                if (v) setTheme(v);
              }}
              className="flex w-full"
            >
              <ToggleGroupItem
                value="light"
                variant="outline"
                className="h-8 flex-1 text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                Light
              </ToggleGroupItem>
              <ToggleGroupItem
                value="dark"
                variant="outline"
                className="h-8 flex-1 text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem
                value="system"
                variant="outline"
                className="h-8 flex-1 text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
