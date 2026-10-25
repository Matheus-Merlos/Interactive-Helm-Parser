<script lang="ts">
  import { Background, SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
  import type { KubernetesManifest } from '#lib/types.ts';
  import { onMount } from 'svelte';
  import KubernetesNode from './KubernetesNode.svelte';

  const nodeTypes = {
    kubernetes: KubernetesNode,
  };

  type Props = {
    releaseName: string;
    manifests: Array<KubernetesManifest>;
  };

  const { releaseName = $bindable(''), manifests }: Props = $props();

  let nodes = $state<Array<Node>>([
    {
      id: 'chart-root',
      type: 'kubernetes',
      position: { x: 0, y: 20 },
      data: { name: releaseName ? releaseName : 'release-name', kind: 'Chart' },
    },
  ]);
  let edges = $state<Array<Edge>>([]);

  onMount(() => {
    manifests.forEach((manifest) => {
      switch (manifest.kind) {
        case 'ServiceAccount': {
          nodes.push({
            id: 'service-account',
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: 'ServiceAccount' },
          });
          edges.push({
            id: 'service-account-chart-edge',
            source: 'chart-root',
            target: 'service-account',
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }
      }
    });
  });
</script>

<div class="graph-container">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    fitView
    fitViewOptions={{ padding: 0.3, duration: 200 }}
    proOptions={{ hideAttribution: true }}
  >
    <Background gap={20} size={1} bgColor="#414868" />
  </SvelteFlow>
</div>

<style>
  .graph-container {
    width: 100%;
    height: 100%;
    background-color: #131521;
    border-radius: 12.5px;
    overflow: hidden;
  }

  .graph-container :global(.svelte-flow) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
