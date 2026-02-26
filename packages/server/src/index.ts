import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { projects } from "./routes/projects";
import { workItems } from "./routes/work-items";
import { trigger } from "./routes/trigger";
import { dashboard } from "./routes/dashboard";
import { status } from "./routes/status";
import { profile } from "./routes/profile";

const app = new Hono();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: corsOrigin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Auth
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// API routes (specific paths before the catch-all /api workItems mount)
app.route("/api/projects", projects);
app.route("/api/trigger", trigger);
app.route("/api/dashboard", dashboard);
app.route("/api/status", status);
app.route("/api/profile", profile);
app.route("/api", workItems);

app.get("/", (c) => c.json({ status: "ok" }));

export default app;
