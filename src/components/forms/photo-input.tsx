"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

type PhotoInputProps = {
  /** Form field name; the files are submitted like a normal multiple file input. */
  name: string;
  max?: number;
  /** Longest edge after compression, in pixels. */
  maxEdge?: number;
  invalid?: boolean;
  className?: string;
};

type Picked = { file: File; url: string };

/** Downscales a photo to `maxEdge` and re-encodes it as JPEG; keeps the original if that isn't smaller. */
async function compress(file: File, maxEdge: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // unsupported format (e.g. HEIC on desktop) — the server decides
  }
}

/**
 * "Add photos" button with thumbnails. Photos are compressed in the browser
 * before upload, then placed on a hidden file input so they submit with the form.
 */
export function PhotoInput({ name, max = 8, maxEdge = 1600, invalid, className }: PhotoInputProps) {
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Keep the submitted input in step with the thumbnails.
  useEffect(() => {
    if (!field.current) return;
    const dt = new DataTransfer();
    for (const p of photos) dt.items.add(p.file);
    field.current.files = dt.files;
  }, [photos]);

  // Free the preview URLs when the form goes away.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const room = Math.max(0, max - photos.length);
    const compressed = await Promise.all([...files].slice(0, room).map((f) => compress(f, maxEdge)));
    setPhotos((prev) => [...prev, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setBusy(false);
    if (picker.current) picker.current.value = "";
  };

  const remove = (i: number) => {
    URL.revokeObjectURL(photos[i]!.url);
    setPhotos((prev) => prev.filter((_, j) => j !== i));
  };

  return (
    <div className={className}>
      <input ref={field} type="file" name={name} multiple className="hidden" tabIndex={-1} aria-hidden />
      <input
        ref={picker}
        id={name}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => add(e.target.files)}
        disabled={busy || photos.length >= max}
      />
      <label
        htmlFor={name}
        aria-invalid={invalid}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:border-primary aria-invalid:border-danger",
          (busy || photos.length >= max) && "pointer-events-none opacity-60",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {photos.length >= max ? `${max} photos added` : "Add photos (auto-compressed)"}
      </label>
      {photos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="size-16 rounded-md border border-border object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-danger text-white shadow"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
