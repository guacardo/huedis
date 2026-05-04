import type { XY, Gamut } from "./types";

// HSV → sRGB in [0, 1]. h in [0, 360), s and v in [0, 1].
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [r + m, g + m, b + m];
}

// sRGB in [0, 1] → CIE xy chromaticity, via the Hue-recommended Wide RGB D65 matrix.
export function rgbToXY(r: number, g: number, b: number): XY {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const X = lr * 0.664511 + lg * 0.154324 + lb * 0.162028;
  const Y = lr * 0.283881 + lg * 0.668433 + lb * 0.047685;
  const Z = lr * 0.000088 + lg * 0.07231 + lb * 0.986039;
  const sum = X + Y + Z;
  if (sum === 0) return { x: 0.3127, y: 0.329 }; // D65 white-point fallback
  return { x: X / sum, y: Y / sum };
}

// xy + brightness Y → sRGB in [0, 1] (clamped).
export function xyToRgb(xy: XY, brightness: number = 1): [number, number, number] {
  const Y = brightness;
  const X = xy.y === 0 ? 0 : (Y / xy.y) * xy.x;
  const Z = xy.y === 0 ? 0 : (Y / xy.y) * (1 - xy.x - xy.y);

  let lr = X * 1.656492 + Y * -0.354851 + Z * -0.255038;
  let lg = X * -0.707196 + Y * 1.655397 + Z * 0.036152;
  let lb = X * 0.051713 + Y * -0.121364 + Z * 1.01153;

  lr = Math.max(0, lr);
  lg = Math.max(0, lg);
  lb = Math.max(0, lb);

  const max = Math.max(lr, lg, lb);
  if (max > 1) {
    lr /= max;
    lg /= max;
    lb /= max;
  }

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

// Approx visualization of a CT bulb: lerp between cool and warm endpoints.
// Not radiometrically accurate; the goal is "this swatch reads warm vs cool at a glance."
export function mirekToHex(mirek: number, min = 153, max = 500): string {
  const t = Math.max(0, Math.min(1, (mirek - min) / (max - min))); // 0 cool → 1 warm
  const cool = [0xd6, 0xe6, 0xff];
  const warm = [0xff, 0xd1, 0xa3];
  const r = Math.round(cool[0]! + (warm[0]! - cool[0]!) * t);
  const g = Math.round(cool[1]! + (warm[1]! - cool[1]!) * t);
  const b = Math.round(cool[2]! + (warm[2]! - cool[2]!) * t);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.round(Math.max(0, Math.min(1, n)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Closest-point-on-triangle clamp. Returns xy unchanged if already inside.
export function clampToGamut(xy: XY, gamut: Gamut): XY {
  if (pointInTriangle(xy, gamut.red, gamut.green, gamut.blue)) return xy;

  const candidates = [
    closestOnSegment(xy, gamut.red, gamut.green),
    closestOnSegment(xy, gamut.green, gamut.blue),
    closestOnSegment(xy, gamut.blue, gamut.red),
  ];

  let best = candidates[0]!;
  let bestD = distSq(xy, best);
  for (let i = 1; i < candidates.length; i++) {
    const d = distSq(xy, candidates[i]!);
    if (d < bestD) {
      best = candidates[i]!;
      bestD = d;
    }
  }
  return best;
}

function srgbToLinear(c: number): number {
  return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function pointInTriangle(p: XY, a: XY, b: XY, c: XY): boolean {
  const sign = (p1: XY, p2: XY, p3: XY) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function closestOnSegment(p: XY, a: XY, b: XY): XY {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const denom = abx * abx + aby * aby;
  if (denom === 0) return a;
  let t = (apx * abx + apy * aby) / denom;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

function distSq(a: XY, b: XY): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
