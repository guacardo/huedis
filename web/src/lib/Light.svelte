<script lang="ts">
  import { untrack } from "svelte";
  import type { Light, LightUpdate, XY } from "./types";
  import { xyToRgb, rgbToHex, mirekToHex } from "./color";
  import ColorWheel from "./ColorWheel.svelte";
  import Tabs from "./Tabs.svelte";
  import Effects from "./Effects.svelte";

  let { light, onChange }: {
    light: Light;
    onChange: (update: LightUpdate) => void;
  } = $props();

  let expanded = $state(false);
  // Default mode reflects bulb's current mode at mount; user-controlled afterwards.
  let mode = $state<"color" | "white">(
    untrack(() =>
      light.color && light.colorTemp && light.colorTemp.mirek !== null ? "white" : "color",
    ),
  );

  let briTimer: ReturnType<typeof setTimeout> | null = null;
  function onBrightnessInput(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    light.brightness = value;
    if (briTimer) clearTimeout(briTimer);
    briTimer = setTimeout(() => onChange({ brightness: value }), 150);
  }

  let ctTimer: ReturnType<typeof setTimeout> | null = null;
  function onCTInput(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    if (light.colorTemp) light.colorTemp.mirek = value;
    if (ctTimer) clearTimeout(ctTimer);
    ctTimer = setTimeout(() => onChange({ mirek: value }), 150);
  }

  function toggle() {
    onChange({ on: !light.on });
  }

  function onColorPick(xy: XY) {
    if (light.color) light.color.xy = xy;
    if (light.colorTemp) light.colorTemp.mirek = null; // bulb leaves white mode
    onChange({ xy });
  }

  let hasColor = $derived(light.color !== null);
  let hasCT = $derived(light.colorTemp !== null);
  let expandable = $derived(hasColor || hasCT);

  // Reflects what the bulb is currently displaying — mirek wins if non-null.
  let swatchHex = $derived.by(() => {
    if (light.colorTemp?.mirek != null) {
      return mirekToHex(light.colorTemp.mirek, light.colorTemp.min, light.colorTemp.max);
    }
    if (light.color) {
      const [r, g, b] = xyToRgb(light.color.xy, 1);
      return rgbToHex(r, g, b);
    }
    return null;
  });

  let sub = $derived(light.brightness !== null ? `${Math.round(light.brightness)}%` : "on/off");
</script>

{#snippet ctSlider()}
  {#if light.colorTemp}
    <div class="ct">
      <span class="ct-label"
        >{light.colorTemp.mirek
          ? `${Math.round(1_000_000 / light.colorTemp.mirek)}K`
          : "—"}</span
      >
      <input
        type="range"
        class="ct-slider"
        min={light.colorTemp.min}
        max={light.colorTemp.max}
        value={light.colorTemp.mirek ??
          Math.round((light.colorTemp.min + light.colorTemp.max) / 2)}
        oninput={onCTInput}
        disabled={!light.on}
        aria-label="Color temperature"
      />
    </div>
  {/if}
{/snippet}

{#snippet wheel()}
  {#if light.color}
    <ColorWheel
      value={light.color.xy}
      gamut={light.color.gamut}
      disabled={!light.on}
      onchange={onColorPick}
    />
  {/if}
{/snippet}

<div class="card" class:on={light.on}>
  <div class="row">
    <button
      class="toggle"
      onclick={toggle}
      aria-pressed={light.on}
      aria-label="Toggle {light.name}"
    >
      <span class="dot"></span>
    </button>

    <div class="meta">
      <div class="name">{light.name}</div>
      <div class="sub">{sub}</div>
    </div>

    {#if light.brightness !== null}
      <input
        class="bri"
        type="range"
        min="1"
        max="100"
        step="1"
        value={Math.round(light.brightness)}
        oninput={onBrightnessInput}
        disabled={!light.on}
        aria-label="Brightness"
      />
    {/if}

    {#if expandable && swatchHex}
      <button
        class="swatch"
        style:background={swatchHex}
        onclick={() => (expanded = !expanded)}
        aria-label="Color and temperature"
        aria-expanded={expanded}
      ></button>
    {/if}
  </div>

  {#if expanded && expandable}
    <div class="expanded">
      {#if hasColor && hasCT}
        <Tabs
          value={mode}
          options={[
            { value: "color", label: "Color" },
            { value: "white", label: "White" },
          ]}
          onchange={(v) => (mode = v)}
        />
        {#if mode === "color"}
          {@render wheel()}
        {:else}
          {@render ctSlider()}
        {/if}
      {:else if hasColor}
        {@render wheel()}
      {:else if hasCT}
        {@render ctSlider()}
      {/if}

      {#if light.effects && light.effects.supported.length > 1}
        <Effects
          current={light.effects.current}
          supported={light.effects.supported}
          disabled={!light.on}
          onpick={(effect) => onChange({ effect })}
        />
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    background: #1a1a1a;
    border-radius: 0.5rem;
    transition: background 0.15s;
    overflow: hidden;
  }

  .card.on {
    background: #2a2520;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }

  .toggle {
    flex-shrink: 0;
    width: 2.5rem;
    height: 1.5rem;
    border-radius: 999px;
    border: 1px solid #333;
    background: #222;
    padding: 0;
    cursor: pointer;
    position: relative;
    transition: background 0.15s, border-color 0.15s;
  }

  .card.on .toggle {
    background: #ffaa44;
    border-color: #ffaa44;
  }

  .dot {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: #888;
    transition: transform 0.15s, background 0.15s;
  }

  .card.on .dot {
    transform: translateX(1rem);
    background: #fff;
  }

  .meta {
    flex: 1;
    min-width: 0;
  }

  .name {
    font-size: 0.95rem;
  }

  .sub {
    font-size: 0.75rem;
    opacity: 0.5;
    font-variant-numeric: tabular-nums;
  }

  .bri {
    width: 7rem;
    flex-shrink: 0;
    accent-color: #ffaa44;
  }

  .bri:disabled {
    opacity: 0.3;
  }

  .swatch {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    border: 2px solid #333;
    cursor: pointer;
    padding: 0;
    transition: border-color 0.15s, transform 0.1s;
  }

  .swatch:hover {
    border-color: #555;
  }

  .swatch[aria-expanded="true"] {
    border-color: #ffaa44;
  }

  .expanded {
    padding: 0.5rem 1rem 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .ct {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 0.5rem;
  }

  .ct-label {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }

  .ct-slider {
    width: 100%;
    accent-color: #ffaa44;
  }

  .ct-slider:disabled {
    opacity: 0.3;
  }
</style>
