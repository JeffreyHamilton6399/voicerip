"use client";

import * as React from "react";
import {
  Clock,
  Download,
  FileAudio,
  Music,
  Plus,
  Scissors,
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
import { formatBytes, formatDuration, formatHHMMSS, parseTimestamp } from "@/lib/format";

interface EditorCardProps {
  item: VideoItem;
  onRemove: () => void;
  onNewFile: () => void;
  onError: (message: string) => void;
}

type Status = "idle" | "extracting" | "done" | "error";

const BITRATES: Mp3Bitrate[] = ["128k", "192k", "256k", "320k"];

export function EditorCard({
  item,
  onRemove,
  onNewFile,
  onError,
}: EditorCardProps) {
  const [format, setFormat] = React.useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = React.useState<Mp3Bitrate>("192k");
  const [startStr, setStartStr] = React.useState("");
  const [endStr, setEndStr] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState<ExtractResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const downloadUrlRef = React.useRef<string | null>(null);

  // Revoke any object URL when the result changes or the card unmounts.
  React.useEffect(() => {
    return () => {
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  const duration = item.duration;
  const maxEnd = duration ?? Infinity;

  const onExtract = async () => {
    setError(null);
    setResult(null);

    const startSec = startStr.trim() ? parseTimestamp(startStr) : null;
    const endSec = endStr.trim() ? parseTimestamp(endStr) : null;

    if (startStr.trim() && startSec === null) {
      setError("Start time must be HH:MM:SS (e.g. 00:00:05).");
      setStatus("error");
      onError("Start time must be HH:MM:SS.");
      return;
    }
    if (endStr.trim() && endSec === null) {
      setError("End time must be HH:MM:SS (e.g. 00:01:30).");
      setStatus("error");
      onError("End time must be HH:MM:SS.");
      return;
    }
    if (
      startSec != null &&
      endSec != null &&
      endSec <= startSec
    ) {
      setError("End time must be after the start time.");
      setStatus("error");
      onError("End time must be after the start time.");
      return;
    }
    if (duration != null && startSec != null && startSec >= duration) {
      setError("Start time is past the end of the video.");
      setStatus("error");
      onError("Start time is past the end of the video.");
      return;
    }

    setStatus("extracting");
    setProgress(0);

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
      setResult(res);
      setStatus("done");
      setProgress(1);
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
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

  const extracting = status === "extracting";

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto p-3">
      {/* file info bar */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileAudio className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {formatBytes(item.file.size)}
            {duration != null && (
              <>
                <span className="mx-1.5">·</span>
                {formatDuration(duration)}
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onRemove}
          aria-label="Remove file"
          disabled={extracting}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* format + quality */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Format</Label>
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
              className="h-8 flex-1 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
            >
              MP3
            </ToggleGroupItem>
            <ToggleGroupItem
              value="wav"
              variant="outline"
              className="h-8 flex-1 data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
            >
              WAV
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Quality
            {format === "wav" && (
              <span className="ml-1 text-muted-foreground/70">
                (lossless, n/a)
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
                  className="h-8 flex-1 font-mono text-xs data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600 dark:data-[state=on]:text-emerald-400"
                >
                  {b}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <div className="flex h-8 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
              16-bit PCM
            </div>
          )}
        </div>
      </div>

      {/* trim */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Scissors className="size-3" />
            Trim (optional)
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={useFullDuration}
            disabled={extracting || duration == null}
          >
            Use full duration
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              placeholder="00:00:00"
              disabled={extracting}
              className="h-8 pl-7 font-mono text-xs"
              aria-label="Trim start time"
            />
          </div>
          <div className="relative">
            <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              placeholder={duration != null ? formatHHMMSS(duration) : "00:00:00"}
              disabled={extracting}
              className="h-8 pl-7 font-mono text-xs"
              aria-label="Trim end time"
            />
          </div>
        </div>
      </div>

      {/* extract button / progress */}
      {extracting ? (
        <div className="space-y-1.5">
          <Progress
            value={progress * 100}
            className="h-2 bg-emerald-500/20 [&_[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <p className="text-center text-xs text-muted-foreground">
            Extracting audio… {Math.round(progress * 100)}%
          </p>
        </div>
      ) : (
        <Button
          onClick={onExtract}
          size="lg"
          className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <Music className="size-4" />
          Extract Audio
        </Button>
      )}

      {/* error */}
      {error && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          {error}
        </p>
      )}

      {/* result */}
      {status === "done" && result && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-50 p-3 dark:bg-emerald-950/20"
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white">
            <FileAudio className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={result.filename}>
              {result.filename}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatBytes(result.sizeBytes)} ·{" "}
              {format.toUpperCase()}
            </p>
          </div>
          <Button
            onClick={onDownload}
            size="sm"
            className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Download className="size-3.5" />
            Download
          </Button>
          <Button
            onClick={onNewFile}
            size="icon"
            variant="outline"
            className="size-8 shrink-0"
            aria-label="New file"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
