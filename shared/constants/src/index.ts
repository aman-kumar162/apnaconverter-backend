import type { QueueName, ToolConfig, WorkerType } from "@apna/shared-types";

export const QUEUES = {
  image: "imageQueue",
  pdf: "pdfQueue",
  vector: "vectorQueue",
  video: "videoQueue",
  audio: "audioQueue",
  document: "documentQueue",
} as const;

type Input = Omit<ToolConfig, "timeoutMs"> & { timeoutMs?: number };

function config(input: Input): ToolConfig {
  return {
    timeoutMs: input.worker === "video" ? 600_000 : input.worker === "audio" ? 300_000 : input.worker === "document" ? 600_000 : 180_000,
    ...input,
  };
}

function many(slugs: string[], queue: QueueName, worker: WorkerType, acceptedMimeTypes: string[], maxFiles: number, outputExtension: string, timeoutMs?: number) {
  return Object.fromEntries(slugs.map((slug) => [slug, config({ slug, queue, worker, acceptedMimeTypes, maxFiles, outputExtension, timeoutMs })]));
}

const imageMime = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/tiff", "image/bmp", "application/octet-stream"];
const pdfMime = ["application/pdf"];
const officeMime = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/html",
];
const videoMime = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
const audioMime = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac", "audio/webm"];

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  "jpg-to-png": config({ slug: "jpg-to-png", queue: "imageQueue", worker: "image", acceptedMimeTypes: ["image/jpeg"], maxFiles: 1, outputExtension: "png" }),
  "png-to-jpg": config({ slug: "png-to-jpg", queue: "imageQueue", worker: "image", acceptedMimeTypes: ["image/png"], maxFiles: 1, outputExtension: "jpg" }),
  "webp-to-png": config({ slug: "webp-to-png", queue: "imageQueue", worker: "image", acceptedMimeTypes: ["image/webp"], maxFiles: 1, outputExtension: "png" }),
  "avif-to-jpg": config({ slug: "avif-to-jpg", queue: "imageQueue", worker: "image", acceptedMimeTypes: ["image/avif"], maxFiles: 1, outputExtension: "jpg" }),
  "tiff-converter": config({ slug: "tiff-converter", queue: "imageQueue", worker: "image", acceptedMimeTypes: ["image/tiff"], maxFiles: 1, outputExtension: "jpg" }),
  "bmp-converter": config({ slug: "bmp-converter", queue: "imageQueue", worker: "image", acceptedMimeTypes: ["image/bmp", "application/octet-stream"], maxFiles: 1, outputExtension: "png" }),
  "ico-generator": config({ slug: "ico-generator", queue: "imageQueue", worker: "image", acceptedMimeTypes: imageMime, maxFiles: 1, outputExtension: "png" }),
  "bulk-image-compression": config({ slug: "bulk-image-compression", queue: "imageQueue", worker: "image", acceptedMimeTypes: imageMime, maxFiles: 20, outputExtension: "zip" }),
  "bulk-rename": config({ slug: "bulk-rename", queue: "imageQueue", worker: "image", acceptedMimeTypes: imageMime, maxFiles: 20, outputExtension: "zip" }),
  "bulk-resize": config({ slug: "bulk-resize", queue: "imageQueue", worker: "image", acceptedMimeTypes: imageMime, maxFiles: 20, outputExtension: "zip" }),
  "bulk-format-conversion": config({ slug: "bulk-format-conversion", queue: "imageQueue", worker: "image", acceptedMimeTypes: imageMime, maxFiles: 20, outputExtension: "zip" }),
  "exif-reader": config({ slug: "exif-reader", queue: "imageQueue", worker: "image", acceptedMimeTypes: imageMime, maxFiles: 1, outputExtension: "json" }),
  ...many(["compress-image", "remove-metadata", "gps-metadata-cleaner", "instagram-size-formatter", "youtube-thumbnail-resizer", "linkedin-banner-creator"], "imageQueue", "image", imageMime, 1, "jpg"),
  ...many(["resize-image", "crop-image", "rotate-image", "flip-image", "blur-image", "sharpen-image", "grayscale-image", "watermark-image", "add-border-image"], "imageQueue", "image", imageMime, 1, "png"),

  "jpg-to-pdf": config({ slug: "jpg-to-pdf", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: ["image/jpeg"], maxFiles: 20, outputExtension: "pdf" }),
  "merge-pdf": config({ slug: "merge-pdf", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 10, outputExtension: "pdf" }),
  "split-pdf": config({ slug: "split-pdf", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "zip" }),
  "reorder-pdf": config({ slug: "reorder-pdf", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "extract-pdf-pages": config({ slug: "extract-pdf-pages", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "rotate-pdf": config({ slug: "rotate-pdf", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "compress-pdf": config({ slug: "compress-pdf", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf", timeoutMs: 240_000 }),
  "add-pdf-password": config({ slug: "add-pdf-password", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "remove-pdf-password": config({ slug: "remove-pdf-password", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "add-pdf-watermark": config({ slug: "add-pdf-watermark", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "digital-signature-support": config({ slug: "digital-signature-support", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "pdf" }),
  "extract-pdf-text": config({ slug: "extract-pdf-text", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "txt" }),
  "extract-pdf-images": config({ slug: "extract-pdf-images", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "zip", timeoutMs: 240_000 }),
  "pdf-to-image": config({ slug: "pdf-to-image", queue: "pdfQueue", worker: "pdf", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "zip", timeoutMs: 240_000 }),

  ...many(["word-to-pdf", "excel-to-pdf", "ppt-to-pdf", "html-to-pdf", "docx-conversion", "ppt-conversion", "spreadsheet-export", "template-filling"], "documentQueue", "document", officeMime, 1, "pdf", 300_000),
  ...many(["image-to-text", "handwritten-text-detection"], "documentQueue", "document", imageMime, 1, "txt", 600_000),
  "extract-table-data": config({ slug: "extract-table-data", queue: "documentQueue", worker: "document", acceptedMimeTypes: [...imageMime, ...pdfMime], maxFiles: 1, outputExtension: "csv", timeoutMs: 600_000 }),
  "pdf-ocr": config({ slug: "pdf-ocr", queue: "documentQueue", worker: "document", acceptedMimeTypes: pdfMime, maxFiles: 1, outputExtension: "txt", timeoutMs: 600_000 }),

  ...many(["cdr-preview", "cdr-to-png"], "vectorQueue", "vector", ["application/octet-stream", "application/x-coreldraw"], 1, "png", 240_000),
  "cdr-to-jpg": config({ slug: "cdr-to-jpg", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["application/octet-stream", "application/x-coreldraw"], maxFiles: 1, outputExtension: "jpg", timeoutMs: 240_000 }),
  "cdr-to-pdf": config({ slug: "cdr-to-pdf", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["application/octet-stream", "application/x-coreldraw"], maxFiles: 1, outputExtension: "pdf", timeoutMs: 240_000 }),
  "svg-to-png": config({ slug: "svg-to-png", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["image/svg+xml"], maxFiles: 1, outputExtension: "png" }),
  "eps-to-pdf": config({ slug: "eps-to-pdf", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["application/postscript"], maxFiles: 1, outputExtension: "pdf" }),
  "ai-to-png": config({ slug: "ai-to-png", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["application/postscript", "application/vnd.adobe.illustrator", "application/vnd.adobe.illustrator.drawing.document"], maxFiles: 1, outputExtension: "png", timeoutMs: 240_000 }),
  "ai-to-pdf": config({ slug: "ai-to-pdf", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["application/postscript", "application/vnd.adobe.illustrator", "application/vnd.adobe.illustrator.drawing.document"], maxFiles: 1, outputExtension: "pdf", timeoutMs: 240_000 }),
  "vector-optimizer": config({ slug: "vector-optimizer", queue: "vectorQueue", worker: "vector", acceptedMimeTypes: ["image/svg+xml"], maxFiles: 1, outputExtension: "svg" }),

  ...many(["compress-video", "mp4-converter", "mov-to-mp4", "webm-converter", "trim-video", "resize-video", "change-video-fps", "change-video-bitrate", "remove-audio", "replace-audio", "normalize-video-audio", "add-subtitles", "burn-subtitles"], "videoQueue", "video", [...videoMime, ...audioMime, "text/plain", "application/x-subrip"], 2, "mp4", 600_000),
  "merge-videos": config({ slug: "merge-videos", queue: "videoQueue", worker: "video", acceptedMimeTypes: videoMime, maxFiles: 10, outputExtension: "mp4", timeoutMs: 600_000 }),
  "video-to-gif": config({ slug: "video-to-gif", queue: "videoQueue", worker: "video", acceptedMimeTypes: videoMime, maxFiles: 1, outputExtension: "gif", timeoutMs: 600_000 }),
  "extract-thumbnail": config({ slug: "extract-thumbnail", queue: "videoQueue", worker: "video", acceptedMimeTypes: videoMime, maxFiles: 1, outputExtension: "jpg", timeoutMs: 240_000 }),
  "extract-frames": config({ slug: "extract-frames", queue: "videoQueue", worker: "video", acceptedMimeTypes: videoMime, maxFiles: 1, outputExtension: "zip", timeoutMs: 600_000 }),
  "extract-audio": config({ slug: "extract-audio", queue: "videoQueue", worker: "video", acceptedMimeTypes: videoMime, maxFiles: 1, outputExtension: "mp3", timeoutMs: 600_000 }),
  "extract-subtitles": config({ slug: "extract-subtitles", queue: "videoQueue", worker: "video", acceptedMimeTypes: videoMime, maxFiles: 1, outputExtension: "srt", timeoutMs: 600_000 }),

  ...many(["mp3-converter", "audio-compressor", "audio-cutter", "merge-audio", "normalize-volume", "change-audio-bitrate", "voice-speed-changer"], "audioQueue", "audio", audioMime, 10, "mp3", 300_000),
};
