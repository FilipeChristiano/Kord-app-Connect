import express, { type Express } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";

const app: Express = express();

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const requestHosts = [
      req.headers.host,
      ...(typeof req.headers["x-forwarded-host"] === "string"
        ? req.headers["x-forwarded-host"].split(",").map((h) => h.trim())
        : []),
    ].filter(Boolean);

    let allowed = false;
    // Same-origin requests (no Origin header) — always allow
    if (!origin) {
      allowed = true;
    } else {
      let originHostname = "";
      let originHost = "";
      try {
        const url = new URL(origin);
        originHostname = url.hostname;
        originHost = url.host;
      } catch {
        // Malformed Origin header — not allowed
      }
      allowed =
        // Explicit allowlist via env var
        allowedOrigins.includes(origin) ||
        // Same-origin: the Origin host matches the host serving this request
        // (covers custom domains like kordi.app.br automatically)
        requestHosts.includes(originHost) ||
        // Replit dev/preview/deploy domains
        /\.replit\.(dev|app|co)$/i.test(originHostname) ||
        /\.repl\.co$/i.test(originHostname);
    }

    if (!allowed) {
      return callback(new Error(`CORS blocked: ${origin}`));
    }
    callback(null, { credentials: true, origin: true });
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
