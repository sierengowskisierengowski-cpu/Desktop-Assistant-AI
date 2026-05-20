import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: (origin, callback) => {
    // No origin = same-origin or non-browser request (e.g. Electron IPC, curl)
    if (!origin) return callback(null, true);
    let hostname: string;
    try {
      hostname = new URL(origin).hostname;
    } catch {
      return callback(new Error("CORS: malformed origin"));
    }
    const allowed =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".replit.dev") ||
      hostname.endsWith(".repl.co") ||
      hostname.endsWith(".replit.app");
    if (allowed) return callback(null, true);
    callback(new Error("CORS: origin not permitted"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
