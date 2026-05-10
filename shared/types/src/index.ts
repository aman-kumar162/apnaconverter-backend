export type QueueName = "imageQueue" | "pdfQueue" | "vectorQueue" | "videoQueue" | "audioQueue" | "documentQueue";
export type JobStatus = "queued" | "active" | "completed" | "failed" | "expired";
export type WorkerType = "image" | "pdf" | "vector" | "video" | "audio" | "document";

export type ToolConfig = {
  slug: string;
  queue: QueueName;
  worker: WorkerType;
  acceptedMimeTypes: string[];
  maxFiles: number;
  outputExtension: string;
  timeoutMs: number;
};

export type ConversionJobData = {
  tool: string;
  files: Array<{ originalName: string; path: string; mimeType: string; size: number }>;
  outputDir: string;
  requestedAt: string;
};

export type JobResult = {
  outputPath: string;
  outputName: string;
  mimeType: string;
};
