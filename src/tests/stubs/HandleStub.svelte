<script lang="ts">
  let { type, position }: { type: string; position: string } = $props();
</script>

<span data-testid="handle" data-type={type} data-position={position}></span>
