import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { KubernetesManifest } from '#lib/types.ts';
import GraphView from './GraphView.svelte';

//SvelteFlow is replaced by a stub that lists the nodes and edges
vi.mock('@xyflow/svelte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/svelte')>()),
  SvelteFlow: (await import('../../tests/stubs/SvelteFlowStub.svelte')).default,
  Background: (await import('../../tests/stubs/EmptyStub.svelte')).default,
}));

//Builds a manifest with the given kind, name and extra fields
function manifest(
  kind: string,
  name: string,
  extra: Record<string, unknown> = {},
): KubernetesManifest {
  return { apiVersion: 'v1', kind, metadata: { name }, spec: {}, ...extra };
}

//Builds a workload with a pod template spec
function workload(kind: string, name: string, podSpec: Record<string, unknown>, labels = {}) {
  return manifest(kind, name, { spec: { template: { metadata: { labels }, spec: podSpec } } });
}

function getNodes() {
  return Array.from(screen.getByTestId('nodes').children).map((el) => {
    const node = el as HTMLElement;
    return { id: node.dataset.id, kind: node.dataset.kind, name: node.dataset.name };
  });
}

function getEdges() {
  return Array.from(screen.getByTestId('edges').children).map((el) => {
    const edge = el as HTMLElement;
    return { id: edge.dataset.id, source: edge.dataset.source, target: edge.dataset.target };
  });
}

function getEdgeIds() {
  return getEdges().map((edge) => edge.id);
}

describe('GraphView', () => {
  it('renders only the chart root when there are no manifests', () => {
    render(GraphView, { releaseName: '', manifests: [] });

    expect(getNodes()).toEqual([{ id: 'chart-root', kind: 'Chart', name: 'release-name' }]);
    expect(getEdges()).toEqual([]);
  });

  it('uses the release name on the chart root', () => {
    render(GraphView, { releaseName: 'my-release', manifests: [] });

    expect(getNodes()[0].name).toBe('my-release');
  });

  it('renders the background', () => {
    render(GraphView, { releaseName: '', manifests: [] });

    expect(screen.getByTestId('empty-stub')).toBeInTheDocument();
  });

  it.each([
    'ServiceAccount',
    'CustomResourceDefinition',
    'ClusterRole',
    'Role',
    'MutatingWebhookConfiguration',
    'ValidatingWebhookConfiguration',
    'StorageClass',
    'IngressClass',
  ])('links the first order kind %s to the chart root', (kind) => {
    render(GraphView, { releaseName: '', manifests: [manifest(kind, 'resource')] });

    const id = `${kind.toLowerCase()}-0`;
    expect(getNodes()).toContainEqual({ id, kind, name: 'resource' });
    expect(getEdges()).toEqual([{ id: `${id}-edge`, source: 'chart-root', target: id }]);
  });

  it('applies the dagre layout to every node', () => {
    render(GraphView, {
      releaseName: '',
      manifests: [manifest('ServiceAccount', 'sa'), manifest('ConfigMap', 'cm')],
    });

    const items = Array.from(screen.getByTestId('nodes').children) as HTMLElement[];
    for (const item of items) {
      expect(Number.isFinite(Number(item.dataset.x))).toBe(true);
      expect(Number.isFinite(Number(item.dataset.y))).toBe(true);
      expect(item.dataset.sourcePosition).toBe('right');
      expect(item.dataset.targetPosition).toBe('left');
    }

    //Children are placed to the right of the root
    const [root, sa] = items;
    expect(Number(sa.dataset.x)).toBeGreaterThan(Number(root.dataset.x));
  });

  describe('workloads', () => {
    it.each(['Deployment', 'StatefulSet', 'DaemonSet'])('links %s to the chart root', (kind) => {
      render(GraphView, { releaseName: '', manifests: [manifest(kind, 'app')] });

      const id = `${kind.toLowerCase()}-0`;
      expect(getNodes()).toContainEqual({ id, kind, name: 'app' });
      expect(getEdges()).toEqual([{ id: `edge-root-${id}`, source: 'chart-root', target: id }]);
    });

    it('renders containers and init containers', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          workload('Deployment', 'app', {
            initContainers: [{ name: 'migrate' }],
            containers: [{ name: 'web' }, { image: 'nameless' }, null],
          }),
        ],
      });

      expect(getNodes()).toContainEqual({
        id: 'migrate-deployment-0',
        kind: 'InitContainer',
        name: 'migrate',
      });
      expect(getNodes()).toContainEqual({ id: 'web-deployment-0', kind: 'Container', name: 'web' });
      expect(getNodes()).toHaveLength(4);
      expect(getEdges()).toContainEqual({
        id: 'web-deployment-0-edge',
        source: 'deployment-0',
        target: 'web-deployment-0',
      });
      expect(getEdges()).toContainEqual({
        id: 'migrate-deployment-0-edge',
        source: 'deployment-0',
        target: 'migrate-deployment-0',
      });
    });

    it('links the service account used by the workload', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          manifest('ServiceAccount', 'app-sa'),
          workload('Deployment', 'app', { serviceAccountName: 'app-sa' }),
        ],
      });

      expect(getEdges()).toContainEqual({
        id: 'edge-serviceaccount-0-deployment-1',
        source: 'serviceaccount-0',
        target: 'deployment-1',
      });
    });

    it('ignores service accounts that are not in the chart', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [workload('Deployment', 'app', { serviceAccountName: 'external-sa' })],
      });

      expect(getEdgeIds()).toEqual(['edge-root-deployment-0']);
    });

    it('links the persistent volume claims mounted by the workload', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          manifest('PersistentVolumeClaim', 'data'),
          workload('StatefulSet', 'db', {
            volumes: [
              { name: 'data', persistentVolumeClaim: { claimName: 'data' } },
              { name: 'missing', persistentVolumeClaim: { claimName: 'other' } },
              { name: 'config', configMap: { name: 'cfg' } },
            ],
          }),
        ],
      });

      expect(getEdges()).toContainEqual({
        id: 'edge-persistentvolumeclaim-0-statefulset-1',
        source: 'persistentvolumeclaim-0',
        target: 'statefulset-1',
      });
      expect(getEdges().filter((edge) => edge.target === 'statefulset-1')).toHaveLength(2);
    });

    it('links persistent volume claims to the chart root', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [manifest('PersistentVolumeClaim', 'data')],
      });

      expect(getEdgeIds()).toEqual(['edge-root-persistentvolumeclaim-0']);
    });
  });

  describe('role bindings', () => {
    it('links a RoleBinding to its Role and service account subjects', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          manifest('Role', 'reader'),
          manifest('ServiceAccount', 'app-sa'),
          manifest('RoleBinding', 'reader-binding', {
            roleRef: { kind: 'Role', name: 'reader' },
            subjects: [
              { kind: 'ServiceAccount', name: 'app-sa' },
              { kind: 'ServiceAccount', name: 'external-sa' },
              { kind: 'User', name: 'admin' },
            ],
          }),
        ],
      });

      expect(getNodes()).toContainEqual({
        id: 'rolebinding-2',
        kind: 'RoleBinding',
        name: 'reader-binding',
      });
      expect(getEdges()).toContainEqual({
        id: 'edge-role-0-rolebinding-2',
        source: 'role-0',
        target: 'rolebinding-2',
      });
      expect(getEdges()).toContainEqual({
        id: 'edge-serviceaccount-1-rolebinding-2',
        source: 'serviceaccount-1',
        target: 'rolebinding-2',
      });
      expect(getEdges().filter((edge) => edge.target === 'rolebinding-2')).toHaveLength(2);
    });

    it('links a ClusterRoleBinding to its ClusterRole', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          manifest('ClusterRole', 'admin'),
          manifest('ClusterRoleBinding', 'admin-binding', {
            roleRef: { kind: 'ClusterRole', name: 'admin' },
          }),
        ],
      });

      expect(getEdges()).toContainEqual({
        id: 'edge-clusterrole-0-clusterrolebinding-1',
        source: 'clusterrole-0',
        target: 'clusterrolebinding-1',
      });
    });

    it('does not link roles that are not in the chart', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          manifest('RoleBinding', 'binding', { roleRef: { kind: 'Role', name: 'missing' } }),
          manifest('ClusterRoleBinding', 'cluster-binding', {
            roleRef: { kind: 'ClusterRole', name: 'missing' },
          }),
        ],
      });

      expect(getEdges()).toEqual([]);
    });

    it('handles bindings without roleRef and subjects', () => {
      render(GraphView, { releaseName: '', manifests: [manifest('RoleBinding', 'binding')] });

      expect(getNodes()).toContainEqual({
        id: 'rolebinding-0',
        kind: 'RoleBinding',
        name: 'binding',
      });
      expect(getEdges()).toEqual([]);
    });
  });

  describe('services', () => {
    it('links the service to the chart root', () => {
      render(GraphView, { releaseName: '', manifests: [manifest('Service', 'svc')] });

      expect(getEdges()).toEqual([
        { id: 'edge-root-service-0', source: 'chart-root', target: 'service-0' },
      ]);
    });

    it('links the service to the first workload matching its selector', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          workload('Deployment', 'api', {}, { app: 'api', tier: 'backend' }),
          workload('Deployment', 'api-copy', {}, { app: 'api', tier: 'backend' }),
          manifest('Service', 'svc', { spec: { selector: { app: 'api' } } }),
        ],
      });

      const serviceEdges = getEdges().filter((edge) => edge.source === 'service-2');
      expect(serviceEdges).toEqual([
        { id: 'edge-service-2-deployment-0', source: 'service-2', target: 'deployment-0' },
      ]);
    });

    it('does not link workloads that do not match the selector', () => {
      render(GraphView, {
        releaseName: '',
        manifests: [
          workload('Deployment', 'web', {}, { app: 'web' }),
          manifest('Deployment', 'no-template'),
          manifest('Service', 'svc', { spec: { selector: { app: 'api' } } }),
        ],
      });

      expect(getEdges().filter((edge) => edge.source === 'service-2')).toEqual([]);
    });
  });

  it('links unknown kinds to the chart root', () => {
    render(GraphView, { releaseName: '', manifests: [manifest('ConfigMap', 'config')] });

    expect(getNodes()).toContainEqual({ id: 'configmap-0', kind: 'ConfigMap', name: 'config' });
    expect(getEdges()).toEqual([
      { id: 'edge-root-configmap-0', source: 'chart-root', target: 'configmap-0' },
    ]);
  });

  it('rebuilds the graph when the manifests change', async () => {
    const { rerender } = render(GraphView, {
      releaseName: '',
      manifests: [manifest('ConfigMap', 'config')],
    });

    await rerender({ releaseName: 'updated', manifests: [manifest('Secret', 'token')] });

    expect(getNodes()).toEqual([
      { id: 'chart-root', kind: 'Chart', name: 'updated' },
      { id: 'secret-0', kind: 'Secret', name: 'token' },
    ]);
  });
});
