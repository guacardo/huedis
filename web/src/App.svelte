<script lang="ts">
  import LightCard from "./lib/Light.svelte";
  import RoomCard from "./lib/RoomCard.svelte";
  import Tabs from "./lib/Tabs.svelte";
  import { getLights, putLight, getRooms, putRoom } from "./lib/api";
  import type { Light, LightUpdate, Room, XY } from "./lib/types";

  type LiveUpdate = {
    type: "light" | "grouped_light";
    id: string;
    on?: boolean;
    brightness?: number;
    xy?: XY;
    mirek?: number | null;
  };

  let lights = $state<Light[]>([]);
  let rooms = $state<Room[]>([]);
  let tab = $state<"lights" | "rooms">("lights");
  let error = $state<string | null>(null);
  let loading = $state(true);

  async function load() {
    loading = true;
    error = null;
    try {
      const [ls, rs] = await Promise.all([getLights(), getRooms()]);
      lights = ls;
      rooms = rs;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function updateLight(id: string, update: LightUpdate) {
    const light = lights.find((l) => l.id === id);
    if (!light) return;

    const before = {
      on: light.on,
      brightness: light.brightness,
      colorXY: light.color ? { ...light.color.xy } : null,
      mirek: light.colorTemp?.mirek ?? null,
    };

    if (update.on !== undefined) light.on = update.on;
    if (update.brightness !== undefined) light.brightness = update.brightness;
    if (update.xy !== undefined && light.color) light.color.xy = update.xy;
    if (update.mirek !== undefined && light.colorTemp) light.colorTemp.mirek = update.mirek;

    try {
      await putLight(id, update);
    } catch (e) {
      // Revert on failure
      light.on = before.on;
      light.brightness = before.brightness;
      if (light.color && before.colorXY) light.color.xy = before.colorXY;
      if (light.colorTemp) light.colorTemp.mirek = before.mirek;
      console.error(`Failed to update ${light.name}:`, e);
    }
  }

  async function updateRoom(groupedLightId: string, update: LightUpdate) {
    // Optimistic state on the room itself; child light optimism is done inside RoomCard.
    const room = rooms.find((r) => r.groupedLightId === groupedLightId);
    if (!room) return;

    const before = { ...room.state };
    if (update.on !== undefined) room.state.on = update.on;
    if (update.brightness !== undefined) room.state.brightness = update.brightness;
    if (update.xy !== undefined) room.state.xy = update.xy;
    if (update.mirek !== undefined) room.state.mirek = update.mirek;

    try {
      await putRoom(groupedLightId, update);
    } catch (e) {
      room.state = before;
      console.error(`Failed to update room ${room.name}:`, e);
    }
  }

  function applyLiveUpdate(u: LiveUpdate) {
    if (u.type === "light") {
      const light = lights.find((l) => l.id === u.id);
      if (!light) return;
      if (u.on !== undefined) light.on = u.on;
      if (u.brightness !== undefined) light.brightness = u.brightness;
      if (u.xy && light.color) light.color.xy = u.xy;
      if (u.mirek !== undefined && light.colorTemp) light.colorTemp.mirek = u.mirek;
    } else {
      const room = rooms.find((r) => r.groupedLightId === u.id);
      if (!room) return;
      if (u.on !== undefined) room.state.on = u.on;
      if (u.brightness !== undefined) room.state.brightness = u.brightness;
      if (u.xy) room.state.xy = u.xy;
      if (u.mirek !== undefined) room.state.mirek = u.mirek;
    }
  }

  $effect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        applyLiveUpdate(JSON.parse(e.data) as LiveUpdate);
      } catch {
        // bad payload, drop
      }
    };
    return () => es.close();
  });

  load();
</script>

<main>
  <header>
    <h1>huedis</h1>
    <Tabs
      value={tab}
      options={[
        { value: "lights", label: "Lights" },
        { value: "rooms", label: "Rooms" },
      ]}
      onchange={(v) => (tab = v)}
    />
  </header>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if error}
    <p class="error">Failed to load: {error}</p>
    <button onclick={load}>Retry</button>
  {:else if tab === "lights"}
    <p class="muted">{lights.length} lights</p>
    <div class="grid">
      {#each lights as light (light.id)}
        <LightCard {light} onChange={(u) => updateLight(light.id, u)} />
      {/each}
    </div>
  {:else}
    <p class="muted">{rooms.length} rooms</p>
    <div class="grid">
      {#each rooms as room (room.id)}
        <RoomCard
          {room}
          {lights}
          onChangeRoom={(u) => updateRoom(room.groupedLightId, u)}
          onChangeLight={(id, u) => updateLight(id, u)}
        />
      {/each}
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 36rem;
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  h1 {
    font-weight: 500;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .muted {
    opacity: 0.5;
    font-size: 0.875rem;
    margin: 0 0 0.75rem;
  }

  .error {
    color: #ff6b6b;
  }

  .grid {
    display: grid;
    gap: 0.375rem;
  }
</style>
