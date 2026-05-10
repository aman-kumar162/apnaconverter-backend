import { join } from "node:path";
import { promises as fs } from "node:fs";
import { optimize } from "svgo";
import { createLogger } from "@apna/logger";
import { createWorker } from "@apna/queue";
import type { JobResult } from "@apna/shared-types";
import { spawnBinary } from "@apna/utils";

const logger = createLogger("vector-worker");
const concurrency = Number(process.env.VECTOR_WORKER_CONCURRENCY ?? 1);

createWorker("vectorQueue", async (job): Promise<JobResult> => {
  const input = job.data.files[0];
  if (!input) throw new Error("No input file");
  const extension = outputExtension(job.data.tool);
  const outputName = `${job.data.tool}-${job.id}.${extension}`;
  const outputPath = join(job.data.outputDir, outputName);
  await job.updateProgress(20);

  if (job.data.tool.startsWith("cdr")) {
    const intermediateSvg = join(job.data.outputDir, `${job.id}.svg`);
    await spawnBinary("uniconvertor", [input.path, intermediateSvg], 180_000);
    await job.updateProgress(55);
    if (extension === "jpg") {
      const pngPath = join(job.data.outputDir, `${job.id}.png`);
      await exportWithInkscape(intermediateSvg, pngPath, "png");
      await spawnBinary("convert", [pngPath, "-quality", "88", outputPath], 60_000);
    } else {
      await exportWithInkscape(intermediateSvg, outputPath, extension);
    }
  } else if (job.data.tool === "svg-to-png") {
    await exportWithInkscape(input.path, outputPath, "png");
  } else if (job.data.tool === "eps-to-pdf") {
    await spawnBinary("gs", ["-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", `-sOutputFile=${outputPath}`, input.path], 120_000);
  } else if (job.data.tool === "vector-optimizer") {
    const result = optimize(await fs.readFile(input.path, "utf8"), { multipass: true });
    await fs.writeFile(outputPath, result.data);
  } else {
    throw new Error(`Unsupported vector tool: ${job.data.tool}`);
  }

  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: mimeType(extension) };
}, concurrency).on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "vector job failed");
});

async function exportWithInkscape(input: string, output: string, extension: string) {
  if (extension === "pdf") await spawnBinary("inkscape", [input, "--export-type=pdf", `--export-filename=${output}`], 120_000);
  else await spawnBinary("inkscape", [input, `--export-type=${extension}`, `--export-filename=${output}`], 120_000);
}

function outputExtension(tool: string) {
  if (tool.endsWith("pdf")) return "pdf";
  if (tool.endsWith("jpg")) return "jpg";
  if (tool === "vector-optimizer") return "svg";
  return "png";
}

function mimeType(extension: string) {
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg") return "image/jpeg";
  if (extension === "svg") return "image/svg+xml";
  return "image/png";
}
