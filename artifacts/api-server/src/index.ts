import app from "./app";
import { logger } from "./lib/logger";
import { initScheduler } from "./routes/scheduler";
import { runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];
const port = rawPort && !Number.isNaN(Number(rawPort)) && Number(rawPort) > 0
  ? Number(rawPort)
  : 8080;

// Bootstrap SQLite schema on every startup (no-op when already up-to-date)
try {
  runMigrations();
  logger.info("Database migrations applied");
} catch (e) {
  logger.error({ err: e }, "Database migration failed — check DB path and permissions");
  process.exit(1);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await initScheduler();
    logger.info("Scheduler initialized");
  } catch (e) {
    logger.warn({ err: e }, "Scheduler init failed — will retry on next run");
  }
});
