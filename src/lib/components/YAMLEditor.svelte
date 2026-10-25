<script lang="ts">
  import { EditorState } from '@codemirror/state';
  import { onMount, onDestroy } from 'svelte';
  import { basicSetup } from 'codemirror';
  import { yaml } from '@codemirror/lang-yaml';
  import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
  import { EditorView } from '@codemirror/view';

  let { value = $bindable(''), readOnly = false }: { value?: string; readOnly?: boolean } =
    $props();

  let editorElement: Element | undefined = undefined;
  let view: EditorView | undefined = undefined;

  onMount(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        yaml(),
        tokyoNight,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            value = update.state.doc.toString();
          }
        }),
      ],
    });

    view = new EditorView({
      state,
      parent: editorElement,
    });
  });

  $effect(() => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  });

  onDestroy(() => {
    if (view) {
      view.destroy();
    }
  });
</script>

<div class="editor-container {readOnly ? 'read-only' : ''}" bind:this={editorElement}></div>

<style>
  .editor-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 8px;
    text-align: left;
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
  }

  :global(.cm-editor) {
    height: 100% !important;
    overflow: hidden;
  }

  :global(.cm-scroller) {
    height: 100% !important;
    overflow: auto !important;
  }

  .read-only:hover {
    cursor: not-allowed;
  }
</style>
