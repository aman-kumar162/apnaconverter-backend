import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { TOOL_CONFIGS } from "@apna/constants";
import { createQueue } from "@apna/queue";
import { ensureDir, resolveInside, safeUnlink } from "@apna/utils";
import { config } from "../config.js";

export const jobsRouter: Router = Router();

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    await ensureDir(config.TEMP_UPLOAD_DIR);
    callback(null, config.TEMP_UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${nanoid(8)}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 20 },
});

jobsRouter.post("/create", upload.array("files", 20), async (req, res, next) => {
  try {
    const toolSlug = String(req.body.tool ?? "");
    const tool = TOOL_CONFIGS[toolSlug];
    if (!tool) return res.status(400).json({ error: "Unsupported tool" });

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length || files.length > tool.maxFiles) return res.status(400).json({ error: "Invalid file count" });

    const invalid = files.find((file) => !tool.acceptedMimeTypes.includes(file.mimetype) && !tool.acceptedMimeTypes.includes("application/octet-stream"));
    if (invalid) return res.status(415).json({ error: `Unsupported MIME type: ${invalid.mimetype}` });

    const outputDir = resolveInside(config.TEMP_OUTPUT_DIR, nanoid(16));
    await ensureDir(outputDir);

    const queue = createQueue(tool.queue);
    const job = await queue.add(tool.slug, {
      tool: tool.slug,
      outputDir,
      requestedAt: new Date().toISOString(),
      files: files.map((file) => ({
        originalName: file.originalname,
        path: file.path,
        mimeType: file.mimetype,
        size: file.size,
      })),
    });
    await queue.close();

    res.status(202).json({ jobId: job.id, status: "queued", queue: tool.queue });
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:id/status", async (req, res, next) => {
  try {
    const job = await findJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const state = await job.getState();
    const result = job.returnvalue as { outputName?: string } | undefined;
    res.json({
      id: job.id,
      status: state === "waiting" ? "queued" : state,
      progress: Number(job.progress || 0),
      outputName: result?.outputName,
      downloadUrl: state === "completed" ? `/api/jobs/${job.id}/download` : undefined,
      error: job.failedReason,
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.get("/:id/download", async (req, res, next) => {
  try {
    const job = await findJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    const state = await job.getState();
    if (state !== "completed") return res.status(409).json({ error: "Job is not complete" });
    const result = job.returnvalue as { outputPath: string; outputName: string; mimeType: string };
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${basename(result.outputName)}"`);
    createReadStream(result.outputPath).pipe(res);
  } catch (error) {
    next(error);
  }
});

jobsRouter.delete("/:id", async (req, res, next) => {
  try {
    const job = await findJob(req.params.id);
    if (job) {
      const data = job.data as { outputDir?: string; files?: Array<{ path: string }> };
      await Promise.all([...(data.files ?? []).map((file) => safeUnlink(file.path)), data.outputDir ? safeUnlink(data.outputDir) : Promise.resolve()]);
      await job.remove();
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

async function findJob(id: string) {
  for (const queueName of ["imageQueue", "pdfQueue", "vectorQueue", "videoQueue", "audioQueue", "documentQueue"] as const) {
    const queue = createQueue(queueName);
    const job = await queue.getJob(id);
    await queue.close();
    if (job) return job;
  }
  return null;
}
