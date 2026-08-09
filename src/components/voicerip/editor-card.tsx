"use client";

import * as React from "react";
import {
  Clock,
  Download,
  FileAudio,
  Mic,
  Music,
  Plus,
  Scissors,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  extractAudio,
  type AudioFormat,
  type ExtractResult,
  type Mp3Bitrate,
  type VideoItem,
} from "@/lib/extract-audio";
import { isolateVoice } from "@/lib/isolate-voice";
import {
  formatBytes,
  formatDuration,
  formatHHMMSS,
  parseTimestamp,
} from "@/lib/format";

type Mode = "extract" | "isolate";
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
  const [mode, setMode] = React.useState<Mode>("extract");
  const [format, setFormat] = React.useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = React.useState<Mp3Bitrate>("192k");
  const [startStr, setStartStr] = React.useState("");
  const [endStr, setEndStr] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<ExtractResult | null>(null);
  const [resultLabel, setResultLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const downloadUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  const duration = item.duration;

  const validateTrim = (): {
    startSec: number | null;
    endSec: number | null;
  } | null => {
    const startSec = startStr.trim() ? parseTimestamp(startStr) : null;
    const endSec = endStr.trim() ? parseTimestamp(endStr) : null;
    if (startStr.trim() && startSec === null) {
      setError("Start time must be HH:MM:SS.");
      setStatus("error");
      onError("Start time must be HH:MM:SS.");
      return null;
    }
    if (endStr.trim() && endSec === null) {
      setError("End time must be HH:MM:SS.");
      setStatus("error");
      onError("End time must be HH:MM:SS.");
      return null;
    }
    if (startSec != null && endSec != null && endSec <= startSec) {
      setError("End time must be after the start time.");
      setStatus("error");
      onError("End time must be after the start time.");
      return null;
    }
    if (duration != null && startSec != null && startSec >= duration) {
      setError("Start time is past the end of the video.");
      setStatus("error");
      onError("Start time is past the end of the video.");
      return null;
    }
    return { startSec, endSec };
  };

  const onProcess = async () => {
    setError(null);
    setResult(null);

    const trimmed = mode === "extract" ? validateTrim() : { startSec: null, endSec: null };
    if (!trimmed) return;

    setStatus("working");
    setProgress(0);

    try {
      let res: ExtractResult;
      if (mode === "isolate") {
        const iso = await isolateVoice(item.file, {
          onProgress: (r) => setProgress(r),
        });
        res = {
          blob: iso.blob,
          filename: iso.filename,
          sizeBytes: iso.sizeBytes,
          mime: iso.mime,
        };
        setResultLabel("VOCALS");
      } else {
        res = await extractAudio(item.file, {
          format,
          bitrate,
          startSec: trimmed.startSec,
          endSec: trimmed.endSec,
          onProgress: (r) => setProgress(r),
        });
        setResultLabel(format.toUpperCase());
      }

      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(res.blob);
      setResult(res);
      setStatus("done");
      setProgress(1);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : mode === "isolate"
            ? "Voice isolation failed. Try a stereo file for best results."
            : "Audio extraction failed. Try a smaller file or a different format.";
      setError(msg);
      setStatus("error");
      onError(msg);
    }
  };

  const onDownload = () => {
    if (!result || !downloadUrlRef.current) return;
    const a = document.createElement("a");
    a.href = downloadUrlRef.current;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const useFullDuration = () => {
    setStartStr("");
    setEndStr(duration != null ? formatHHMMSS(duration) : "");
  };

  const working = status === "working";
  const actionLabel =
    mode === "isolate" ? "Isolate Voice" : "Extract Audio";

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

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 p-4">
        {/* Mode selector */}
        <div>
          <Label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Mode
          </Label>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => {
              if (v) {
                setMode(v as Mode);
                setStatus("idle");
                setResult(null);
                setError(null);
              }
            }}
            className="grid w-full grid-cols-2"
          >
            <ToggleGroupItem
              value="extract"
              variant="outline"
              className="h-9 gap-1.5 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              <Music className="size-3.5" />
              <span className="text-xs font-medium">Extract Audio</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="isolate"
              variant="outline"
              className="h-9 gap-1.5 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              <Mic className="size-3.5" />
              <span className="text-xs font-medium">Isolate Voice</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Mode-specific options */}
        {mode === "extract" ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Format
                </Label>
                <ToggleGroup
                  type="single"
                  value={format}
                  onValueChange={(v) => {
                    if (v) setFormat(v as AudioFormat);
                  }}
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
              </div>

              <div>
                <Label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Bitrate
                  {format === "wav" && (
                    <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">
                      lossless
                    </span>
                  )}
                </Label>
                {format === "mp3" ? (
                  <ToggleGroup
                    type="single"
                    value={bitrate}
                    onValueChange={(v) => {
                      if (v) setBitrate(v as Mp3Bitrate);
                    }}
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
                  <div className="flex h-8 items-center rounded-md border border-dashed px-3 font-mono text-xs text-muted-foreground">
                    PCM 16-bit
                  </div>
                )}
              </div>
            </div>

            {/* Trim */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Scissors className="size-3" />
                  Trim
                </Label>
                <button
                  onClick={useFullDuration}
                  disabled={working || duration == null}
                  className="text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Use full duration
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
                    className="h-8 border-border pl-7 font-mono text-xs tabular-nums"
                    aria-label="Trim start time"
                  />
                </div>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={endStr}
                    onChange={(e) => setEndStr(e.target.value)}
                    placeholder={
                      duration != null ? formatHHMMSS(duration) : "00:00:00"
                    }
                    disabled={working}
                    className="h-8 border-border pl-7 font-mono text-xs tabular-nums"
                    aria-label="Trim end time"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <Waves className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">
                  Spectral vocal isolation
                </p>
                <p>
                  STFT mid/side soft-mask in the frequency domain removes
                  side-panned instruments. Horizontal median filtering
                  suppresses drums. Final EQ chain: 90 Hz–9 kHz vocal band,
                  presence boost, de-ess, compressor. Output is mono WAV.
                </p>
                <p className="text-muted-foreground/70">
                  Best on stereo music. Center-panned bass/piano may leak —
                  they look spectrally identical to vocals.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action / progress */}
        <div className="mt-auto">
          {working ? (
            <div className="space-y-2">
              <Progress
                value={progress * 100}
                className="h-1.5 [&_[data-slot=progress-indicator]]:bg-foreground"
              />
              <p className="text-center text-[11px] tabular-nums text-muted-foreground">
                {mode === "isolate" ? "Isolating" : "Extracting"}…{" "}
                {Math.round(progress * 100)}%
              </p>
            </div>
          ) : (
            <Button
              onClick={onProcess}
              size="lg"
              className="h-10 w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
            >
              {mode === "isolate" ? (
                <Mic className="size-4" />
              ) : (
                <Music className="size-4" />
              )}
              {actionLabel}
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            {error}
          </p>
        )}

        {/* Result */}
        {status === "done" && result && (
          <div className="flex items-center gap-3 border-l-2 border-foreground bg-muted/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-medium leading-tight"
                title={result.filename}
              >
                {result.filename}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatBytes(result.sizeBytes)} · {resultLabel}
              </p>
            </div>
            <Button
              onClick={onDownload}
              size="sm"
              className="h-8 shrink-0 gap-1.5"
            >
              <Download className="size-3.5" />
              Download
            </Button>
            <button
              onClick={onNewFile}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="New file"
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
