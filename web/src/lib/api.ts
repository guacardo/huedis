import type {
  ActiveAnimation,
  Animation,
  Light,
  LightUpdate,
  Room,
  Scene,
  SceneAction,
} from "./types";

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

export async function getScenes(): Promise<Scene[]> {
  const res = await fetch("/api/scenes");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function postScene(
  roomId: string,
  name: string,
  actions: SceneAction[],
): Promise<{ id: string }> {
  const res = await fetch("/api/scenes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, name, actions }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function putScene(
  id: string,
  body: { name?: string; actions?: SceneAction[] },
): Promise<void> {
  const res = await fetch(`/api/scenes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function recallSceneApi(id: string): Promise<void> {
  const res = await fetch(`/api/scenes/${id}/recall`, { method: "POST" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function deleteSceneApi(id: string): Promise<void> {
  const res = await fetch(`/api/scenes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export async function getAnimations(): Promise<ActiveAnimation[]> {
  const res = await fetch("/api/animations");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function startAnimationApi(
  roomId: string,
  animation: Animation,
): Promise<{ lightCount: number }> {
  const res = await fetch("/api/animations/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, animation }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function stopAnimationApi(roomId: string): Promise<void> {
  const res = await fetch("/api/animations/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}
