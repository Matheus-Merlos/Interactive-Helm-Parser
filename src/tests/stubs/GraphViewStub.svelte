<script lang="ts">
  import type { KubernetesManifest } from '#lib/types.ts';

  let {
    releaseName = $bindable(''),
    manifests,
  }: { releaseName: string; manifests: Array<KubernetesManifest> } = $props();
</script>

<div data-testid="graph-view" data-release={releaseName}>
  {manifests.map((m) => `${m.kind}/${m.metadata.name}`).join(',')}
</div>
