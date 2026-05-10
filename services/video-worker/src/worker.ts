import { createWriteStream, promises as fs } from "node:fs";
import { join } from "node:path";
import archiver from "archiver";
import ffmpeg from "fluent-ffmpeg";
import { createLogger } from "@apna/logger";
import { createWorker } from "@apna/queue";
import type { ConversionJobData, JobResult } from "@apna/shared-types";
import type { Job } from "bullmq";

const logger = createLogger("video-worker");
const concurrency = Number(process.env.VIDEO_WORKER_CONCURRENCY ?? 1);

type ConversionJob = Job<ConversionJobData>;

createWorker("videoQueue", async (job): Promise<JobResult> => {
  const input = job.data.files[0];
  if (!input) throw new Error("No input file");
  await job.updateProgress(10);

  if (job.data.tool === "extract-frames") return extractFrames(job);
  if (job.data.tool === "extract-subtitles") return extractSubtitles(job);
  if (job.data.tool === "merge-videos") return mergeVideos(job);

  const extension = extensionFor(job.data.tool);
  const outputName = `${job.data.tool}-${job.id}.${extension}`;
  const outputPath = join(job.data.outputDir, outputName);

  if (job.data.tool === "extract-thumbnail") {
    await screenshot(input.path, job.data.outputDir, outputName);
  } else {
    await execute(buildCommand(job, outputPath), outputPath, job.updateProgress.bind(job));
  }

  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: mimeType(extension) };
}, concurrency).on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "video job failed");
});

function buildCommand(job: ConversionJob, outputPath: string) {
  const input = job.data.files[0];
  const second = job.data.files[1];
  const command = ffmpeg(input.path);

  if (job.data.tool === "video-to-gif") return command.outputOptions(["-vf", "fps=12,scale=640:-1:flags=lanczos", "-loop", "0"]);
  if (job.data.tool === "extract-audio") return command.noVideo().audioCodec("libmp3lame").audioBitrate("160k");
  if (job.data.tool === "remove-audio") return command.noAudio().videoCodec("libx264").outputOptions(["-preset", "veryfast", "-movflags", "+faststart"]);
  if (job.data.tool === "resize-video") command.size("1280x?");
  if (job.data.tool === "change-video-fps") command.fps(30);
  if (job.data.tool === "change-video-bitrate") command.videoBitrate("1800k");
  if (job.data.tool === "trim-video") command.setStartTime(0).duration(30);
  if (job.data.tool === "normalize-video-audio") command.audioFilters("loudnorm");
  if (job.data.tool === "replace-audio" && second) command.input(second.path).outputOptions(["-map", "0:v:0", "-map", "1:a:0", "-shortest"]);
  if ((job.data.tool === "add-subtitles" || job.data.tool === "burn-subtitles") && second) {
    command.input(second.path);
    if (job.data.tool === "burn-subtitles") command.videoFilters(`subtitles=${second.path.replace(/\\/g, "\\\\").replace(/:/g, "\\:")}`);
  }

  if (!["video-to-gif", "extract-audio"].includes(job.data.tool)) {
    command.videoCodec("libx264").audioCodec("aac").outputOptions(["-preset", "veryfast", "-crf", job.data.tool === "compress-video" ? "28" : "23", "-movflags", "+faststart"]);
  }
  return command;
}

async function execute(command: ffmpeg.FfmpegCommand, outputPath: string, progress: (value: number) => Promise<void>) {
  await new Promise<void>((resolve, reject) => {
    command.on("progress", (data: { percent?: number }) => progress(Math.min(95, Math.round(data.percent ?? 40))));
    command.on("end", () => resolve());
    command.on("error", reject);
    command.save(outputPath);
  });
}

async function screenshot(inputPath: string, outputDir: string, outputName: string) {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .screenshots({ count: 1, filename: outputName, folder: outputDir, size: "1280x?" });
  });
}

async function extractFrames(job: ConversionJob): Promise<JobResult> {
  const pattern = join(job.data.outputDir, "frame-%03d.jpg");
  await new Promise<void>((resolve, reject) => {
    ffmpeg(job.data.files[0].path)
      .outputOptions(["-vf", "fps=1"])
      .on("progress", (data: { percent?: number }) => job.updateProgress(Math.min(95, Math.round(data.percent ?? 40))))
      .on("end", () => resolve())
      .on("error", reject)
      .output(pattern)
      .run();
  });
  const frames = (await fs.readdir(job.data.outputDir)).filter((file: string) => file.endsWith(".jpg")).map((file: string) => join(job.data.outputDir, file));
  const outputName = `extract-frames-${job.id}.zip`;
  const outputPath = join(job.data.outputDir, outputName);
  await zipFiles(outputPath, frames);
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/zip" };
}

async function mergeVideos(job: ConversionJob): Promise<JobResult> {
  const outputName = `merge-videos-${job.id}.mp4`;
  const outputPath = join(job.data.outputDir, outputName);
  const listPath = join(job.data.outputDir, "videos.txt");
  await fs.writeFile(listPath, job.data.files.map((file) => `file '${file.path.replace(/'/g, "'\\''")}'`).join("\n"));
  await execute(ffmpeg().input(listPath).inputOptions(["-f", "concat", "-safe", "0"]).videoCodec("libx264").audioCodec("aac").outputOptions(["-preset", "veryfast", "-movflags", "+faststart"]), outputPath, job.updateProgress.bind(job));
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "video/mp4" };
}

async function extractSubtitles(job: ConversionJob): Promise<JobResult> {
  const outputName = `extract-subtitles-${job.id}.srt`;
  const outputPath = join(job.data.outputDir, outputName);
  await execute(ffmpeg(job.data.files[0].path).noVideo().noAudio().outputOptions(["-map", "0:s:0?"]).format("srt"), outputPath, job.updateProgress.bind(job));
  await job.updateProgress(100);
  return { outputPath, outputName, mimeType: "application/x-subrip" };
}

function extensionFor(tool: string) {
  if (tool === "video-to-gif") return "gif";
  if (tool === "extract-thumbnail") return "jpg";
  if (tool === "extract-audio") return "mp3";
  return "mp4";
}

function mimeType(extension: string) {
  if (extension === "gif") return "image/gif";
  if (extension === "jpg") return "image/jpeg";
  if (extension === "mp3") return "audio/mpeg";
  return "video/mp4";
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
