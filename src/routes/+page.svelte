<script lang="ts">
  import YAMLEditor from '#lib/components/YAMLEditor.svelte';

  let content = $state('teste');
  let registryUrl = $state('');
</script>

<div class="layout">
  <div class="wrapper-editor">
    <div>
      <input type="text" name="registry" id="registry" bind:value={registryUrl} />
    </div>
    <YAMLEditor bind:value={content} />
  </div>
  <section class="view-selector">
    <h2>Teste</h2>
  </section>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    height: 80vh;
  }
  .wrapper-editor {
    flex: 1;
  }
  .view-selector {
    flex: 1;
  }
</style>
