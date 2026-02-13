import pLimit from "p-limit";
import { BroadcastResult, ReservationFilters } from "../types.js";
import { countReservations, listDistinctGuests } from "./db.js";

const guestApiBaseUrl = process.env.GUEST_API_BASE_URL ?? "http://localhost:3001";
const concurrency = Number(process.env.BROADCAST_CONCURRENCY ?? 10);
const maxAttempts = Number(process.env.BROADCAST_MAX_ATTEMPTS ?? 5);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(headerValue: string | null): number {
  if (!headerValue) return 1;
  const asSeconds = Number(headerValue);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds;

  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return 1;
}

async function sendMessageWithRetry(guestId: string, message: string): Promise<void> {
  let attempt = 0;
  let delayMs = 500;

  while (attempt < maxAttempts) {
    attempt += 1;

    const response = await fetch(`${guestApiBaseUrl}/guests/${encodeURIComponent(guestId)}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    if (response.ok) return;
    if (response.status === 404) {
      throw new Error("Guest not found");
    }
    if (response.status === 429) {
      const waitSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));
      await sleep(waitSeconds * 1000);
      continue;
    }
    if (response.status >= 500) {
      await sleep(delayMs);
      delayMs *= 2;
      continue;
    }

    const text = await response.text();
    throw new Error(`Guest API error ${response.status}: ${text || "unknown error"}`);
  }

  throw new Error(`Failed after ${maxAttempts} attempts`);
}

export async function broadcastToFilteredGuests(
  message: string,
  filters: ReservationFilters = {}
): Promise<BroadcastResult> {
  const [totalMatched, guestIds] = await Promise.all([
    countReservations(filters),
    listDistinctGuests(filters)
  ]);
  const limiter = pLimit(Math.max(concurrency, 1));

  let sent = 0;
  let failed = 0;
  const failures: Array<{ guestId: string; reason: string }> = [];

  await Promise.all(
    guestIds.map((guestId) =>
      limiter(async () => {
        try {
          await sendMessageWithRetry(guestId, message);
          sent += 1;
        } catch (error) {
          failed += 1;
          failures.push({
            guestId,
            reason: error instanceof Error ? error.message : "Unknown error"
          });
        }
      })
    )
  );

  return {
    totalMatched,
    attempted: guestIds.length,
    sent,
    failed,
    failures: failures.slice(0, 100)
  };
}
