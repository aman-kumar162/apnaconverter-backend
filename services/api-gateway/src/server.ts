import { ensureDir } from "@apna/utils";
import { createLogger } from "@apna/logger";
import { createApp } from "./app.js";
import { config } from "./config.js";

const logger = createLogger("api-gateway");

await Promise.all([ensureDir(config.TEMP_UPLOAD_DIR), ensureDir(config.TEMP_OUTPUT_DIR)]);

createApp().listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "api-gateway listening");
});
