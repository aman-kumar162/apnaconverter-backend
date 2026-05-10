import { promises as fs } from "node:fs";
import { join } from "node:path";

const roots = [process.env.TEMP_UPLOAD_DIR ?? "/tmp/uploads", process.env.TEMP_OUTPUT_DIR ?? "/tmp/output"];
const ttlMs = Number(process.env.JOB_TTL_MINUTES ?? 30) * 60 * 1000;
const now = Date.now();

for (const root of roots) {
  await fs.mkdir(root, { recursive: true });
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    const stat = await fs.stat(path);
    if (now - stat.mtimeMs > ttlMs) await fs.rm(path, { recursive: true, force: true });
  }
}
