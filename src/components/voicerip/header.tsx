"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Heart, Settings2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <Logo className="size-6" />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-tight">
            VoiceRip
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            extract audio, privately
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 rounded-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        >
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <Heart className="size-3.5" />
            <span className="hidden sm:inline">Donate</span>
          </a>
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 rounded-full">
              <Settings2 className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="size-4" />
                Settings
              </DialogTitle>
              <DialogDescription>
                Stored locally on this device only. Nothing is sent anywhere.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Theme</Label>
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
                  className="h-8 flex-1 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
                >
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="dark"
                  variant="outline"
                  className="h-8 flex-1 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
                >
                  Dark
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="system"
                  variant="outline"
                  className="h-8 flex-1 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
                >
                  System
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="debug-switch" className="text-sm">
                  Verbose ffmpeg logs
                </Label>
                <p className="text-xs text-muted-foreground">
                  Print ffmpeg.wasm output to the browser console.
                </p>
              </div>
              <Switch
                id="debug-switch"
                checked={debug}
                onCheckedChange={onDebugChange}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
