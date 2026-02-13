import "dotenv/config";
import cors from "cors";
import express from "express";
import { broadcastToFilteredGuests } from "./services/guestApi.js";
import { closeDb, listReservations, upsertReservation } from "./services/db.js";
import { broadcastEvent, registerSseClient, unregisterSseClient } from "./services/events.js";
import { BroadcastRequest, ReservationFilters } from "./types.js";
import { normalizeWebhook } from "./utils/normalizeWebhook.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const webhookSecret = process.env.WEBHOOK_SECRET ?? "super_secret_key_123";
const guestApiBaseUrl = process.env.GUEST_API_BASE_URL ?? "http://localhost:3001";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

function parseFilters(query: Record<string, unknown>): ReservationFilters {
  return {
    status: typeof query.status === "string" ? query.status : undefined,
    propertyId: typeof query.propertyId === "string" ? query.propertyId : undefined,
    guestId: typeof query.guestId === "string" ? query.guestId : undefined,
    checkInFrom: typeof query.checkInFrom === "string" ? query.checkInFrom : undefined,
    checkInTo: typeof query.checkInTo === "string" ? query.checkInTo : undefined,
    search: typeof query.search === "string" ? query.search : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
    offset: typeof query.offset === "string" ? Number(query.offset) : undefined
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/reservations", async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const rows = await listReservations(filters);
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  registerSseClient(res);

  req.on("close", () => {
    unregisterSseClient(res);
  });
});

app.post("/api/broadcast", async (req, res) => {
  const body = req.body as BroadcastRequest;
  if (!body?.message || typeof body.message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const result = await broadcastToFilteredGuests(body.message, body.filters ?? {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/webhooks", express.text({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const secret = req.header("X-Webhook-Secret");
  if (secret !== webhookSecret) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }

  try {
    const body =
      typeof req.body === "string" && req.body.trim().length > 0
        ? JSON.parse(req.body)
        : req.body;

    console.log("==== WEBHOOK DEBUG ====");
    console.log("content-type:", req.header("content-type"));
    console.log("body:", JSON.stringify(body, null, 2));

    const normalized = normalizeWebhook(body);
    console.log("==== NORMALIZED ====");
    console.log(normalized);

    await upsertReservation(normalized);
    broadcastEvent("reservation.updated", {
      reservationId: normalized.reservationId,
      status: normalized.status
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log("==== WEBHOOK ERROR ====");
    console.log(message);
    console.log(error);

    const isPayloadError =
      message.includes("Invalid webhook payload") ||
      message.includes("Unexpected token") ||
      message.includes("JSON");

    return res.status(isPayloadError ? 400 : 500).json({ error: message });
  }
});

app.post("/api/webhooks/register", async (_req, res) => {
  const publicWebhookUrl = process.env.PUBLIC_WEBHOOK_URL;
  if (!publicWebhookUrl) {
    return res.status(400).json({ error: "Set PUBLIC_WEBHOOK_URL in env first" });
  }

  try {
    const response = await fetch(`${guestApiBaseUrl}/webhooks/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: publicWebhookUrl })
    });
    const body = await response.text();
    res.status(response.status).send(body || "{}");
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});
