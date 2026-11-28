<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Edge, Node } from '@xyflow/svelte';

  let {
    nodes = $bindable([]),
    edges = $bindable([]),
    children,
  }: { nodes?: Array<Node>; edges?: Array<Edge>; children?: Snippet } = $props();
</script>

<ul data-testid="nodes">
  {#each nodes as node (node.id)}
    <li
      data-id={node.id}
      data-kind={node.data.kind}
      data-name={node.data.name}
      data-x={node.position.x}
      data-y={node.position.y}
      data-source-position={node.sourcePosition}
      data-target-position={node.targetPosition}
    ></li>
  {/each}
</ul>
<ul data-testid="edges">
  {#each edges as edge (edge.id)}
    <li
      data-id={edge.id}
      data-source={edge.source}
      data-target={edge.target}
      data-type={edge.type}
    ></li>
  {/each}
</ul>
{@render children?.()}
