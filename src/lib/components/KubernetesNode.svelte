<script lang="ts">
  import { Handle, Position, type Node } from '@xyflow/svelte';
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

  let { data }: { data: KubernetesNodeType['data'] } = $props();

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
  <Handle type="target" position={Position.Left} />

  <div class="content">
    <div class="icon">
      <Icon size={20} strokeWidth={1.2} />
    </div>
    <div class="info">
      <div class="name" title={data.name}>{data.name}</div>
    </div>
  </div>

  <Handle type="source" position={Position.Right} />
</div>

<style>
  .k8s-node {
    position: relative;
    background: var(--editor-header-background, #212735);
    border: 1px solid var(--light-blue, #3dc4ca);
    border-radius: 8px;
    padding: 8px 12px;
    width: 260px;
    height: 56px;
    box-sizing: border-box;
    color: var(--smooth-white, #f0eff6);
    font-family: 'Inter', sans-serif;
    display: flex;
    align-items: center;

    &:hover {
      cursor: pointer;
      border-color: #6cb0b6;
    }
  }

  .content {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    overflow: hidden;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1c29;
    border-radius: 6px;
    padding: 6px;
    flex-shrink: 0;
  }

  .name {
    font-weight: 600;
    font-size: 11pt;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
