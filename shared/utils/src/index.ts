import { createWriteStream, promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

export async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

export async function safeUnlink(path: string) {
  await fs.rm(path, { force: true, recursive: true });
}

export function resolveInside(root: string, child: string) {
  const target = resolve(root, child);
  const base = resolve(root);
  if (!target.startsWith(base)) throw new Error("Unsafe path traversal attempt");
  return target;
}

export async function writeStreamToFile(stream: NodeJS.ReadableStream, path: string) {
  await ensureDir(dirname(path));
  await pipeline(stream, createWriteStream(path));
}

export async function spawnBinary(command: string, args: string[], timeoutMs: number) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed with code ${code}: ${stderr.slice(0, 1200)}`));
    });
  });
}
