import { promises as fs } from "node:fs";
import { basename, join, parse } from "node:path";
import { createLogger } from "@apna/logger";
import { createWorker } from "@apna/queue";
import type { JobResult } from "@apna/shared-types";
import { spawnBinary } from "@apna/utils";

const logger = createLogger("document-worker");
const concurrency = Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? 1);

createWorker("documentQueue", async (job): Promise<JobResult> => {
  if (!job.data.files.length) throw new Error("No input file");
  await job.updateProgress(10);

  if (["image-to-text", "handwritten-text-detection", "extract-table-data"].includes(job.data.tool)) {
    return runOcr(job.data.tool, job.data.files[0].path, job.data.outputDir, String(job.id));
  }
  if (job.data.tool === "pdf-ocr") return pdfOcr(job.data.files[0].path, job.data.outputDir, String(job.id));

  return libreOfficeToPdf(job.data.files[0].path, job.data.outputDir, job.data.tool, String(job.id));
}, concurrency).on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "document job failed");
});

async function libreOfficeToPdf(inputPath: string, outputDir: string, tool: string, jobId: string): Promise<JobResult> {
  await spawnBinary("soffice", ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath], 300_000);
  const converted = (await fs.readdir(outputDir)).find((file) => file.endsWith(".pdf"));
  if (!converted) throw new Error("LibreOffice did not produce a PDF");
  const outputName = `${tool}-${jobId}.pdf`;
  const outputPath = join(outputDir, outputName);
  await fs.rename(join(outputDir, converted), outputPath);
  return { outputPath, outputName, mimeType: "application/pdf" };
}

async function runOcr(tool: string, inputPath: string, outputDir: string, jobId: string): Promise<JobResult> {
  const basePath = join(outputDir, `${tool}-${jobId}-raw`);
  await spawnBinary("tesseract", [inputPath, basePath, "-l", "eng"], 600_000);
  const rawText = await fs.readFile(`${basePath}.txt`, "utf8");
  const text = tool === "extract-table-data" ? toCsvLines(rawText) : rawText;
  const extension = tool === "extract-table-data" ? "csv" : "txt";
  const outputName = `${tool}-${jobId}.${extension}`;
  const outputPath = join(outputDir, outputName);
  await fs.writeFile(outputPath, text);
  return { outputPath, outputName, mimeType: extension === "csv" ? "text/csv" : "text/plain" };
}

async function pdfOcr(inputPath: string, outputDir: string, jobId: string): Promise<JobResult> {
  const imagePath = join(outputDir, `${parse(basename(inputPath)).name}-page.jpg`);
  await spawnBinary("gs", ["-dBATCH", "-dNOPAUSE", "-sDEVICE=jpeg", "-r180", "-dFirstPage=1", "-dLastPage=1", `-sOutputFile=${imagePath}`, inputPath], 300_000);
  return runOcr("pdf-ocr", imagePath, outputDir, jobId);
}

function toCsvLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s{2,}|\t/).map((cell) => JSON.stringify(cell)).join(","))
    .join("\n");
}
