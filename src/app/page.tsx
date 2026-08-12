"use client";

import * as React from "react";
import { toast } from "sonner";
import { Header } from "@/components/voicerip/header";
import { SiteFooter } from "@/components/site-footer";
import { Dropzone } from "@/components/voicerip/dropzone";
import { EditorCard } from "@/components/voicerip/editor-card";
import { BatchList } from "@/components/voicerip/batch-list";
import {
  getFFmpeg,
  probeDuration,
  type VideoItem,
} from "@/lib/extract-audio";
import { ACCEPTED_EXTENSIONS } from "@/lib/extract-audio";
import { isMobile } from "@/lib/mobile";

export default function Page() {
  const [items, setItems] = React.useState<VideoItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isMobile()) return;
    getFFmpeg().catch(() => {});
  }, []);

  const handleFiles = React.useCallback(async (files: File[]) => {
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

  const clearAll = React.useCallback(() => setItems([]), []);

  const newFile = React.useCallback(() => {
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

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Header />

      <main className="flex min-h-0 flex-1 flex-col">
        {items.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-stretch p-4">
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

      <SiteFooter />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",") + ",video/*,audio/*"}
        multiple
        className="sr-only"
        onChange={onPickMore}
      />
    </div>
  );
}
