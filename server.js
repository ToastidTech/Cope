const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const requestLog = new Map();
const LEADS_FILE = process.env.COPE_LEADS_FILE || path.join(__dirname, "data", "leads.jsonl");
const PROMOS_FILE = process.env.COPE_PROMOS_FILE || path.join(__dirname, "data", "promos.jsonl");
const MASTER_PROMO_CODE = String(process.env.COPE_MASTER_PROMO_CODE || "TST2026").trim().toLowerCase();
const AI_PROMO_CODE = String(process.env.COPE_AI_PROMO_CODE || "COPEAI3DAY").trim().toLowerCase();
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

function corsHeaders(res) {
  const allowedOrigin = process.env.COPE_ALLOWED_ORIGIN || "*";
  res.set({
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store"
  });
}
function send(res, status, payload) { corsHeaders(res); return res.status(status).json(payload); }
function getClientIP(req) { const forwarded = req.headers["x-forwarded-for"]; return String(forwarded || req.ip || req.socket.remoteAddress || "unknown").split(",")[0].trim(); }
function checkRateLimit(ip) {
  const now = Date.now(); const entry = requestLog.get(ip);
  if (!entry || now >= entry.resetAt) { requestLog.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS }); return { allowed: true }; }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  return { allowed: true };
}
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return false;
  return messages.every(message => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.length > 0 && message.content.length <= 4000);
}
function validateLead(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  if (!name || name.length > 120) return null;
  if (!email || email.length > 254 || !/^([^\s@]+)@([^\s@]+)\.[^\s@]+$/.test(email)) return null;
  if (comment.length > 2000) return null;
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(deviceId)) return null;
  return { name, email, comment, deviceId, submittedAt: new Date().toISOString() };
}
function validateDeviceId(deviceId) { return typeof deviceId === "string" && /^[A-Za-z0-9._:-]{16,200}$/.test(deviceId.trim()); }
async function appendJsonLine(file, value) { await fs.promises.mkdir(path.dirname(file), { recursive: true }); await fs.promises.appendFile(file, JSON.stringify(value) + "\n", "utf8"); }
async function saveLead(lead) { await appendJsonLine(LEADS_FILE, lead); }
async function savePromo(promo) { await appendJsonLine(PROMOS_FILE, promo); }
async function readPromosByDevice(deviceId) {
  const rows = [];
  try {
    const text = await fs.promises.readFile(PROMOS_FILE, "utf8");
    for (const line of text.split("\n").filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        if (row.deviceId === deviceId) rows.push(row);
      } catch (_) {}
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return rows;
}
async function findLeadTrialByDevice(deviceId) {
  const rows = await readPromosByDevice(deviceId);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].scope === "standard" && Number(rows[i].expiresAt) > 0) return rows[i];
  }
  return null;
}
async function activateLeadTrial(deviceId, email = null) {
  const existing = await findLeadTrialByDevice(deviceId);
  if (existing && Number(existing.expiresAt) > Date.now()) return existing;
  const activatedAt = Date.now();
  const promo = { deviceId, email, code: "lead-capture", activatedAt, expiresAt: activatedAt + TRIAL_DURATION_MS, durationDays: 3, scope: "standard", source: "lead-capture", createdAt: new Date(activatedAt).toISOString() };
  await savePromo(promo);
  return promo;
}
async function activateCode(deviceId, code) {
  const now = Date.now();
  const rows = await readPromosByDevice(deviceId);

  if (code === MASTER_PROMO_CODE) {
    const existing = rows.find(row => row.scope === "master");
    if (existing) return existing;
    const promo = { deviceId, code: MASTER_PROMO_CODE, scope: "master", activatedAt: now, expiresAt: null, durationDays: null, source: "promo-code", createdAt: new Date(now).toISOString() };
    await savePromo(promo);
    return promo;
  }

  if (code === AI_PROMO_CODE) {
    const existing = rows.find(row => row.scope === "ai" && Number(row.expiresAt) > now);
    if (existing) return existing;
    const promo = { deviceId, code: AI_PROMO_CODE, scope: "ai", activatedAt: now, expiresAt: now + TRIAL_DURATION_MS, durationDays: 3, source: "promo-code", createdAt: new Date(now).toISOString() };
    await savePromo(promo);
    return promo;
  }

  return null;
}
async function getAccessState(deviceId) {
  const rows = await readPromosByDevice(deviceId);
  const master = rows.some(row => row.scope === "master");
  const standard = rows.some(row => row.scope === "standard" && Number(row.expiresAt) > Date.now());
  const ai = rows.some(row => row.scope === "ai" && Number(row.expiresAt) > Date.now());
  return { master, standard: master || standard || ai, ai: master || ai };
}
async function callAnthropic(body) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { const error = new Error("Anthropic API is not configured on the server."); error.status = 500; throw error; }
  if (!validateMessages(body.messages)) { const error = new Error("Invalid conversation payload."); error.status = 400; throw error; }
  const requestBody = { model: process.env.COPE_MODEL || "claude-opus-4-8", max_tokens: Math.min(Math.max(Number(body.max_tokens) || 500, 1), 1000), messages: body.messages };
  if (typeof body.system === "string" && body.system.length <= 6000) requestBody.system = body.system;
  const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify(requestBody) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { console.error("Anthropic API error:", response.status, data); const error = new Error("Cope AI could not respond right now."); error.status = 502; throw error; }
  return data;
}
app.options("/api/cope-ai", (req, res) => { corsHeaders(res); return res.status(204).end(); });
app.options("/api/lead", (req, res) => { corsHeaders(res); return res.status(204).end(); });
app.options("/api/access", (req, res) => { corsHeaders(res); return res.status(204).end(); });
app.options("/api/promo", (req, res) => { corsHeaders(res); return res.status(204).end(); });
app.get("/api/access", async (req, res) => {
  const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId.trim() : "";
  if (!validateDeviceId(deviceId)) return send(res, 400, { error: "Invalid device identifier." });
  try {
    const access = await getAccessState(deviceId);
    const trialRows = await readPromosByDevice(deviceId);
    const standardTrial = trialRows.filter(row => row.scope === "standard" && Number(row.expiresAt) > Date.now()).sort((a,b) => Number(b.expiresAt) - Number(a.expiresAt))[0];
    const aiTrial = trialRows.filter(row => row.scope === "ai" && Number(row.expiresAt) > Date.now()).sort((a,b) => Number(b.expiresAt) - Number(a.expiresAt))[0];
    const effectiveStandardTrial = standardTrial || aiTrial;
    return send(res, 200, {
      active: access.standard,
      aiActive: access.ai,
      master: access.master,
      expiresAt: access.master ? null : (effectiveStandardTrial ? Number(effectiveStandardTrial.expiresAt) : null),
      aiExpiresAt: access.master ? null : (aiTrial ? Number(aiTrial.expiresAt) : null)
    });
  } catch (error) { console.error("Access check error:", error); return send(res, 500, { error: "Access status could not be checked." }); }
});
app.post("/api/promo", async (req, res) => {
  const rate = checkRateLimit(getClientIP(req)); if (!rate.allowed) return send(res, 429, { error: "Too Many Requests", retryAfter: rate.retryAfter });
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toLowerCase() : "";
  const deviceId = typeof req.body?.deviceId === "string" ? req.body.deviceId.trim() : "";
  if (!validateDeviceId(deviceId)) return send(res, 400, { error: "Invalid device identifier." });
  try {
    const promo = await activateCode(deviceId, code);
    if (!promo) return send(res, 400, { error: "That promo code is not valid." });
    return send(res, 200, { ok: true, scope: promo.scope, promoCode: promo.code, activatedAt: promo.activatedAt, expiresAt: promo.expiresAt, durationDays: promo.durationDays });
  } catch (error) { console.error("Promo error:", error); return send(res, 500, { error: "Promo code could not be applied." }); }
});
app.post("/api/cope-ai", async (req, res) => {
  const rate = checkRateLimit(getClientIP(req)); if (!rate.allowed) return send(res, 429, { error: "Too Many Requests", retryAfter: rate.retryAfter });
  try { const result = await callAnthropic(req.body || {}); return send(res, 200, result); } catch (error) { console.error("Cope AI error:", error); return send(res, error.status || 500, { error: error.message || "Cope AI is temporarily unavailable." }); }
});
app.post("/api/lead", async (req, res) => {
  const rate = checkRateLimit(getClientIP(req)); if (!rate.allowed) return send(res, 429, { error: "Too Many Requests", retryAfter: rate.retryAfter });
  const lead = validateLead(req.body || {});
  if (!lead) return send(res, 400, { error: "Name, valid email, and a valid device identifier are required; comment is optional and limited to 2,000 characters." });
  try {
    const existingLead = await fs.promises.readFile(LEADS_FILE, "utf8").catch(error => error.code === "ENOENT" ? "" : Promise.reject(error));
    const alreadySaved = existingLead.split("\n").filter(Boolean).some(row => { try { return JSON.parse(row).deviceId === lead.deviceId; } catch (_) { return false; } });
    if (!alreadySaved) await saveLead(lead);
    const promo = await activateLeadTrial(lead.deviceId, lead.email);
    return send(res, 201, { ok: true, message: "Your information was saved.", accessActive: true, expiresAt: promo.expiresAt, durationDays: 3 });
  } catch (error) { console.error("Lead capture error:", error); return send(res, 500, { error: "Lead submission could not be completed." }); }
});
app.get("/health", (req, res) => res.status(200).json({ service: "cope-ai", status: "ok" }));
app.use(express.static(__dirname, { extensions: ["html"] }));
app.use((req, res) => { if (req.method === "GET" && !req.path.startsWith("/api/")) return res.sendFile(__dirname + "/index.html"); return send(res, 404, { error: "Not found." }); });
app.listen(PORT, "0.0.0.0", () => console.log(`Cope / Toastid Cloud backend listening on port ${PORT}`));