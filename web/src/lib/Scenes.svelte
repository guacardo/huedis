<script lang="ts">
  import type { Light, Scene, SceneAction } from "./types";
  import { xyToRgb, rgbToHex, mirekToHex } from "./color";

  let {
    scenes,
    lightIds,
    lights,
    onCreate,
    onRecall,
    onRename,
    onUpdateActions,
    onDelete,
  }: {
    scenes: Scene[];
    lightIds: string[];
    lights: Light[];
    onCreate: (name: string, actions: SceneAction[]) => void;
    onRecall: (sceneId: string) => void;
    onRename: (sceneId: string, name: string) => void;
    onUpdateActions: (sceneId: string, actions: SceneAction[]) => void;
    onDelete: (sceneId: string) => void;
  } = $props();

  let creating = $state(false);
  let newName = $state("");
  let editingId = $state<string | null>(null);
  let editName = $state("");

  function captureCurrent(): SceneAction[] {
    return lightIds.map((lightId) => {
      const light = lights.find((l) => l.id === lightId);
      const action: SceneAction = { lightId };
      if (!light) return action;
      action.on = light.on;
      if (light.brightness !== null) action.brightness = light.brightness;
      // Capture color OR mirek depending on bulb's current mode
      if (light.colorTemp?.mirek != null) {
        action.mirek = light.colorTemp.mirek;
      } else if (light.color) {
        action.xy = light.color.xy;
      }
      return action;
    });
  }

  function startCreate() {
    creating = true;
    newName = "";
  }

  function cancelCreate() {
    creating = false;
    newName = "";
  }

  function commitCreate() {
    const name = newName.trim();
    if (!name) return;
    onCreate(name, captureCurrent());
    cancelCreate();
  }

  function startEdit(scene: Scene) {
    editingId = scene.id;
    editName = scene.name;
  }

  function cancelEdit() {
    editingId = null;
  }

  function commitRename(sceneId: string) {
    const name = editName.trim();
    if (name) onRename(sceneId, name);
    cancelEdit();
  }

  function recapture(sceneId: string) {
    onUpdateActions(sceneId, captureCurrent());
    cancelEdit();
  }

  function confirmDelete(sceneId: string) {
    onDelete(sceneId);
    cancelEdit();
  }

  function swatchFor(scene: Scene): string[] {
    const colors: string[] = [];
    for (const action of scene.actions) {
      if (action.mirek != null) {
        colors.push(mirekToHex(action.mirek));
      } else if (action.xy) {
        const [r, g, b] = xyToRgb(action.xy, 1);
        colors.push(rgbToHex(r, g, b));
      }
      if (colors.length >= 4) break;
    }
    return colors;
  }
</script>

<div class="scenes">
  <div class="header">
    <span class="title">Scenes</span>
    {#if !creating}
      <button class="add" onclick={startCreate}>+ Save scene</button>
    {/if}
  </div>

  {#if creating}
    <div class="form">
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={newName}
        placeholder="Scene name"
        autofocus
        onkeydown={(e) => {
          if (e.key === "Enter") commitCreate();
          if (e.key === "Escape") cancelCreate();
        }}
      />
      <button class="primary" onclick={commitCreate} disabled={!newName.trim()}>
        Save
      </button>
      <button onclick={cancelCreate}>Cancel</button>
    </div>
  {/if}

  {#if scenes.length > 0}
    <div class="chips">
      {#each scenes as scene (scene.id)}
        {#if editingId === scene.id}
          <div class="form full">
            <input
              bind:value={editName}
              onkeydown={(e) => {
                if (e.key === "Enter") commitRename(scene.id);
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <button class="primary" onclick={() => commitRename(scene.id)}>
              Rename
            </button>
            <button onclick={() => recapture(scene.id)}>Update from current</button>
            <button class="danger" onclick={() => confirmDelete(scene.id)}>Delete</button>
            <button onclick={cancelEdit}>Cancel</button>
          </div>
        {:else}
          <div class="chip-row">
            <button class="chip" onclick={() => onRecall(scene.id)}>
              <span class="swatch">
                {#each swatchFor(scene) as hex, i (i)}
                  <span class="dot" style:background={hex}></span>
                {/each}
              </span>
              <span class="name">{scene.name}</span>
            </button>
            <button
              class="edit-btn"
              onclick={() => startEdit(scene)}
              aria-label="Edit {scene.name}"
            >
              ✎
            </button>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .scenes {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .add {
    background: transparent;
    border: 1px solid #444;
    color: #ddd;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
  }

  .add:hover {
    border-color: #ffaa44;
    color: #ffaa44;
  }

  .form {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
  }

  .form.full {
    width: 100%;
  }

  input {
    background: #222;
    border: 1px solid #444;
    color: #eee;
    padding: 0.3rem 0.5rem;
    border-radius: 0.25rem;
    font-family: inherit;
    font-size: 0.875rem;
    flex: 1;
    min-width: 6rem;
  }

  input:focus {
    outline: none;
    border-color: #ffaa44;
  }

  .form button {
    background: #2d2d2d;
    border: 1px solid #444;
    color: #ddd;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-family: inherit;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .form button:hover:not(:disabled) {
    border-color: #ffaa44;
  }

  .form button.primary {
    background: #ffaa44;
    border-color: #ffaa44;
    color: #1a1a1a;
    font-weight: 500;
  }

  .form button.primary:hover {
    background: #ffbe66;
  }

  .form button.danger:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }

  .form button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .chip-row {
    display: inline-flex;
    align-items: stretch;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #222;
    border: 1px solid #333;
    color: #ddd;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-family: inherit;
    border-radius: 999px 0 0 999px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
  }

  .chip:hover {
    background: #2a2a2a;
    border-color: #555;
  }

  .swatch {
    display: inline-flex;
    gap: 0.125rem;
  }

  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
  }

  .name {
    color: #ddd;
  }

  .edit-btn {
    background: #1f1f1f;
    border: 1px solid #333;
    border-left: none;
    color: #888;
    padding: 0 0.55rem;
    font-size: 0.8rem;
    font-family: inherit;
    border-radius: 0 999px 999px 0;
    cursor: pointer;
    transition: color 0.1s, border-color 0.1s;
  }

  .edit-btn:hover {
    color: #ffaa44;
    border-color: #555;
  }
</style>
