<script lang="ts">
  import { onMount } from "svelte";
  import type { XY, Gamut } from "./types";
  import { hsvToRgb, rgbToXY, xyToRgb, clampToGamut } from "./color";

  let { value, gamut, disabled = false, onchange }: {
    value: XY;
    gamut: Gamut | null;
    disabled?: boolean;
    onchange: (xy: XY) => void;
  } = $props();

  const SIZE = 240;
  const RADIUS = SIZE / 2 - 2;
  const CENTER = SIZE / 2;

  let canvas: HTMLCanvasElement;
  let dotPos = $state({ x: CENTER, y: CENTER });

  // Drag state — debounce sends during drag, flush on release.
  let latestXY: XY | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    drawWheel();
    syncDotFromValue();
  });

  function drawWheel() {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(SIZE, SIZE);
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const dx = px - CENTER;
        const dy = py - CENTER;
        const r = Math.sqrt(dx * dx + dy * dy);
        const i = (py * SIZE + px) * 4;
        if (r > RADIUS) continue; // alpha already 0
        const angle = Math.atan2(dy, dx);
        const h = ((angle * 180) / Math.PI + 360) % 360;
        const s = Math.min(1, r / RADIUS);
        const [r0, g0, b0] = hsvToRgb(h, s, 1);
        img.data[i] = Math.round(r0 * 255);
        img.data[i + 1] = Math.round(g0 * 255);
        img.data[i + 2] = Math.round(b0 * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Convert the current xy back to a polar position so the dot reflects the bulb's state
  // when the wheel first opens. Lossy by design (xy → linear RGB → sRGB → HSV → polar)
  // but only used for the initial dot placement.
  function syncDotFromValue() {
    const [r, g, b] = xyToRgb(value, 1);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max === 0 ? 0 : (max - min) / max;
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const angle = (h * Math.PI) / 180;
    const dist = s * RADIUS;
    dotPos = { x: CENTER + Math.cos(angle) * dist, y: CENTER + Math.sin(angle) * dist };
  }

  function handlePointer(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scale = SIZE / rect.width;
    let dx = (e.clientX - rect.left) * scale - CENTER;
    let dy = (e.clientY - rect.top) * scale - CENTER;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > RADIUS) {
      const k = RADIUS / r;
      dx *= k;
      dy *= k;
    }
    dotPos = { x: CENTER + dx, y: CENTER + dy };

    const angle = Math.atan2(dy, dx);
    const h = ((angle * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / RADIUS);
    const [r0, g0, b0] = hsvToRgb(h, s, 1);
    let xy = rgbToXY(r0, g0, b0);
    if (gamut) xy = clampToGamut(xy, gamut);

    latestXY = xy;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (latestXY) onchange(latestXY);
      debounceTimer = null;
    }, 100);
  }

  function flush() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (latestXY) onchange(latestXY);
  }

  function pointerDown(e: PointerEvent) {
    if (disabled) return;
    canvas.setPointerCapture(e.pointerId);
    handlePointer(e);
  }

  function pointerMove(e: PointerEvent) {
    if (disabled) return;
    if (e.buttons === 0) return;
    handlePointer(e);
  }

  function pointerUp(e: PointerEvent) {
    if (disabled) return;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    flush();
  }
</script>

<div class="wheel" class:disabled style:width="{SIZE}px" style:height="{SIZE}px">
  <canvas
    bind:this={canvas}
    width={SIZE}
    height={SIZE}
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerUp}
    onpointercancel={pointerUp}
  ></canvas>
  <div
    class="dot"
    style:left="{(dotPos.x / SIZE) * 100}%"
    style:top="{(dotPos.y / SIZE) * 100}%"
  ></div>
</div>

<style>
  .wheel {
    position: relative;
    user-select: none;
    touch-action: none;
  }

  .wheel.disabled {
    opacity: 0.3;
    pointer-events: none;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    cursor: crosshair;
  }

  .dot {
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 3px solid #fff;
    background: transparent;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      0 2px 6px rgba(0, 0, 0, 0.4);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
</style>
