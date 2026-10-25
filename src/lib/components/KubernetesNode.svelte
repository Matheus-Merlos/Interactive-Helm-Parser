<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte';
  import {
    Box,
    Component,
    FileCheck,
    Key,
    Layers,
    Puzzle,
    ServerCog,
    ShieldCheck,
    UserRoundCog,
    Wand,
    type Icon as LucideIcon,
  } from 'lucide-svelte';

  type KubernetesNodeType = Node<
    {
      name: string;
      kind: string;
    },
    'kubernetes'
  >;

  let { data }: NodeProps<KubernetesNodeType> = $props();

  const iconMap: Record<string, typeof LucideIcon> = {
    Chart: Layers,
    ServiceAccount: UserRoundCog,
    CustomResourceDefinition: Puzzle,
    ClusterRole: ShieldCheck,
    Role: Key,
    MutatingWebhookConfiguration: Wand,
    ValidatingWebhookConfiguration: FileCheck,
    StorageClass: ServerCog,
    IngressClass: Component,
  };

  const Icon = $derived(iconMap[data.kind] ?? Box);
</script>

<div class="k8s-node">
  <Handle type="target" position={Position.Top} />

  <div class="content">
    <div class="icon">
      <Icon size={20} strokeWidth={1.2} />
    </div>
    <div class="info">
      <div class="name">{data.name}</div>
    </div>
  </div>

  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .k8s-node {
    background: var(--editor-header-background);
    border: 1px solid var(--light-blue);
    border-radius: 8px;
    padding: 8px 12px;
    max-width: 300px;
    color: var(--smooth-white);
    font-family: 'Inter', sans-serif;

    &:hover {
      cursor: pointer;
    }
  }

  .content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1c29;
    border-radius: 6px;
    padding: 6px;
  }

  .name {
    font-weight: 600;
    font-size: 14pt;
    color: white;
  }
</style>
