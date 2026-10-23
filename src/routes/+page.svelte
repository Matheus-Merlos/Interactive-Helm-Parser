<script lang="ts">
    import YAMLEditor from "#lib/components/YAMLEditor.svelte";

    let content = $state("teste")
</script>

<div class="layout">
    <h2>Editor de Values</h2>
    <div class="wrapper-editor">
        <YAMLEditor bind:value={content} />
    </div>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 80vh;
  }
  .wrapper-editor {
    flex: 1;
  }
</style>