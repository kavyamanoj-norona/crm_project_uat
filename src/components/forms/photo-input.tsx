"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/cn";

type PhotoInputProps = {
  /** Form field name; the files are submitted like a normal multiple file input. */
  name: string;
  max?: number;
  /** Longest edge after compression, in pixels. */
  maxEdge?: number;
  invalid?: boolean;
  /** Show separate "Upload images" (gallery/files) and "Take photo" (camera) buttons. */
  allowUpload?: boolean;
  /** Dashed drop-zone layout (icon, "Choose file", "or", "Take photo"); needs allowUpload. */
  dropzone?: { title: string };
  /** File types the picker accepts (default images only); PDFs are kept as they are and shown as a tile. */
  accept?: string;
  /** Called with the current files whenever a photo is added or removed (and once on mount). */
  onChange?: (files: File[]) => void;
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
export function PhotoInput({ name, max = 8, maxEdge = 1600, invalid, allowUpload, dropzone, accept = "image/*", onChange, className }: PhotoInputProps) {
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(photos.map((p) => p.file));
  }, [photos]);

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

  // Desktop webcam capture: browsers ignore `capture` without a touch camera, so open a live preview instead.
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stopLive = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setLive(false);
  };
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const takePhoto = async () => {
    setCamError(null);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch || !navigator.mediaDevices?.getUserMedia) {
      camera.current?.click(); // phones/tablets: native camera app
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setLive(true);
    } catch {
      setCamError("Camera unavailable — allow camera access in the browser, or use Upload images.");
    }
  };

  // Attach the stream once the <video> exists.
  useEffect(() => {
    if (live && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play();
    }
  }, [live]);

  const snap = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    await add([new File([blob], `camera-${photos.length + 1}.jpg`, { type: "image/jpeg" })]);
    if (photos.length + 1 >= max) stopLive();
  };

  const add = async (files: ArrayLike<File> | null, source: React.RefObject<HTMLInputElement | null> = picker) => {
    if (!files?.length) return;
    setBusy(true);
    const room = Math.max(0, max - photos.length);
    const compressed = await Promise.all(Array.from(files).slice(0, room).map((f) => compress(f, maxEdge)));
    setPhotos((prev) => [...prev, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setBusy(false);
    if (source.current) source.current.value = "";
  };

  // Full-size preview in a nested native dialog (stays above the form's own dialog).
  const [preview, setPreview] = useState<number | null>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const shown = preview === null ? null : photos[preview];
  useEffect(() => {
    if (shown && !lightbox.current?.open) lightbox.current?.showModal();
  }, [shown]);

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
        accept={accept}
        capture={allowUpload ? undefined : "environment"}
        multiple
        className="sr-only"
        onChange={(e) => add(e.target.files)}
        disabled={busy || photos.length >= max}
      />
      {allowUpload && (
        <input
          ref={camera}
          id={`${name}-camera`}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => add(e.target.files, camera)}
          disabled={busy || photos.length >= max}
        />
      )}
      {allowUpload && dropzone ? (
        <div
          className={cn(
            "space-y-2.5 rounded-lg border border-dashed bg-surface p-3",
            invalid ? "border-danger" : "border-border",
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Upload className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-text">{dropzone.title}</p>
              <p className="text-xs text-text-muted">Choose a file or take a photo</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label
              htmlFor={name}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-primary bg-surface px-3 text-sm font-medium text-primary transition-colors hover:bg-primary-soft",
                (busy || photos.length >= max) && "pointer-events-none opacity-60",
              )}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Choose file
            </label>
            <button
              type="button"
              onClick={takePhoto}
              disabled={busy || live || photos.length >= max}
              className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:border-primary disabled:pointer-events-none disabled:opacity-60"
            >
              <Camera className="size-4" />
              Take photo
            </button>
          </div>
        </div>
      ) : (
        <div className={cn("flex gap-2", allowUpload && "flex-col sm:flex-row")}>
          <label
            htmlFor={name}
            aria-invalid={invalid}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:border-primary aria-invalid:border-danger",
              (busy || photos.length >= max) && "pointer-events-none opacity-60",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : allowUpload ? <ImagePlus className="size-4" /> : <Camera className="size-4" />}
            {photos.length >= max ? `${max} photos added` : allowUpload ? "Upload images" : "Add photos (auto-compressed)"}
          </label>
          {allowUpload && (
            <button
              type="button"
              onClick={takePhoto}
              disabled={busy || live || photos.length >= max}
              className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:border-primary disabled:pointer-events-none disabled:opacity-60"
            >
              <Camera className="size-4" />
              Take photo
            </button>
          )}
        </div>
      )}
      {camError && <p className="mt-1 text-xs text-danger">{camError}</p>}
      {live && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-muted p-2">
          <video ref={video} playsInline muted className="max-h-72 w-full rounded-md bg-black object-contain" />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={stopLive}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={snap}
              disabled={busy}
              className="flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              <Camera className="size-4" />
              Capture
            </button>
          </div>
        </div>
      )}
      {photos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.url} className="relative">
              <button
                type="button"
                onClick={() => setPreview(i)}
                aria-label={`Preview photo ${i + 1}`}
                className="block cursor-zoom-in rounded-md"
              >
                {p.file.type === "application/pdf" ? (
                  <span className="flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-border bg-surface-muted text-text-muted">
                    <FileText className="size-6" />
                    <span className="text-[10px] font-semibold">PDF</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img src={p.url} alt={`Photo ${i + 1}`} className="size-16 rounded-md border border-border object-cover" />
                )}
              </button>
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
      <dialog
        ref={lightbox}
        // Keep these events from reaching the parent form dialog, which would close along with the preview.
        onClose={(e) => {
          e.stopPropagation();
          setPreview(null);
        }}
        onCancel={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) lightbox.current?.close();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl rounded-xl bg-transparent p-0 backdrop:bg-black/70"
      >
        {shown && (
          <div className="relative flex justify-center">
            {shown.file.type === "application/pdf" ? (
              <iframe src={shown.url} title="PDF preview" className="h-[85dvh] w-full rounded-xl bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={shown.url} alt={`Photo ${preview! + 1}`} className="max-h-[90dvh] max-w-full rounded-xl object-contain" />
            )}
            <button
              type="button"
              onClick={() => lightbox.current?.close()}
              aria-label="Close preview"
              className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
