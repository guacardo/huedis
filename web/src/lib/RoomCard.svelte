<script lang="ts">
  import { untrack } from "svelte";
  import type { Light, LightUpdate, Room, Scene, SceneAction, XY } from "./types";
  import { xyToRgb, rgbToHex, mirekToHex } from "./color";
  import LightCard from "./Light.svelte";
  import ColorWheel from "./ColorWheel.svelte";
  import Tabs from "./Tabs.svelte";
  import Effects from "./Effects.svelte";
  import Scenes from "./Scenes.svelte";

  let {
    room,
    lights,
    scenes,
    animating,
    onChangeRoom,
    onChangeLight,
    onCreateScene,
    onRecallScene,
    onRenameScene,
    onUpdateSceneActions,
    onDeleteScene,
    onStartAnimation,
    onStopAnimation,
  }: {
    room: Room;
    lights: Light[];
    scenes: Scene[];
    animating: boolean;
    onChangeRoom: (update: LightUpdate) => void;
    onChangeLight: (id: string, update: LightUpdate) => void;
    onCreateScene: (roomId: string, name: string, actions: SceneAction[]) => void;
    onRecallScene: (sceneId: string) => void;
    onRenameScene: (sceneId: string, name: string) => void;
    onUpdateSceneActions: (sceneId: string, actions: SceneAction[]) => void;
    onDeleteScene: (sceneId: string) => void;
    onStartAnimation: (roomId: string) => void;
    onStopAnimation: (roomId: string) => void;
  } = $props();

  let children = $derived(lights.filter((l) => room.lightIds.includes(l.id)));

  // Group capabilities are the union of children's.
  let hasColor = $derived(children.some((l) => l.color));
  let hasCT = $derived(children.some((l) => l.colorTemp));
  let hasDim = $derived(children.some((l) => l.brightness !== null));
  let expandable = $derived(hasColor || hasCT);

  let anyOn = $derived(children.some((l) => l.on));

  // Avg brightness of currently-on dimmable children.
  let avgBri = $derived.by(() => {
    const dimmable = children.filter((l) => l.brightness !== null && l.on);
    if (dimmable.length === 0) return null;
    return dimmable.reduce((s, l) => s + (l.brightness ?? 0), 0) / dimmable.length;
  });

  // Representative color for the swatch — first child that has a CT mirek wins, else first xy.
  let swatchHex = $derived.by(() => {
    const ctChild = children.find((l) => l.colorTemp?.mirek != null);
    if (ctChild) {
      return mirekToHex(
        ctChild.colorTemp!.mirek!,
        ctChild.colorTemp!.min,
        ctChild.colorTemp!.max,
      );
    }
    const colorChild = children.find((l) => l.color);
    if (colorChild) {
      const [r, g, b] = xyToRgb(colorChild.color!.xy, 1);
      return rgbToHex(r, g, b);
    }
    return null;
  });

  // For the wheel, use the first color-capable child's xy and gamut as the seed.
  // Different bulbs may have different gamuts; the bridge clamps per-bulb on PUT,
  // so this is just for visual placement of the picker dot.
  let groupXY = $derived(children.find((l) => l.color)?.color?.xy ?? { x: 0.3127, y: 0.329 });
  let groupGamut = $derived(children.find((l) => l.color?.gamut)?.color?.gamut ?? null);

  // Union of CT ranges (broadest min/max across CT-capable children).
  let ctRange = $derived.by(() => {
    const cts = children.filter((l) => l.colorTemp);
    if (cts.length === 0) return null;
    return {
      min: Math.min(...cts.map((l) => l.colorTemp!.min)),
      max: Math.max(...cts.map((l) => l.colorTemp!.max)),
    };
  });

  let repMirek = $derived(
    children.find((l) => l.colorTemp?.mirek != null)?.colorTemp?.mirek ?? null,
  );

  // Effects supported by ALL effect-capable children — intersection.
  // Hide if there's only "no_effect" left (nothing useful to pick).
  let groupEffects = $derived.by(() => {
    const fx = children.filter((l) => l.effects);
    if (fx.length === 0) return null;
    const sets = fx.map((l) => new Set(l.effects!.supported));
    const intersection = [...sets[0]!].filter((e) => sets.every((s) => s.has(e)));
    return intersection.length > 1 ? intersection : null;
  });

  // Group "current" effect: if all effect-capable children agree, use that; else "no_effect".
  let groupCurrentEffect = $derived.by(() => {
    const fx = children.filter((l) => l.effects);
    if (fx.length === 0) return "no_effect";
    const first = fx[0]!.effects!.current;
    return fx.every((l) => l.effects!.current === first) ? first : "no_effect";
  });

  function onPickEffect(effect: string) {
    for (const child of children) {
      if (child.effects) onChangeLight(child.id, { effect });
    }
  }

  let expanded = $state(false);
  let mode = $state<"color" | "white">(
    untrack(() =>
      hasColor && hasCT && repMirek !== null ? "white" : hasColor ? "color" : "white",
    ),
  );

  let briTimer: ReturnType<typeof setTimeout> | null = null;
  function onBrightnessInput(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    for (const l of children) if (l.brightness !== null) l.brightness = value;
    if (briTimer) clearTimeout(briTimer);
    briTimer = setTimeout(() => onChangeRoom({ brightness: value }), 150);
  }

  let ctTimer: ReturnType<typeof setTimeout> | null = null;
  function onCTInput(e: Event) {
    const value = +(e.target as HTMLInputElement).value;
    for (const l of children) if (l.colorTemp) l.colorTemp.mirek = value;
    if (ctTimer) clearTimeout(ctTimer);
    ctTimer = setTimeout(() => onChangeRoom({ mirek: value }), 150);
  }

  function onColorPick(xy: XY) {
    for (const l of children) {
      if (l.color) l.color.xy = xy;
      if (l.colorTemp) l.colorTemp.mirek = null;
    }
    onChangeRoom({ xy });
  }

  function toggle() {
    const next = !anyOn;
    for (const l of children) l.on = next;
    onChangeRoom({ on: next });
  }
</script>

{#snippet ctControl()}
  {#if ctRange}
    <div class="ct">
      <span class="ct-label"
        >{repMirek ? `${Math.round(1_000_000 / repMirek)}K` : "—"}</span
      >
      <input
        type="range"
        class="ct-slider"
        min={ctRange.min}
        max={ctRange.max}
        value={repMirek ?? Math.round((ctRange.min + ctRange.max) / 2)}
        oninput={onCTInput}
        disabled={!anyOn}
        aria-label="Room color temperature"
      />
    </div>
  {/if}
{/snippet}

<div class="card" class:on={anyOn} class:expanded>
  <div class="row">
    <button
      class="toggle"
      onclick={toggle}
      aria-pressed={anyOn}
      aria-label="Toggle {room.name}"
      disabled={!room.groupedLightId}
    >
      <span class="dot"></span>
    </button>

    <div class="meta">
      <div class="name">{room.name}</div>
      <div class="sub">
        {children.length}
        {children.length === 1 ? "light" : "lights"}{avgBri !== null
          ? ` · ${Math.round(avgBri)}%`
          : ""}
      </div>
    </div>

    {#if hasDim}
      <input
        class="bri"
        type="range"
        min="1"
        max="100"
        step="1"
        value={Math.round(avgBri ?? 50)}
        oninput={onBrightnessInput}
        disabled={!anyOn || !room.groupedLightId}
        aria-label="Room brightness"
      />
    {/if}

    {#if swatchHex}
      <div class="swatch" style:background={swatchHex}></div>
    {/if}

    <button
      class="chevron"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      aria-label="Expand {room.name}"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  </div>

  {#if expanded}
    <div class="panel">
      {#if expandable && room.groupedLightId}
        <div class="group-color">
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
              <ColorWheel
                value={groupXY}
                gamut={groupGamut}
                disabled={!anyOn}
                onchange={onColorPick}
              />
            {:else}
              {@render ctControl()}
            {/if}
          {:else if hasColor}
            <ColorWheel
              value={groupXY}
              gamut={groupGamut}
              disabled={!anyOn}
              onchange={onColorPick}
            />
          {:else}
            {@render ctControl()}
          {/if}
        </div>
      {/if}

      {#if groupEffects}
        <Effects
          current={groupCurrentEffect}
          supported={groupEffects}
          disabled={!anyOn}
          onpick={onPickEffect}
        />
      {/if}

      <Scenes
        {scenes}
        lightIds={room.lightIds}
        {lights}
        onCreate={(name, actions) => onCreateScene(room.id, name, actions)}
        onRecall={onRecallScene}
        onRename={onRenameScene}
        onUpdateActions={onUpdateSceneActions}
        onDelete={onDeleteScene}
      />

      {#if hasColor}
        <div class="anim-row">
          <span class="anim-title">Animation</span>
          {#if animating}
            <button class="anim-btn stop" onclick={() => onStopAnimation(room.id)}
              >■ Stop spinning</button
            >
          {:else}
            <button class="anim-btn" onclick={() => onStartAnimation(room.id)}
              >▶ Spinning rainbow</button
            >
          {/if}
        </div>
      {/if}



      {#if children.length > 0}
        <div class="children">
          {#each children as child (child.id)}
            <LightCard light={child} onChange={(u) => onChangeLight(child.id, u)} />
          {/each}
        </div>
      {:else}
        <div class="empty">no lights in this room</div>
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

  .toggle:disabled {
    opacity: 0.3;
    cursor: not-allowed;
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
    font-weight: 500;
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
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid #333;
  }

  .chevron {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 0.25rem;
    display: grid;
    place-items: center;
    transition: transform 0.15s, color 0.15s;
  }

  .chevron[aria-expanded="true"] {
    transform: rotate(180deg);
    color: #ddd;
  }

  .panel {
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.75rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .group-color {
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

  .children {
    display: grid;
    gap: 0.375rem;
  }

  .empty {
    opacity: 0.4;
    font-size: 0.875rem;
    text-align: center;
    padding: 1rem;
  }

  .anim-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .anim-title {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .anim-btn {
    background: transparent;
    border: 1px solid #444;
    color: #ddd;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-family: inherit;
    border-radius: 999px;
    cursor: pointer;
  }

  .anim-btn:hover {
    border-color: #ffaa44;
    color: #ffaa44;
  }

  .anim-btn.stop {
    background: #ffaa44;
    border-color: #ffaa44;
    color: #1a1a1a;
    font-weight: 500;
  }

  .anim-btn.stop:hover {
    background: #ffbe66;
    color: #1a1a1a;
  }
</style>
