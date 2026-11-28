<script lang="ts">
  import YAMLEditor from '#lib/components/YAMLEditor.svelte';

  let value = $state('key: value');
</script>

<YAMLEditor bind:value />
<output data-testid="value">{value}</output>
<button onclick={() => (value = 'external: true')}>external</button>
