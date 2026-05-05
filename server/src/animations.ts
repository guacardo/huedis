import { listLights, listRooms, updateLight } from "./hue.ts";
import { hsvToRgb, rgbToXY } from "./color.ts";

export type IntervalAnimation = {
  type: "interval";
  speed: number;       // revolutions per minute
  saturation: number;  // 0..1
};

export type Animation = IntervalAnimation;

type ActiveAnimation = {
  animation: Animation;
  handle: ReturnType<typeof setInterval>;
  colorLightIds: string[];
  startedAt: number;
};

const active = new Map<string, ActiveAnimation>();

// Hue rate-limits PUTs to ~10/sec/light. We tick at 1 Hz which keeps load low
// (per-light: 1 PUT/sec; whole-room: N PUTs/sec). Fine for "slow" rotation.
const TICK_MS = 1000;

export async function startAnimation(
  roomId: string,
  animation: Animation,
): Promise<{ lightCount: number }> {
  // Stop any existing animation in this room.
  stopAnimation(roomId);

  // Resolve which lights in this room are color-capable.
  const [rooms, lights] = await Promise.all([listRooms(), listLights()]);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw new Error(`Unknown room ${roomId}`);

  const colorLightIds = room.lightIds.filter((id) =>
    lights.find((l) => l.id === id)?.color !== null,
  );

  if (colorLightIds.length === 0) {
    throw new Error("Room has no color-capable lights");
  }

  const startedAt = Date.now();
  const handle = setInterval(() => {
    void tick(roomId);
  }, TICK_MS);

  active.set(roomId, { animation, handle, colorLightIds, startedAt });

  // Fire one immediate tick so users see the colors snap into place right away.
  void tick(roomId);

  return { lightCount: colorLightIds.length };
}

export function stopAnimation(roomId: string): boolean {
  const entry = active.get(roomId);
  if (!entry) return false;
  clearInterval(entry.handle);
  active.delete(roomId);
  return true;
}

export function listAnimations(): { roomId: string; animation: Animation }[] {
  return [...active.entries()].map(([roomId, entry]) => ({
    roomId,
    animation: entry.animation,
  }));
}

async function tick(roomId: string) {
  const entry = active.get(roomId);
  if (!entry) return;

  const elapsed = (Date.now() - entry.startedAt) / 1000;
  // phase = revolutions (units of full turn). Modulo 1 keeps it in [0,1).
  const phase = ((entry.animation.speed / 60) * elapsed) % 1;

  const N = entry.colorLightIds.length;
  await Promise.all(
    entry.colorLightIds.map((lightId, i) => {
      const angle = ((phase + i / N) % 1) * 360;
      const [r, g, b] = hsvToRgb(angle, entry.animation.saturation, 1);
      const xy = rgbToXY(r, g, b);
      return updateLight(lightId, { xy }).catch((e) => {
        console.error(`[anim] PUT failed for ${lightId}:`, e);
      });
    }),
  );
}
