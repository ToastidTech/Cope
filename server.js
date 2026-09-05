const express = require("express");

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const requestLog = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

function corsHeaders(res) {
  const allowedOrigin = process.env.COPE_ALLOWED_ORIGIN || "*";
  res.set({
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store"
  });
}

function send(res, status, payload) {
  corsHeaders(res);
  return res.status(status).json(payload);
}

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(forwarded || req.ip || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip);

  if (!entry || now >= entry.resetAt) {
    requestLog.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true };
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return false;

  return messages.every(message =>
    message &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length > 0 &&
    message.content.length <= 4000
  );
}

async function callAnthropic(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error("Anthropic API is not configured on the server.");
    error.status = 500;
    throw error;
  }

  if (!validateMessages(body.messages)) {
    const error = new Error("Invalid conversation payload.");
    error.status = 400;
    throw error;
  }

  const requestBody = {
    model: process.env.COPE_MODEL || "claude-opus-4-8",
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 500, 1), 1000),
    messages: body.messages
  };

  if (typeof body.system === "string" && body.system.length <= 6000) {
    requestBody.system = body.system;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Anthropic API error:", response.status, data);
    const error = new Error("Cope AI could not respond right now.");
    error.status = 502;
    throw error;
  }

  return data;
}

app.options("/api/cope-ai", (req, res) => {
  corsHeaders(res);
  return res.status(204).end();
});

app.post("/api/cope-ai", async (req, res) => {
  const rate = checkRateLimit(getClientIP(req));
  if (!rate.allowed) {
    return send(res, 429, { error: "Too Many Requests", retryAfter: rate.retryAfter });
  }

  try {
    const result = await callAnthropic(req.body || {});
    return send(res, 200, result);
  } catch (error) {
    console.error("Cope AI error:", error);
    return send(res, error.status || 500, {
      error: error.message || "Cope AI is temporarily unavailable."
    });
  }
});

app.get("/health", (req, res) => {
  return res.status(200).json({ service: "cope-ai", status: "ok" });
});

app.use(express.static(__dirname, { extensions: ["html"] }));

app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(__dirname + "/index.html");
  }
  return send(res, 404, { error: "Not found." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cope / Toastid Cloud backend listening on port ${PORT}`);
});
