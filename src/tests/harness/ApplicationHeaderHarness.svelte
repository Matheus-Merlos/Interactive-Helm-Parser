<script lang="ts">
  import ApplicationHeader from '#lib/components/ApplicationHeader.svelte';

  let { onChartUpload }: { onChartUpload: (event: Event) => void } = $props();

  let fileName = $state('');
  let releaseName = $state('');
  let releaseNamespace = $state('');
</script>

<ApplicationHeader {onChartUpload} bind:fileName bind:releaseName bind:releaseNamespace />
<output data-testid="release-name">{releaseName}</output>
<output data-testid="release-namespace">{releaseNamespace}</output>
