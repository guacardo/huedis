import type { XY } from "./hue.ts";
import { BRIDGE_HOST, APPLICATION_KEY } from "./bridge.ts";

export type ResourceUpdate = {
  type: "light" | "grouped_light";
  id: string;
  on?: boolean;
  brightness?: number;
  xy?: XY;
  mirek?: number | null;
  effect?: string;
};

type Subscriber = (update: ResourceUpdate) => void;
const subscribers = new Set<Subscriber>();

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

let started = false;
export function startBridgeStream(): void {
  if (started) return;
  started = true;
  void loop();
}

async function loop() {
  let backoff = 2000;
  while (true) {
    const start = Date.now();
    try {
      await streamFromBridge();
    } catch (e) {
      console.error("[sse] bridge stream error:", e);
    }
    // If the stream ran for 30+ seconds it was healthy — reset the backoff.
    if (Date.now() - start > 30_000) backoff = 2000;
    console.log(`[sse] reconnecting in ${backoff}ms`);
    await new Promise((r) => setTimeout(r, backoff));
    backoff = Math.min(backoff * 2, 60_000);
  }
}

async function streamFromBridge() {
  const res = await fetch(`https://${BRIDGE_HOST}/eventstream/clip/v2`, {
    headers: {
      "hue-application-key": APPLICATION_KEY,
      Accept: "text/event-stream",
    },
    tls: { rejectUnauthorized: false },
  });

  if (!res.ok || !res.body) {
    throw new Error(`bridge stream returned ${res.status}`);
  }

  console.log("[sse] connected to bridge stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error("bridge stream ended");
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      processEventBlock(block);
    }
  }
}

function processEventBlock(block: string) {
  for (const line of block.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const json = line.slice(line.startsWith("data: ") ? 6 : 5);
    let events: unknown;
    try {
      events = JSON.parse(json);
    } catch {
      continue;
    }
    if (!Array.isArray(events)) continue;
    for (const ev of events as RawEvent[]) {
      if (ev?.type !== "update" || !Array.isArray(ev.data)) continue;
      for (const raw of ev.data) {
        const update = normalize(raw);
        if (update) broadcast(update);
      }
    }
  }
}

type RawEvent = { type: string; data: RawResource[] };
type RawResource = {
  id?: string;
  type?: string;
  on?: { on: boolean };
  dimming?: { brightness: number };
  color?: { xy: XY };
  color_temperature?: { mirek: number | null; mirek_valid: boolean };
  effects_v2?: { status?: { effect?: string } };
};

function normalize(raw: RawResource): ResourceUpdate | null {
  if (!raw.id || !raw.type) return null;
  if (raw.type !== "light" && raw.type !== "grouped_light") return null;

  const update: ResourceUpdate = { type: raw.type, id: raw.id };

  if (raw.on?.on !== undefined) update.on = raw.on.on;
  if (raw.dimming?.brightness !== undefined) update.brightness = raw.dimming.brightness;
  if (raw.color?.xy) update.xy = raw.color.xy;
  if (raw.color_temperature) {
    update.mirek = raw.color_temperature.mirek_valid
      ? raw.color_temperature.mirek
      : null;
  }
  if (raw.effects_v2?.status?.effect !== undefined) {
    update.effect = raw.effects_v2.status.effect;
  }

  // Skip events with nothing relevant — e.g. just a metadata change.
  if (
    update.on === undefined &&
    update.brightness === undefined &&
    update.xy === undefined &&
    update.mirek === undefined &&
    update.effect === undefined
  ) {
    return null;
  }

  return update;
}

function broadcast(update: ResourceUpdate) {
  for (const sub of subscribers) {
    try {
      sub(update);
    } catch (e) {
      console.error("[sse] subscriber error:", e);
    }
  }
}
