import { listLights, listRooms, updateLight, type LightUpdate } from "./hue.ts";
import { hsvToRgb, rgbToXY } from "./color.ts";

export type IntervalAnimation = {
  type: "interval";
  speed: number;       // revolutions per minute
  saturation: number;  // 0..1
};

export type PomodoroAnimation = {
  type: "pomodoro";
  workMinutes: number;   // default 25
  breakMinutes: number;  // default 5
};

export type Animation = IntervalAnimation | PomodoroAnimation;

type ActiveAnimation = {
  animation: Animation;
  cancel: () => void;
};

const active = new Map<string, ActiveAnimation>();

const TICK_MS = 1000;

// Pure red, computed once via rgbToXY(1, 0, 0). Bridge clamps to each bulb's gamut.
const RED_XY = { x: 0.7006, y: 0.2993 };

export async function startAnimation(
  roomId: string,
  animation: Animation,
): Promise<{ lightCount: number }> {
  stopAnimation(roomId);

  let result: { cancel: () => void; lightCount: number };
  if (animation.type === "interval") {
    result = await startInterval(roomId, animation);
  } else {
    result = await startPomodoro(roomId, animation);
  }

  active.set(roomId, { animation, cancel: result.cancel });
  return { lightCount: result.lightCount };
}

export function stopAnimation(roomId: string): boolean {
  const entry = active.get(roomId);
  if (!entry) return false;
  entry.cancel();
  active.delete(roomId);
  return true;
}

export function listAnimations(): { roomId: string; animation: Animation }[] {
  return [...active.entries()].map(([roomId, entry]) => ({
    roomId,
    animation: entry.animation,
  }));
}

async function resolveColorLights(roomId: string): Promise<string[]> {
  const [rooms, lights] = await Promise.all([listRooms(), listLights()]);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw new Error(`Unknown room ${roomId}`);
  const colorLightIds = room.lightIds.filter(
    (id) => lights.find((l) => l.id === id)?.color !== null,
  );
  if (colorLightIds.length === 0) {
    throw new Error("Room has no color-capable lights");
  }
  return colorLightIds;
}

async function startInterval(
  roomId: string,
  animation: IntervalAnimation,
): Promise<{ cancel: () => void; lightCount: number }> {
  const colorLightIds = await resolveColorLights(roomId);

  const startedAt = Date.now();
  const tick = async () => {
    const elapsed = (Date.now() - startedAt) / 1000;
    const phase = ((animation.speed / 60) * elapsed) % 1;
    const N = colorLightIds.length;
    await Promise.all(
      colorLightIds.map((lightId, i) => {
        const angle = ((phase + i / N) % 1) * 360;
        const [r, g, b] = hsvToRgb(angle, animation.saturation, 1);
        const xy = rgbToXY(r, g, b);
        return updateLight(lightId, { xy }).catch((e) => {
          console.error(`[anim:interval] PUT failed for ${lightId}:`, e);
        });
      }),
    );
  };

  void tick();
  const handle = setInterval(() => void tick(), TICK_MS);

  return {
    cancel: () => clearInterval(handle),
    lightCount: colorLightIds.length,
  };
}

type Snapshot = LightUpdate & { lightId: string };

async function startPomodoro(
  roomId: string,
  animation: PomodoroAnimation,
): Promise<{ cancel: () => void; lightCount: number }> {
  const colorLightIds = await resolveColorLights(roomId);

  // Snapshot the room's current state. This is what we restore on each
  // work-phase transition. Captured ONCE at start (predictable) — to change
  // the "work" lighting, stop pomodoro, set new scene, restart.
  const lights = await listLights();
  const snapshot: Snapshot[] = colorLightIds.map((lightId) => {
    const light = lights.find((l) => l.id === lightId);
    const s: Snapshot = { lightId, on: light?.on ?? true };
    if (light?.brightness != null) s.brightness = light.brightness;
    if (light?.colorTemp?.mirek != null) s.mirek = light.colorTemp.mirek;
    else if (light?.color) s.xy = light.color.xy;
    return s;
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  async function goToBreak() {
    if (cancelled) return;
    await Promise.all(
      colorLightIds.map((id) =>
        updateLight(id, { on: true, brightness: 100, xy: RED_XY }).catch((e) =>
          console.error(`[anim:pomodoro] break PUT failed for ${id}:`, e),
        ),
      ),
    );
    if (cancelled) return;
    timeoutHandle = setTimeout(
      () => void goToWork(),
      animation.breakMinutes * 60 * 1000,
    );
  }

  async function goToWork() {
    if (cancelled) return;
    await Promise.all(
      snapshot.map((s) => {
        const { lightId, ...update } = s;
        return updateLight(lightId, update).catch((e) =>
          console.error(`[anim:pomodoro] restore PUT failed for ${lightId}:`, e),
        );
      }),
    );
    if (cancelled) return;
    timeoutHandle = setTimeout(
      () => void goToBreak(),
      animation.workMinutes * 60 * 1000,
    );
  }

  // Begin in work phase — leave existing state alone, schedule first transition.
  timeoutHandle = setTimeout(
    () => void goToBreak(),
    animation.workMinutes * 60 * 1000,
  );

  return {
    cancel: () => {
      cancelled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
    },
    lightCount: colorLightIds.length,
  };
}
