<script lang="ts">
  let { value = $bindable(''), readOnly = false }: { value?: string; readOnly?: boolean } =
    $props();
</script>

<textarea
  data-testid={readOnly ? 'manifests-editor' : 'values-editor'}
  readonly={readOnly}
  bind:value></textarea>
