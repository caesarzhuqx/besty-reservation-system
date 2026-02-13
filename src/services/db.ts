import { Pool } from "pg";
import { ReservationFilters, ReservationRecord } from "../types.js";

const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? "interview",
  password: process.env.DB_PASSWORD ?? "interview_password",
  database: process.env.DB_NAME ?? "interview",
  max: Number(process.env.DB_POOL_MAX ?? 20)
});

export async function upsertReservation(record: ReservationRecord): Promise<void> {
  await pool.query(
    `
    INSERT INTO reservations (
      reservation_id,
      property_id,
      guest_id,
      status,
      check_in,
      check_out,
      num_guests,
      total_amount,
      currency,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      webhook_id,
      event_timestamp,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,NOW()
    )
    ON CONFLICT (reservation_id) DO UPDATE SET
      property_id = EXCLUDED.property_id,
      guest_id = EXCLUDED.guest_id,
      status = EXCLUDED.status,
      check_in = EXCLUDED.check_in,
      check_out = EXCLUDED.check_out,
      num_guests = EXCLUDED.num_guests,
      total_amount = EXCLUDED.total_amount,
      currency = EXCLUDED.currency,
      guest_first_name = EXCLUDED.guest_first_name,
      guest_last_name = EXCLUDED.guest_last_name,
      guest_email = EXCLUDED.guest_email,
      guest_phone = EXCLUDED.guest_phone,
      webhook_id = EXCLUDED.webhook_id,
      event_timestamp = EXCLUDED.event_timestamp,
      updated_at = NOW()
    WHERE
      reservations.event_timestamp IS NULL
      OR EXCLUDED.event_timestamp IS NULL
      OR EXCLUDED.event_timestamp >= reservations.event_timestamp
    `,
    [
      record.reservationId,
      record.propertyId,
      record.guestId,
      record.status,
      record.checkIn,
      record.checkOut,
      record.numGuests,
      record.totalAmount,
      record.currency,
      record.guestFirstName ?? null,
      record.guestLastName ?? null,
      record.guestEmail ?? null,
      record.guestPhone ?? null,
      record.webhookId ?? null,
      record.eventTimestamp ?? null
    ]
  );
}

function buildFilterWhere(filters: ReservationFilters): { whereSql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filters.propertyId) {
    params.push(filters.propertyId);
    clauses.push(`property_id = $${params.length}`);
  }
  if (filters.guestId) {
    params.push(filters.guestId);
    clauses.push(`guest_id = $${params.length}`);
  }
  if (filters.checkInFrom) {
    params.push(filters.checkInFrom);
    clauses.push(`check_in >= $${params.length}`);
  }
  if (filters.checkInTo) {
    params.push(filters.checkInTo);
    clauses.push(`check_in <= $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    clauses.push(`(
      reservation_id ILIKE $${params.length}
      OR guest_id ILIKE $${params.length}
      OR COALESCE(guest_first_name, '') ILIKE $${params.length}
      OR COALESCE(guest_last_name, '') ILIKE $${params.length}
      OR COALESCE(guest_email, '') ILIKE $${params.length}
    )`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

export async function listReservations(filters: ReservationFilters) {
  const { whereSql, params } = buildFilterWhere(filters);
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const query = `
    SELECT
      reservation_id,
      property_id,
      guest_id,
      status,
      check_in,
      check_out,
      num_guests,
      total_amount,
      currency,
      guest_first_name,
      guest_last_name,
      guest_email,
      guest_phone,
      webhook_id,
      event_timestamp,
      created_at,
      updated_at
    FROM reservations
    ${whereSql}
    ORDER BY updated_at DESC
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
  `;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function listDistinctGuests(filters: ReservationFilters): Promise<string[]> {
  const { whereSql, params } = buildFilterWhere(filters);
  const result = await pool.query(
    `
    SELECT DISTINCT guest_id
    FROM reservations
    ${whereSql}
    `,
    params
  );
  return result.rows.map((row) => row.guest_id as string);
}

export async function countReservations(filters: ReservationFilters): Promise<number> {
  const { whereSql, params } = buildFilterWhere(filters);
  const result = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM reservations
    ${whereSql}
    `,
    params
  );
  return result.rows[0]?.count ?? 0;
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
