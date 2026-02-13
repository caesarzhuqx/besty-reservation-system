export type ReservationStatus = "confirmed" | "modified" | "cancelled";

export interface ReservationRecord {
  reservationId: string;
  propertyId: string;
  guestId: string;
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  totalAmount: number;
  currency: string;
  guestFirstName?: string | null;
  guestLastName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  webhookId?: string | null;
  eventTimestamp?: string | null;
}

export interface ReservationFilters {
  status?: string;
  propertyId?: string;
  guestId?: string;
  checkInFrom?: string;
  checkInTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BroadcastRequest {
  message: string;
  filters?: ReservationFilters;
}

export interface BroadcastResult {
  totalMatched: number;
  attempted: number;
  sent: number;
  failed: number;
  failures: Array<{ guestId: string; reason: string }>;
}
