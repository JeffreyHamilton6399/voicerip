"use client";

import * as React from "react";
import { toast } from "sonner";
import { Header } from "@/components/voicerip/header";
import { Footer } from "@/components/voicerip/footer";
import { Dropzone } from "@/components/voicerip/dropzone";
import { EditorCard } from "@/components/voicerip/editor-card";
import { BatchList } from "@/components/voicerip/batch-list";
import {
  getFFmpeg,
  probeDuration,
  type VideoItem,
} from "@/lib/extract-audio";
import { isMobile } from "@/lib/mobile";
import { ACCEPTED_EXTENSIONS } from "@/lib/extract-audio";

export default function Page() {
  const [items, setItems] = React.useState<VideoItem[]>([]);
  const [debug, setDebug] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Persist debug flag + mirror to window for the ffmpeg log gate.
  React.useEffect(() => {
    const saved = localStorage.getItem("voicerip.debug");
    const initial = saved === "1";
    setDebug(initial);
    if (typeof window !== "undefined") {
      (window as unknown as { __VR_DEBUG?: boolean }).__VR_DEBUG = initial;
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem("voicerip.debug", debug ? "1" : "0");
    if (typeof window !== "undefined") {
      (window as unknown as { __VR_DEBUG?: boolean }).__VR_DEBUG = debug;
    }
  }, [debug]);

  // Pre-warm ffmpeg.wasm on desktop so the first extraction is instant.
  // Skip on mobile to avoid holding ~30MB of wasm memory unnecessarily.
  React.useEffect(() => {
    if (isMobile()) return;
    let cancelled = false;
    getFFmpeg().catch((err) => {
      if (!cancelled) {
        console.warn("ffmpeg prewarm failed (will retry on extract):", err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiles = React.useCallback(async (files: File[]) => {
    // Probe durations in parallel (best-effort, resolves null if unsupported).
    const probed = await Promise.all(
      files.map(async (file) => {
        const duration = await probeDuration(file).catch(() => null);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          file,
          duration,
        } satisfies VideoItem;
      })
    );
    setItems((prev) => [...prev, ...probed]);
  }, []);

  const onError = React.useCallback((message: string) => {
    toast.error(message);
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setItems([]);
  }, []);

  const newFile = React.useCallback(() => {
    // "New file" from the single-file result → start fresh.
    setItems([]);
    fileInputRef.current?.click();
  }, []);

  const addMore = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onPickMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    handleFiles(Array.from(list));
    e.target.value = "";
  };

  const single = items.length === 1;
  const batch = items.length > 1;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Header debug={debug} onDebugChange={setDebug} />

      <main className="flex min-h-0 flex-1 flex-col">
        {items.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-stretch p-3">
            <Dropzone onFiles={handleFiles} onError={onError} />
          </div>
        ) : single ? (
          <EditorCard
            item={items[0]}
            onRemove={() => removeItem(items[0].id)}
            onNewFile={newFile}
            onError={onError}
          />
        ) : (
          <BatchList
            items={items}
            onAddMore={addMore}
            onRemove={removeItem}
            onClear={clearAll}
            onError={onError}
          />
        )}
      </main>

      <Footer />

      {/* Hidden picker used by "Add" (batch) and "New file" (single result). */}
      <input
        ref={fileInputRef}
        type="file"
        accept={
          ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",") + ",video/*"
        }
        multiple
        className="sr-only"
        onChange={onPickMore}
      />
    </div>
  );
}
