import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import KubernetesNode from './KubernetesNode.svelte';

//Handle needs the SvelteFlow context, so it is replaced by a stub
vi.mock('@xyflow/svelte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/svelte')>()),
  Handle: (await import('../../tests/stubs/HandleStub.svelte')).default,
}));

describe('KubernetesNode', () => {
  it('renders the kind and the name', () => {
    render(KubernetesNode, { data: { name: 'my-app', kind: 'Deployment' } });

    expect(screen.getByText('Deployment:')).toBeInTheDocument();
    expect(screen.getByText('my-app')).toHaveAttribute('title', 'my-app');
  });

  it('renders target and source handles', () => {
    render(KubernetesNode, { data: { name: 'my-app', kind: 'Deployment' } });

    const handles = screen.getAllByTestId('handle');
    expect(handles.map((h) => [h.dataset.type, h.dataset.position])).toEqual([
      ['target', 'left'],
      ['source', 'right'],
    ]);
  });

  it.each([
    ['Chart', 'layers'],
    ['ServiceAccount', 'user-round-cog'],
    ['CustomResourceDefinition', 'puzzle'],
    ['ClusterRole', 'shield-check'],
    ['Role', 'key'],
    ['MutatingWebhookConfiguration', 'wand'],
    ['ValidatingWebhookConfiguration', 'file-check'],
    ['StorageClass', 'server-cog'],
    ['IngressClass', 'component'],
    ['Deployment', 'boxes'],
    ['StatefulSet', 'database-zap'],
    ['DaemonSet', 'cpu'],
    ['Container', 'cuboid'],
    ['InitContainer', 'box'],
    ['PersistentVolumeClaim', 'hard-drive'],
    ['PersistentVolume', 'database'],
    ['ConfigMap', 'list'],
    ['Secret', 'book-key'],
    ['Job', 'factory'],
    ['Service', 'network'],
  ])('renders the icon for %s', (kind, icon) => {
    const { container } = render(KubernetesNode, { data: { name: 'resource', kind } });

    expect(container.querySelector(`.icon svg.lucide-${icon}`)).toBeInTheDocument();
  });

  it('falls back to the box icon for unknown kinds', () => {
    const { container } = render(KubernetesNode, { data: { name: 'resource', kind: 'Unknown' } });

    expect(container.querySelector('.icon svg.lucide-box')).toBeInTheDocument();
  });
});
