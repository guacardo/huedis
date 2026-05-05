const BRIDGE_IP = process.env.HUE_BRIDGE_IP;
const APP_KEY = process.env.HUE_APP_KEY;

if (!BRIDGE_IP || !APP_KEY) {
  throw new Error("Missing HUE_BRIDGE_IP or HUE_APP_KEY in .env");
}

export const BRIDGE_HOST = BRIDGE_IP;
export const APPLICATION_KEY = APP_KEY;
export const BASE = `https://${BRIDGE_IP}/clip/v2/resource`;

const HEADERS = { "hue-application-key": APP_KEY };
const JSON_HEADERS = { ...HEADERS, "Content-Type": "application/json" };
const TLS = { rejectUnauthorized: false };

export async function bridgeGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { headers: HEADERS, tls: TLS });
  if (!res.ok) {
    throw new Error(`Bridge GET ${path} → ${res.status}: ${await res.text()}`);
  }
  return ((await res.json()) as { data: T }).data;
}

export async function bridgePost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: JSON_HEADERS,
    tls: TLS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Bridge POST ${path} → ${res.status}: ${await res.text()}`);
  }
  return ((await res.json()) as { data: T }).data;
}

export async function bridgePut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    tls: TLS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Bridge PUT ${path} → ${res.status}: ${await res.text()}`);
  }
  return ((await res.json()) as { data: T }).data;
}

export async function bridgeDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "DELETE",
    headers: HEADERS,
    tls: TLS,
  });
  if (!res.ok) {
    throw new Error(`Bridge DELETE ${path} → ${res.status}: ${await res.text()}`);
  }
  return ((await res.json()) as { data: T }).data;
}
