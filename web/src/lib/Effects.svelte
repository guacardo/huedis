<script lang="ts">
  let { current, supported, disabled = false, onpick }: {
    current: string;
    supported: string[];
    disabled?: boolean;
    onpick: (effect: string) => void;
  } = $props();

  // "no_effect" is rendered separately as a Stop pill.
  let activeEffects = $derived(supported.filter((e) => e !== "no_effect"));
  let isRunning = $derived(current !== "no_effect");

  function label(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
</script>

<div class="row" class:disabled>
  {#each activeEffects as eff (eff)}
    <button
      class="chip"
      class:active={current === eff}
      onclick={() => onpick(eff)}
      {disabled}
    >
      {label(eff)}
    </button>
  {/each}
  <button
    class="stop"
    onclick={() => onpick("no_effect")}
    disabled={disabled || !isRunning}
  >
    Stop
  </button>
</div>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    width: 100%;
  }

  .row.disabled {
    opacity: 0.4;
  }

  .chip,
  .stop {
    border: 1px solid #333;
    background: #222;
    color: #ddd;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-family: inherit;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
  }

  .chip:hover:not(:disabled),
  .stop:hover:not(:disabled) {
    border-color: #555;
    color: #fff;
  }

  .chip.active {
    background: #ffaa44;
    border-color: #ffaa44;
    color: #1a1a1a;
    font-weight: 500;
  }

  .stop {
    margin-left: auto;
  }

  .stop:disabled,
  .chip:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
