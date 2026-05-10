import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  TEMP_UPLOAD_DIR: z.string().default("/tmp/uploads"),
  TEMP_OUTPUT_DIR: z.string().default("/tmp/output"),
  MAX_UPLOAD_MB: z.coerce.number().default(50),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export const config = schema.parse(process.env);
