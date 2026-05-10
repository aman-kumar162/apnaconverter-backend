import { createWriteStream, promises as fs } from "node:fs";
import { extname, join } from "node:path";
import archiver from "archiver";
import sharp from "sharp";
import { createLogger } from "@apna/logger";
import { createWorker } from "@apna/queue";
import type { ConversionJobData, JobResult } from "@apna/shared-types";
import type { Job } from "bullmq";

const logger = createLogger("image-worker");
const concurrency = Number(process.env.IMAGE_WORKER_CONCURRENCY ?? 4);

type ConversionJob = Job<ConversionJobData>;

createWorker("imageQueue", async (job): Promise<JobResult> => {
  if (!job.data.files.length) throw new Error("No input file");
  await job.updateProgress(10);

  if (job.data.tool.startsWith("bulk-")) return processBulk(job);
  if (job.data.tool === "exif-reader") return readExif(job);

  const input = job.data.files[0];
  const extension = outputExtension(job.data.tool);
  const outputName = `${job.data.tool}-${job.id}.${extension}`;
  const outputPath = join(job.data.outputDir, outputName);
  await processOne(job.data.tool, input.path, outputPath, extension);
  await job.updateProgress(100);

  return { outputPath, outputName, mimeType: mimeType(extension) };
}, concurrency).on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "image job failed");
});

async function processBulk(job: ConversionJob): Promise<JobResult> {
  const outputName = `${job.data.tool}-${job.id}.zip`;
  const outputPath = join(job.data.outputDir, outputName);
  const generated: string[] = [];

  for (const [index, file] of job.data.files.entries()) {
    const ext = job.data.tool === "bulk-format-conversion" ? "png" : "jpg";
    const name = job.data.tool === "bulk-rename" ? `image-${index + 1}${extname(file.originalName) || ".jpg"}` : `image-${index + 1}.${ext}`;
    const target = join(job.data.outputDir, name);
    if (job.data.tool === "bulk-rename") await fs.copyFile(file.path, target);
    else await processOne(job.data.tool, file.path, target, ext);
    generated.push(target);
    await job.updateProgress(Math.min(95, Math.round(((index + 1) / job.data.files.length) * 90)));
  }

  await zipFiles(outputPath, generated);
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/zip" };
}

async function readExif(job: ConversionJob): Promise<JobResult> {
  const metadata = await sharp(job.data.files[0].path).metadata();
  const outputName = `exif-reader-${job.id}.json`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2));
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/json" };
}

async function processOne(tool: string, inputPath: string, outputPath: string, extension: string) {
  let image = sharp(inputPath, { limitInputPixels: 100_000_000 }).rotate();

  if (tool === "resize-image" || tool === "bulk-resize") image = image.resize({ width: 1200, withoutEnlargement: true });
  if (tool === "crop-image") image = image.resize(1080, 1080, { fit: "cover" });
  if (tool === "rotate-image") image = image.rotate(90);
  if (tool === "flip-image") image = image.flop();
  if (tool === "blur-image") image = image.blur(8);
  if (tool === "sharpen-image") image = image.sharpen();
  if (tool === "grayscale-image") image = image.grayscale();
  if (tool === "watermark-image") image = image.composite([{ input: watermarkSvg(), gravity: "southeast" }]);
  if (tool === "add-border-image") image = image.extend({ top: 24, bottom: 24, left: 24, right: 24, background: "#ffffff" });
  if (tool === "instagram-size-formatter") image = image.resize(1080, 1080, { fit: "contain", background: "#ffffff" });
  if (tool === "youtube-thumbnail-resizer") image = image.resize(1280, 720, { fit: "cover" });
  if (tool === "linkedin-banner-creator") image = image.resize(1584, 396, { fit: "cover" });

  if (extension === "png") await image.png({ compressionLevel: 9 }).toFile(outputPath);
  else if (extension === "webp") await image.webp({ quality: 82 }).toFile(outputPath);
  else if (extension === "avif") await image.avif({ quality: 72 }).toFile(outputPath);
  else if (extension === "tiff") await image.tiff({ quality: 82 }).toFile(outputPath);
  else await image.jpeg({ quality: tool.includes("compress") ? 76 : 88, mozjpeg: true }).toFile(outputPath);
}

function outputExtension(tool: string) {
  if (["jpg-to-png", "webp-to-png", "bmp-converter", "ico-generator", "resize-image", "crop-image", "rotate-image", "flip-image", "blur-image", "sharpen-image", "grayscale-image", "watermark-image", "add-border-image"].includes(tool)) return "png";
  if (tool === "avif-to-jpg" || tool === "tiff-converter" || tool.includes("compress") || tool.includes("metadata") || tool.includes("formatter") || tool.includes("thumbnail") || tool.includes("banner")) return "jpg";
  return "jpg";
}

function mimeType(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  if (extension === "tiff") return "image/tiff";
  return "image/jpeg";
}

function watermarkSvg() {
  return Buffer.from(`<svg width="360" height="90" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="90" rx="18" fill="rgba(15,23,42,0.58)"/><text x="28" y="56" font-family="Arial" font-size="28" font-weight="700" fill="white">ApnaConverter</text></svg>`);
}

async function zipFiles(outputPath: string, paths: string[]) {
  await new Promise<void>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = createWriteStream(outputPath);
    stream.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(stream);
    for (const path of paths) archive.file(path, { name: path.split(/[\\/]/).pop() ?? "file" });
    archive.finalize().catch(reject);
  });
}
