import type { Light, LightUpdate, Room } from "./types";

export async function getLights(): Promise<Light[]> {
  const res = await fetch("/api/lights");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function putLight(id: string, update: LightUpdate): Promise<void> {
  const res = await fetch(`/api/lights/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetch("/api/rooms");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function putRoom(groupedLightId: string, update: LightUpdate): Promise<void> {
  const res = await fetch(`/api/rooms/${groupedLightId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}
