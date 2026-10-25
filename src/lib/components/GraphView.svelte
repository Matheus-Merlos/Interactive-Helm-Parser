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
    manifests.forEach((manifest, index) => {
      switch (manifest.kind) {
        case 'ServiceAccount': {
          nodes.push({
            id: `sa-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `sa-${index}-edge`,
            source: 'chart-root',
            target: `sa-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'CustomResourceDefinition': {
          nodes.push({
            id: `crd-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `crd-${index}-edge`,
            source: 'chart-root',
            target: `crd-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'ClusterRole': {
          nodes.push({
            id: `cr-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `cr-${index}-edge`,
            source: 'chart-root',
            target: `cr-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'Role': {
          nodes.push({
            id: `role-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `role-${index}-edge`,
            source: 'chart-root',
            target: `role-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'MutatingWebhookConfiguration': {
          nodes.push({
            id: `mwc-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `mwc-${index}-edge`,
            source: 'chart-root',
            target: `mwc-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'ValidatingWebhookConfiguration': {
          nodes.push({
            id: `vwc-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `vwc-${index}-edge`,
            source: 'chart-root',
            target: `vwc-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'StorageClass': {
          nodes.push({
            id: `sc-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `sc-${index}-edge`,
            source: 'chart-root',
            target: `sc-${index}`,
            type: 'step',
            animated: true,
            style: 'stroke: #3dc4ca; stroke-width: 2px;',
          });
          break;
        }

        case 'IngressClass': {
          nodes.push({
            id: `ic-${index}`,
            type: 'kubernetes',
            position: { x: 150, y: 20 },
            data: { name: manifest.metadata.name, kind: manifest.kind },
          });
          edges.push({
            id: `ic-${index}-edge`,
            source: 'chart-root',
            target: `ic-${index}`,
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
