import { ReservationRecord, ReservationStatus } from "../types.js";

interface GenericPayload {
  [key: string]: unknown;
}

function asObject(value: unknown): GenericPayload {
  return typeof value === "object" && value !== null ? (value as GenericPayload) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mapStatus(eventType?: string, rawStatus?: string): ReservationStatus | undefined {
  if (rawStatus) {
    const s = rawStatus.toLowerCase();
    if (s === "confirmed" || s === "modified" || s === "cancelled") return s;
  }
  if (!eventType) return undefined;
  const type = eventType.toLowerCase();
  if (type === "reservation.created") return "confirmed";
  if (type === "reservation.updated") return "modified";
  if (type === "reservation.cancelled") return "cancelled";
  return undefined;
}

export function normalizeWebhook(payload: unknown): ReservationRecord {
  const root = asObject(payload);
  const data = asObject(root.data);
  const payloadNode = asObject(root.payload);
  const reservation = asObject(
    root.reservation ??
      data.reservation ??
      payloadNode.reservation ??
      data ??
      payloadNode
  );
  const guest = asObject(reservation.guest ?? data.guest ?? payloadNode.guest ?? root.guest);

  const eventType =
    asString(root.event) ??
    asString(root.type) ??
    asString(root.event_type) ??
    asString(root.eventType) ??
    asString(data.event) ??
    asString(data.type);
  const rawStatus = asString(reservation.status) ?? asString(root.status);
  const status = mapStatus(eventType, rawStatus);

  const reservationId =
    asString(reservation.reservation_id) ??
    asString(reservation.reservationId) ??
    asString(reservation.id) ??
    asString(data.reservation_id) ??
    asString(data.reservationId) ??
    asString(data.id) ??
    asString(root.reservation_id) ??
    asString(root.reservationId);

  const propertyId =
    asString(reservation.property_id) ??
    asString(reservation.propertyId) ??
    asString(reservation.listing_id) ??
    asString(reservation.listingId) ??
    asString(data.property_id) ??
    asString(data.propertyId) ??
    asString(data.listing_id) ??
    asString(data.listingId) ??
    asString(root.property_id) ??
    asString(root.propertyId);

  const guestId =
    asString(reservation.guest_id) ??
    asString(reservation.guestId) ??
    asString(data.guest_id) ??
    asString(data.guestId) ??
    asString(guest.guest_id) ??
    asString(guest.guestId) ??
    asString(guest.id);

  const checkIn =
    asString(reservation.check_in) ??
    asString(reservation.checkIn) ??
    asString(reservation.checkin) ??
    asString(reservation.check_in_date) ??
    asString(reservation.checkInDate) ??
    asString(data.check_in) ??
    asString(data.checkIn) ??
    asString(data.checkin) ??
    asString(data.check_in_date) ??
    asString(data.checkInDate) ??
    asString(root.check_in) ??
    asString(root.checkIn);

  const checkOut =
    asString(reservation.check_out) ??
    asString(reservation.checkOut) ??
    asString(reservation.checkout) ??
    asString(reservation.check_out_date) ??
    asString(reservation.checkOutDate) ??
    asString(data.check_out) ??
    asString(data.checkOut) ??
    asString(data.checkout) ??
    asString(data.check_out_date) ??
    asString(data.checkOutDate) ??
    asString(root.check_out) ??
    asString(root.checkOut);

  const numGuests =
    asNumber(reservation.num_guests) ??
    asNumber(reservation.numGuests) ??
    asNumber(reservation.guest_count) ??
    asNumber(reservation.guestCount) ??
    asNumber(reservation.adults) ??
    asNumber(data.num_guests) ??
    asNumber(data.numGuests) ??
    asNumber(data.guest_count) ??
    asNumber(data.guestCount) ??
    asNumber(data.adults) ??
    asNumber(root.num_guests) ??
    asNumber(root.numGuests);

  const totalAmount =
    asNumber(reservation.total_amount) ??
    asNumber(reservation.totalAmount) ??
    asNumber(reservation.amount_total) ??
    asNumber(reservation.amountTotal) ??
    asNumber(asObject(reservation.total).amount) ??
    asNumber(data.total_amount) ??
    asNumber(data.totalAmount) ??
    asNumber(data.amount_total) ??
    asNumber(data.amountTotal) ??
    asNumber(root.total_amount) ??
    asNumber(root.totalAmount);

  const currency =
    asString(reservation.currency) ??
    asString(asObject(reservation.total).currency) ??
    asString(data.currency) ??
    asString(root.currency);

  if (
    !reservationId ||
    !propertyId ||
    !guestId ||
    !status ||
    !checkIn ||
    !checkOut ||
    numGuests === undefined ||
    totalAmount === undefined ||
    !currency
  ) {
    throw new Error("Invalid webhook payload: required reservation fields are missing.");
  }

  return {
    reservationId,
    propertyId,
    guestId,
    status,
    checkIn,
    checkOut,
    numGuests,
    totalAmount,
    currency,
    guestFirstName:
      asString(reservation.guest_first_name) ??
      asString(reservation.guestFirstName) ??
      asString(guest.first_name) ??
      asString(guest.firstName) ??
      null,
    guestLastName:
      asString(reservation.guest_last_name) ??
      asString(reservation.guestLastName) ??
      asString(guest.last_name) ??
      asString(guest.lastName) ??
      null,
    guestEmail:
      asString(reservation.guest_email) ??
      asString(reservation.guestEmail) ??
      asString(guest.email) ??
      null,
    guestPhone:
      asString(reservation.guest_phone) ??
      asString(reservation.guestPhone) ??
      asString(guest.phone) ??
      null,
    webhookId: asString(root.webhook_id) ?? asString(root.webhookId) ?? null,
    eventTimestamp:
      asString(root.event_timestamp) ??
      asString(root.eventTimestamp) ??
      asString(root.timestamp) ??
      asString(data.event_timestamp) ??
      asString(data.eventTimestamp) ??
      asString(data.timestamp) ??
      null
  };
}
