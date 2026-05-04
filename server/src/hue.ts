const BRIDGE_IP = process.env.HUE_BRIDGE_IP;
const APP_KEY = process.env.HUE_APP_KEY;

if (!BRIDGE_IP || !APP_KEY) {
  throw new Error("Missing HUE_BRIDGE_IP or HUE_APP_KEY in .env");
}

const BASE = `https://${BRIDGE_IP}/clip/v2/resource`;
const HEADERS = { "hue-application-key": APP_KEY };
const TLS = { rejectUnauthorized: false };
const TRANSITION_MS = 200;

export type XY = { x: number; y: number };
export type Gamut = { red: XY; green: XY; blue: XY };
export type GamutType = "A" | "B" | "C" | "other";

export type Light = {
  id: string;
  name: string;
  on: boolean;
  brightness: number | null;
  color: {
    xy: XY;
    gamut: Gamut | null;
    gamutType: GamutType;
  } | null;
  colorTemp: {
    mirek: number | null;
    min: number;
    max: number;
  } | null;
};

export type LightUpdate = {
  on?: boolean;
  brightness?: number;
  xy?: XY;
  mirek?: number;
};

export type RoomState = {
  on: boolean;
  brightness: number | null;
  xy: XY | null;
  mirek: number | null;
};

export type Room = {
  id: string;
  name: string;
  groupedLightId: string;
  lightIds: string[];
  state: RoomState;
};

type RawLight = {
  id: string;
  metadata?: { name?: string };
  on?: { on: boolean };
  dimming?: { brightness: number };
  color?: {
    xy: XY;
    gamut?: Gamut;
    gamut_type: GamutType;
  };
  color_temperature?: {
    mirek: number | null;
    mirek_valid: boolean;
    mirek_schema: { mirek_minimum: number; mirek_maximum: number };
  };
};

type RawRoom = {
  id: string;
  metadata?: { name?: string };
  children?: { rid: string; rtype: string }[];
  services?: { rid: string; rtype: string }[];
};

type RawDevice = {
  id: string;
  services?: { rid: string; rtype: string }[];
};

type RawGroupedLight = {
  id: string;
  on?: { on: boolean };
  dimming?: { brightness: number };
  color?: { xy: XY };
  color_temperature?: { mirek: number | null; mirek_valid: boolean };
};

async function bridgeGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { headers: HEADERS, tls: TLS });
  if (!res.ok) throw new Error(`Bridge GET ${path} → ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { data: T }).data;
}

function mapLight(l: RawLight): Light {
  return {
    id: l.id,
    name: l.metadata?.name ?? "(unnamed)",
    on: l.on?.on ?? false,
    brightness: l.dimming?.brightness ?? null,
    color: l.color
      ? {
          xy: l.color.xy,
          gamut: l.color.gamut ?? null,
          gamutType: l.color.gamut_type,
        }
      : null,
    colorTemp: l.color_temperature
      ? {
          mirek: l.color_temperature.mirek_valid ? l.color_temperature.mirek : null,
          min: l.color_temperature.mirek_schema.mirek_minimum,
          max: l.color_temperature.mirek_schema.mirek_maximum,
        }
      : null,
  };
}

export async function listLights(): Promise<Light[]> {
  const data = await bridgeGet<RawLight[]>("light");
  return data.map(mapLight);
}

export async function listRooms(): Promise<Room[]> {
  const [rooms, devices, groupedLights] = await Promise.all([
    bridgeGet<RawRoom[]>("room"),
    bridgeGet<RawDevice[]>("device"),
    bridgeGet<RawGroupedLight[]>("grouped_light"),
  ]);

  const groupedLightById = new Map<string, RawGroupedLight>();
  for (const gl of groupedLights) groupedLightById.set(gl.id, gl);

  const deviceLights = new Map<string, string[]>();
  for (const device of devices) {
    const lights = (device.services ?? [])
      .filter((s) => s.rtype === "light")
      .map((s) => s.rid);
    if (lights.length > 0) deviceLights.set(device.id, lights);
  }

  return rooms.map((room) => {
    const lightIds: string[] = [];
    for (const child of room.children ?? []) {
      if (child.rtype === "device") {
        lightIds.push(...(deviceLights.get(child.rid) ?? []));
      }
    }
    const groupedLightRef = (room.services ?? []).find((s) => s.rtype === "grouped_light");
    const groupedLightId = groupedLightRef?.rid ?? "";
    const gl = groupedLightById.get(groupedLightId);
    const ct = gl?.color_temperature;
    return {
      id: room.id,
      name: room.metadata?.name ?? "(unnamed)",
      groupedLightId,
      lightIds,
      state: {
        on: gl?.on?.on ?? false,
        brightness: gl?.dimming?.brightness ?? null,
        xy: gl?.color?.xy ?? null,
        mirek: ct && ct.mirek_valid ? ct.mirek : null,
      },
    };
  });
}

function buildUpdateBody(update: LightUpdate): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (update.on !== undefined) body.on = { on: update.on };
  if (update.brightness !== undefined) body.dimming = { brightness: update.brightness };
  if (update.xy !== undefined) body.color = { xy: update.xy };
  if (update.mirek !== undefined) body.color_temperature = { mirek: update.mirek };
  body.dynamics = { duration: TRANSITION_MS };
  return body;
}

async function bridgePut(url: string, update: LightUpdate): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    tls: TLS,
    body: JSON.stringify(buildUpdateBody(update)),
  });
  if (!res.ok) throw new Error(`Bridge PUT ${url} → ${res.status}: ${await res.text()}`);
}

export async function updateLight(id: string, update: LightUpdate): Promise<void> {
  return bridgePut(`${BASE}/light/${id}`, update);
}

export async function updateGroupedLight(id: string, update: LightUpdate): Promise<void> {
  return bridgePut(`${BASE}/grouped_light/${id}`, update);
}
