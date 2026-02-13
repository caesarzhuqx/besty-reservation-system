import { Response } from "express";

const clients = new Set<Response>();

export function registerSseClient(res: Response): void {
  clients.add(res);
}

export function unregisterSseClient(res: Response): void {
  clients.delete(res);
}

export function broadcastEvent<T>(event: string, payload: T): void {
  const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(serialized);
  }
}
