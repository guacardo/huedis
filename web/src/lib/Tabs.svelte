<script lang="ts" generics="T extends string">
  let { value, options, onchange }: {
    value: T;
    options: { value: T; label: string }[];
    onchange: (next: T) => void;
  } = $props();
</script>

<div class="tabs" role="tablist">
  {#each options as opt (opt.value)}
    <button
      role="tab"
      class:active={opt.value === value}
      aria-selected={opt.value === value}
      onclick={() => onchange(opt.value)}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: inline-flex;
    background: #1a1a1a;
    border-radius: 0.5rem;
    padding: 0.125rem;
    gap: 0.125rem;
  }

  button {
    border: none;
    background: transparent;
    color: #aaa;
    padding: 0.375rem 0.875rem;
    font-size: 0.875rem;
    font-family: inherit;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  button:hover {
    color: #eee;
  }

  button.active {
    background: #2d2d2d;
    color: #fff;
  }
</style>
