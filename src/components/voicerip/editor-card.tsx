"use client";

import * as React from "react";
import {
  Clock,
  Download,
  FileAudio,
  Layers,
  Music,
  Scissors,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  extractAudio,
  type AudioFormat,
  type ExtractResult,
  type Mp3Bitrate,
  type VideoItem,
} from "@/lib/extract-audio";
import type { SeparateResult } from "@/lib/separate";
import { TrackCard } from "@/components/voicerip/track-card";
import {
  formatBytes,
  formatDuration,
  formatHHMMSS,
  parseTimestamp,
} from "@/lib/format";

type Mode = "extract" | "separate";
type Status = "idle" | "working" | "done" | "error";

const BITRATES: Mp3Bitrate[] = ["128k", "192k", "256k", "320k"];

interface EditorCardProps {
  item: VideoItem;
  onRemove: () => void;
  onNewFile: () => void;
  onError: (message: string) => void;
}

export function EditorCard({
  item,
  onRemove,
  onNewFile,
  onError,
}: EditorCardProps) {
  const [mode, setMode] = React.useState<Mode>("separate");
  const [format, setFormat] = React.useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = React.useState<Mp3Bitrate>("192k");
  const [startStr, setStartStr] = React.useState("");
  const [endStr, setEndStr] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [progress, setProgress] = React.useState(0);
  const [stage, setStage] = React.useState("");
  const [extractResult, setExtractResult] = React.useState<ExtractResult | null>(null);
  const [separateResult, setSeparateResult] = React.useState<SeparateResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const downloadUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  const duration = item.duration;
  const working = status === "working";

  const switchMode = (m: Mode) => {
    setMode(m);
    setStatus("idle");
    setExtractResult(null);
    setSeparateResult(null);
    setError(null);
  };

  const onExtract = async () => {
    setError(null);
    setExtractResult(null);

    const startSec = startStr.trim() ? parseTimestamp(startStr) : null;
    const endSec = endStr.trim() ? parseTimestamp(endStr) : null;

    if (startStr.trim() && startSec === null) {
      setError("Start time must be HH:MM:SS.");
      setStatus("error");
      return;
    }
    if (endStr.trim() && endSec === null) {
      setError("End time must be HH:MM:SS.");
      setStatus("error");
      return;
    }
    if (startSec != null && endSec != null && endSec <= startSec) {
      setError("End must be after start.");
      setStatus("error");
      return;
    }

    setStatus("working");
    setProgress(0);
    setStage("Extracting…");

    try {
      const res = await extractAudio(item.file, {
        format,
        bitrate,
        startSec,
        endSec,
        onProgress: (r) => setProgress(r),
      });
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(res.blob);
      setExtractResult(res);
      setStatus("done");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Extraction failed.";
      setError(msg);
      setStatus("error");
      onError(msg);
    }
  };

  const onSeparate = async () => {
    setError(null);
    setSeparateResult(null);
    setStatus("working");
    setProgress(0);
    setStage("Loading models…");

    try {
      // onnxruntime comes along with the separation engine - load it only when
      // someone actually separates, not for everyone who opens the page.
      const { separateAudio } = await import("@/lib/separate");
      const res = await separateAudio(item.file, {
        onProgress: (r, s) => {
          setProgress(r);
          setStage(s);
        },
      });
      setSeparateResult(res);
      setStatus("done");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Separation failed.";
      setError(msg);
      setStatus("error");
      onError(msg);
    }
  };

  const onDownloadExtract = () => {
    if (!extractResult || !downloadUrlRef.current) return;
    const a = document.createElement("a");
    a.href = downloadUrlRef.current;
    a.download = extractResult.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAllStems = () => {
    if (!separateResult) return;
    for (const stem of separateResult.stems) {
      const url = URL.createObjectURL(stem.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = stem.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const useFullDuration = () => {
    setStartStr("");
    setEndStr(duration != null ? formatHHMMSS(duration) : "");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      {/* File info bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground text-background">
          <FileAudio className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatBytes(item.file.size)}
            {duration != null && (
              <>
                <span className="mx-1.5 opacity-50">/</span>
                {formatDuration(duration)}
              </>
            )}
          </p>
        </div>
        <button
          onClick={onRemove}
          disabled={working}
          className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Remove file"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Mode toggle */}
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && switchMode(v as Mode)}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem
            value="separate"
            variant="outline"
            className="h-9 gap-1.5 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            <Layers className="size-3.5" />
            <span className="text-xs font-medium">Separate</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="extract"
            variant="outline"
            className="h-9 gap-1.5 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
          >
            <Music className="size-3.5" />
            <span className="text-xs font-medium">Extract</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Extract mode options */}
        {mode === "extract" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ToggleGroup
                type="single"
                value={format}
                onValueChange={(v) => v && setFormat(v as AudioFormat)}
                className="flex w-full"
              >
                <ToggleGroupItem
                  value="mp3"
                  variant="outline"
                  className="h-8 flex-1 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
                >
                  MP3
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="wav"
                  variant="outline"
                  className="h-8 flex-1 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
                >
                  WAV
                </ToggleGroupItem>
              </ToggleGroup>

              {format === "mp3" ? (
                <ToggleGroup
                  type="single"
                  value={bitrate}
                  onValueChange={(v) => v && setBitrate(v as Mp3Bitrate)}
                  className="flex w-full"
                >
                  {BITRATES.map((b) => (
                    <ToggleGroupItem
                      key={b}
                      value={b}
                      variant="outline"
                      className="h-8 flex-1 font-mono text-xs data-[state=on]:border-foreground data-[state=on]:text-foreground"
                    >
                      {b}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : (
                <div className="flex h-8 items-center justify-center rounded-md border border-dashed font-mono text-xs text-muted-foreground">
                  PCM
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Scissors className="size-3" />
                  Trim
                </span>
                <button
                  onClick={useFullDuration}
                  disabled={working || duration == null}
                  className="text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Full
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={startStr}
                    onChange={(e) => setStartStr(e.target.value)}
                    placeholder="00:00:00"
                    disabled={working}
                    className="h-8 pl-7 font-mono text-xs tabular-nums"
                    aria-label="Start"
                  />
                </div>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={endStr}
                    onChange={(e) => setEndStr(e.target.value)}
                    placeholder={duration != null ? formatHHMMSS(duration) : "00:00:00"}
                    disabled={working}
                    className="h-8 pl-7 font-mono text-xs tabular-nums"
                    aria-label="End"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action / progress */}
        <div className="mt-auto">
          {working ? (
            <div className="space-y-2">
              <Progress
                value={progress * 100}
                className="h-1.5 [&_[data-slot=progress-indicator]]:bg-foreground"
              />
              <p className="text-center font-mono text-[11px] tabular-nums text-muted-foreground">
                {stage} {Math.round(progress * 100)}%
              </p>
            </div>
          ) : (
            <Button
              onClick={mode === "separate" ? onSeparate : onExtract}
              size="lg"
              className="h-10 w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {mode === "separate" ? (
                <>
                  <Layers className="size-4" />
                  Separate Audio
                </>
              ) : (
                <>
                  <Music className="size-4" />
                  Extract Audio
                </>
              )}
            </Button>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            {error}
          </p>
        )}

        {/* Extract result */}
        {mode === "extract" && status === "done" && extractResult && (
          <div className="flex items-center gap-3 border-l-2 border-foreground bg-muted/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight" title={extractResult.filename}>
                {extractResult.filename}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatBytes(extractResult.sizeBytes)} · {format.toUpperCase()}
              </p>
            </div>
            <Button onClick={onDownloadExtract} size="sm" className="h-8 shrink-0 gap-1.5">
              <Download className="size-3.5" />
              Download
            </Button>
            <button
              onClick={onNewFile}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="New file"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Separate results - track cards */}
        {mode === "separate" && status === "done" && separateResult && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {separateResult.stems.length} tracks
              </span>
              <Button onClick={downloadAllStems} size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                <Download className="size-3" />
                Download All
              </Button>
            </div>
            {separateResult.stems.map((stem) => (
              <TrackCard key={stem.name} stem={stem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
