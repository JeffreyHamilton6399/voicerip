"use client";

import * as React from "react";
import { Download, Pause, Play } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { StemResult } from "@/lib/separate";

interface TrackCardProps {
  stem: StemResult;
}

const STEM_LABELS: Record<string, { label: string }> = {
  vocals: { label: "Vocals" },
  drums: { label: "Drums" },
  bass: { label: "Bass" },
  other: { label: "Music" },
};

export function TrackCard({ stem }: TrackCardProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const urlRef = React.useRef<string | null>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    urlRef.current = URL.createObjectURL(stem.blob);
    if (audioRef.current) audioRef.current.src = urlRef.current;
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [stem.blob]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.play();
    }
    setPlaying(!playing);
  };

  const onDownload = () => {
    if (!urlRef.current) return;
    const a = document.createElement("a");
    a.href = urlRef.current;
    a.download = stem.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const meta = STEM_LABELS[stem.name] ?? { label: stem.name };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded bg-foreground text-background"
      >
        <button
          onClick={togglePlay}
          className="flex size-full items-center justify-center"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="size-4" fill="currentColor" />
          )}
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{meta.label}</p>
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatBytes(stem.sizeBytes)}
        </p>
      </div>

      <button
        onClick={onDownload}
        className="flex size-8 shrink-0 items-center justify-center rounded border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Download ${meta.label}`}
      >
        <Download className="size-3.5" />
      </button>

      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        preload="auto"
      />
    </div>
  );
}
