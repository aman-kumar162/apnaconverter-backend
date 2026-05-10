import { promises as fs } from "node:fs";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import archiver from "archiver";
import type { Job } from "bullmq";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import PDFKit from "pdfkit";
import { createLogger } from "@apna/logger";
import { createWorker } from "@apna/queue";
import type { ConversionJobData, JobResult } from "@apna/shared-types";
import { spawnBinary } from "@apna/utils";

const logger = createLogger("pdf-worker");
const concurrency = Number(process.env.PDF_WORKER_CONCURRENCY ?? 2);

createWorker("pdfQueue", async (job): Promise<JobResult> => {
  await job.updateProgress(10);
  if (job.data.tool === "merge-pdf") return mergePdf(job);
  if (job.data.tool === "split-pdf") return splitPdf(job);
  if (job.data.tool === "reorder-pdf") return reorderPdf(job);
  if (job.data.tool === "extract-pdf-pages") return extractPdfPages(job);
  if (job.data.tool === "rotate-pdf") return rotatePdf(job);
  if (job.data.tool === "compress-pdf") return compressPdf(job);
  if (job.data.tool === "add-pdf-password") return passwordPdf(job, "encrypt");
  if (job.data.tool === "remove-pdf-password") return passwordPdf(job, "decrypt");
  if (job.data.tool === "add-pdf-watermark") return addWatermark(job);
  if (job.data.tool === "digital-signature-support") return signatureStamp(job);
  if (job.data.tool === "extract-pdf-text") return extractPdfText(job);
  if (job.data.tool === "extract-pdf-images") return pdfToImage(job);
  if (job.data.tool === "jpg-to-pdf") return jpgToPdf(job);
  if (job.data.tool === "pdf-to-image") return pdfToImage(job);
  throw new Error(`Unsupported PDF tool: ${job.data.tool}`);
}, concurrency).on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "pdf job failed");
});

type ConversionJob = Job<ConversionJobData>;

async function mergePdf(job: ConversionJob): Promise<JobResult> {
  const merged = await PDFDocument.create();
  for (const file of job.data.files) {
    const source = await PDFDocument.load(await fs.readFile(file.path));
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const outputName = `merge-pdf-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, await merged.save());
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function rotatePdf(job: ConversionJob): Promise<JobResult> {
  const source = await PDFDocument.load(await fs.readFile(job.data.files[0].path));
  source.getPages().forEach((page) => page.setRotation(degrees(90)));
  const outputName = `rotate-pdf-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, await source.save());
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function splitPdf(job: ConversionJob): Promise<JobResult> {
  const source = await PDFDocument.load(await fs.readFile(job.data.files[0].path));
  const pagePaths: string[] = [];
  for (const index of source.getPageIndices()) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(source, [index]);
    doc.addPage(page);
    const path = join(job.data.outputDir, `page-${index + 1}.pdf`);
    await fs.writeFile(path, await doc.save());
    pagePaths.push(path);
  }
  const outputName = `split-pdf-${job.id}.zip`;
  const outputPath = join(job.data.outputDir, outputName);
  await zipFiles(outputPath, pagePaths);
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/zip" };
}

async function reorderPdf(job: ConversionJob): Promise<JobResult> {
  const source = await PDFDocument.load(await fs.readFile(job.data.files[0].path));
  const reordered = await PDFDocument.create();
  const indices = source.getPageIndices().reverse();
  const pages = await reordered.copyPages(source, indices);
  pages.forEach((page) => reordered.addPage(page));
  const outputName = `reorder-pdf-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, await reordered.save());
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function extractPdfPages(job: ConversionJob): Promise<JobResult> {
  const source = await PDFDocument.load(await fs.readFile(job.data.files[0].path));
  const extracted = await PDFDocument.create();
  const [firstPage] = await extracted.copyPages(source, [0]);
  extracted.addPage(firstPage);
  const outputName = `extract-pdf-pages-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, await extracted.save());
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function compressPdf(job: ConversionJob): Promise<JobResult> {
  const outputName = `compress-pdf-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await spawnBinary("gs", ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dPDFSETTINGS=/ebook", "-dNOPAUSE", "-dQUIET", "-dBATCH", `-sOutputFile=${outputPath}`, job.data.files[0].path], 180_000);
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function addWatermark(job: ConversionJob): Promise<JobResult> {
  const doc = await PDFDocument.load(await fs.readFile(job.data.files[0].path));
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    page.drawText("ApnaConverter", {
      x: width / 2 - 130,
      y: height / 2,
      size: 42,
      color: rgb(0.15, 0.38, 0.92),
      opacity: 0.18,
      rotate: degrees(-28),
    });
  }
  const outputName = `add-pdf-watermark-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, await doc.save());
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function signatureStamp(job: ConversionJob): Promise<JobResult> {
  const doc = await PDFDocument.load(await fs.readFile(job.data.files[0].path));
  const firstPage = doc.getPages()[0];
  const { width } = firstPage.getSize();
  firstPage.drawText("Approved with ApnaConverter", {
    x: Math.max(40, width - 280),
    y: 48,
    size: 16,
    color: rgb(0.06, 0.45, 0.34),
  });
  const outputName = `digital-signature-support-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  await fs.writeFile(outputPath, await doc.save());
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function passwordPdf(job: ConversionJob, mode: "encrypt" | "decrypt"): Promise<JobResult> {
  const outputName = `${mode === "encrypt" ? "add-pdf-password" : "remove-pdf-password"}-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  if (mode === "encrypt") {
    await spawnBinary("qpdf", ["--encrypt", "apna123", "apna123", "256", "--", job.data.files[0].path, outputPath], 120_000);
  } else {
    await spawnBinary("qpdf", ["--password=apna123", "--decrypt", job.data.files[0].path, outputPath], 120_000);
  }
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function extractPdfText(job: ConversionJob): Promise<JobResult> {
  const outputName = `extract-pdf-text-${job.id}.txt`;
  const outputPath = join(job.data.outputDir, outputName);
  await spawnBinary("pdftotext", [job.data.files[0].path, outputPath], 120_000);
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "text/plain" };
}

async function jpgToPdf(job: ConversionJob): Promise<JobResult> {
  const outputName = `jpg-to-pdf-${job.id}.pdf`;
  const outputPath = join(job.data.outputDir, outputName);
  const doc = new PDFKit({ autoFirstPage: false });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  for (const file of job.data.files) {
    doc.addPage({ size: "A4", margin: 0 });
    doc.image(file.path, 0, 0, { fit: [595, 842], align: "center", valign: "center" });
  }
  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));
  await fs.writeFile(outputPath, Buffer.concat(chunks));
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function pdfToImage(job: ConversionJob): Promise<JobResult> {
  const imagePattern = join(job.data.outputDir, `page-%03d.jpg`);
  await spawnBinary("gs", ["-dBATCH", "-dNOPAUSE", "-sDEVICE=jpeg", "-r144", `-sOutputFile=${imagePattern}`, job.data.files[0].path], 180_000);
  const files = (await fs.readdir(job.data.outputDir))
    .filter((file) => file.endsWith(".jpg"))
    .map((file) => join(job.data.outputDir, file));
  const outputName = `pdf-to-image-${job.id}.zip`;
  const outputPath = join(job.data.outputDir, outputName);
  await zipFiles(outputPath, files);
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/zip" };
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
