import { promises as fs } from "node:fs";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { createLogger } from "@apna/logger";
import { createWorker } from "@apna/queue";
import type { JobResult } from "@apna/shared-types";

const logger = createLogger("audio-worker");
const concurrency = Number(process.env.AUDIO_WORKER_CONCURRENCY ?? 2);

createWorker("audioQueue", async (job): Promise<JobResult> => {
  if (!job.data.files.length) throw new Error("No input file");
  const outputName = `${job.data.tool}-${job.id}.mp3`;
  const outputPath = join(job.data.outputDir, outputName);
  await job.updateProgress(10);

  if (job.data.tool === "merge-audio") {
    const listPath = join(job.data.outputDir, "inputs.txt");
    await fs.writeFile(listPath, job.data.files.map((file) => `file '${file.path.replace(/'/g, "'\\''")}'`).join("\n"));
    await execute(ffmpeg().input(listPath).inputOptions(["-f", "concat", "-safe", "0"]).audioCodec("libmp3lame").audioBitrate("160k"), outputPath, job.updateProgress.bind(job));
  } else {
    const command = ffmpeg(job.data.files[0].path).audioCodec("libmp3lame");
    if (job.data.tool === "audio-compressor") command.audioBitrate("96k");
    else if (job.data.tool === "change-audio-bitrate") command.audioBitrate("128k");
    else command.audioBitrate("160k");
    if (job.data.tool === "audio-cutter") command.setStartTime(0).duration(30);
    if (job.data.tool === "normalize-volume") command.audioFilters("loudnorm");
    if (job.data.tool === "voice-speed-changer") command.audioFilters("atempo=1.25");
    await execute(command, outputPath, job.updateProgress.bind(job));
  }

  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "audio/mpeg" };
}, concurrency).on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "audio job failed");
});

async function execute(command: ffmpeg.FfmpegCommand, outputPath: string, progress: (value: number) => Promise<void>) {
  await new Promise<void>((resolve, reject) => {
    command.on("progress", (data: { percent?: number }) => {
      progress(Math.min(95, Math.round(data.percent ?? 40))).catch(reject);
    });
    command.on("end", () => resolve());
    command.on("error", reject);
    command.save(outputPath);
  });
}
