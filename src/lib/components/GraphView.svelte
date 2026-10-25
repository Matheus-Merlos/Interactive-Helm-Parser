<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { Background, SvelteFlow, type Edge, type Node, Position } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { KubernetesManifest } from '#lib/types.ts';
  import KubernetesNode from './KubernetesNode.svelte';
  import dagre from '@dagrejs/dagre';
  import { SvelteMap } from 'svelte/reactivity';

  const nodeTypes = {
    kubernetes: KubernetesNode,
  };

  type Props = {
    releaseName: string;
    manifests: Array<KubernetesManifest>;
  };

  const { releaseName = $bindable(''), manifests }: Props = $props();

  let nodes = $state<Array<Node>>([]);
  let edges = $state<Array<Edge>>([]);

  const NODE_WIDTH = 260;
  const NODE_HEIGHT = 56;

  function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: 70,
      ranksep: 320,
      align: 'UL',
      ranker: 'network-simplex',
    });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);

      return {
        ...node,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  $effect(() => {
    const newNodes: Node[] = [
      {
        id: 'chart-root',
        type: 'kubernetes',
        zIndex: 10,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        position: { x: 0, y: 0 },
        data: { name: releaseName || 'release-name', kind: 'Chart' },
      },
    ];

    const newEdges: Edge[] = [];

    const serviceAccountMap = new SvelteMap<string, string>();
    const clusterRoleMap = new SvelteMap<string, string>();
    const roleMap = new SvelteMap<string, string>();

    manifests.forEach((manifest, index) => {
      const id = `${manifest.kind.toLowerCase()}-${index}`;
      switch (manifest.kind) {
        case 'ServiceAccount': {
          serviceAccountMap.set(manifest.metadata.name, id);
          break;
        }
        case 'ClusterRole': {
          clusterRoleMap.set(manifest.metadata.name, id);
          break;
        }
        case 'Role': {
          roleMap.set(manifest.metadata.name, id);
          break;
        }
      }
    });

    manifests.forEach((manifest, index) => {
      const firstOrderKinds = [
        'ServiceAccount',
        'CustomResourceDefinition',
        'ClusterRole',
        'Role',
        'MutatingWebhookConfiguration',
        'ValidatingWebhookConfiguration',
        'StorageClass',
        'IngressClass',
      ];

      const id = `${manifest.kind.toLowerCase()}-${index}`;

      if (firstOrderKinds.includes(manifest.kind)) {
        newNodes.push({
          id,
          type: 'kubernetes',
          zIndex: 10,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          position: { x: 0, y: 0 },
          data: { name: manifest.metadata.name, kind: manifest.kind },
        });

        newEdges.push({
          id: `${id}-edge`,
          source: 'chart-root',
          target: id,
          type: 'step',
          animated: true,
          style: 'stroke: #3dc4ca; stroke-width: 2px;',
        });
      } else {
        switch (manifest.kind) {
          case 'StatefulSet':
          case 'DaemonSet':
          case 'Deployment': {
            newNodes.push({
              id,
              type: 'kubernetes',
              zIndex: 10,
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
              position: { x: 0, y: 0 },
              data: { name: manifest.metadata.name, kind: manifest.kind },
            });

            const spec = (manifest as any).spec;

            //Service account parsing
            const saName = spec?.template?.spec?.serviceAccountName;

            if (saName && serviceAccountMap.has(saName)) {
              const saId = serviceAccountMap.get(saName)!;
              newEdges.push({
                id: `edge-${saId}-${id}`,
                source: saId,
                target: id,
                type: 'step',
                animated: true,
                style: 'stroke: #3dc4ca; stroke-width: 2px;',
              });
            }

            //Container parsing
            const allContainers = [
              ...(spec?.template?.spec?.initContainers ?? []).map((c: any) => ({
                name: c?.name,
                kind: 'InitContainer',
              })),
              ...(spec?.template?.spec?.containers ?? []).map((c: any) => ({
                name: c?.name,
                kind: 'Container',
              })),
            ];

            allContainers.forEach(({ name, kind }) => {
              if (!name) return;
              const containerId = `${name}-${id}`;
              newNodes.push({
                id: containerId,
                type: 'kubernetes',
                zIndex: 10,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                position: { x: 0, y: 0 },
                data: { name, kind },
              });
              newEdges.push({
                id: `${containerId}-edge`,
                source: id,
                target: containerId,
                type: 'step',
                animated: true,
                style: 'stroke: #3dc4ca; stroke-width: 2px;',
              });
            });

            newEdges.push({
              id: `edge-root-${id}`,
              source: 'chart-root',
              target: id,
              type: 'step',
              animated: true,
              style: 'stroke: #3dc4ca; stroke-width: 2px;',
            });

            break;
          }

          case 'RoleBinding':
          case 'ClusterRoleBinding': {
            newNodes.push({
              id,
              type: 'kubernetes',
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
              zIndex: 10,
              position: { x: 0, y: 0 },
              data: { name: manifest.metadata.name, kind: manifest.kind },
            });

            const rbac = manifest as any;

            const roleRefName = rbac.roleRef?.name;
            const roleRefKind = rbac.roleRef?.kind;
            if (roleRefName) {
              let targetRoleId: string | undefined;

              if (roleRefKind === 'ClusterRole') {
                targetRoleId = clusterRoleMap.get(roleRefName);
              } else {
                targetRoleId = roleMap.get(roleRefName);
              }

              if (targetRoleId) {
                newEdges.push({
                  id: `edge-${targetRoleId}-${id}`,
                  source: targetRoleId,
                  target: id,
                  type: 'smoothstep',
                  animated: true,
                  style: 'stroke: #3dc4ca; stroke-width: 2px;',
                });
              }
            }

            const subjects = rbac.subjects ?? [];

            subjects.forEach((subject: any) => {
              if (subject.kind === 'ServiceAccount') {
                const saName = subject.name;
                if (serviceAccountMap.has(saName)) {
                  const saId = serviceAccountMap.get(saName)!;
                  newEdges.push({
                    id: `edge-${saId}-${id}`,
                    source: saId,
                    target: id,
                    type: 'smoothstep',
                    animated: true,
                    style: 'stroke: #3dc4ca; stroke-width: 2px;',
                  });
                }
              }
            });

            break;
          }
        }
      }
    });

    const layouted = getLayoutedElements(newNodes, newEdges, 'LR');
    nodes = layouted.nodes;
    edges = layouted.edges;
  });
</script>

<div class="graph-container">
  <SvelteFlow bind:nodes bind:edges {nodeTypes} fitView proOptions={{ hideAttribution: true }}>
    <Background gap={20} size={1} bgColor="#1a1c29" />
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
