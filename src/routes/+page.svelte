<script lang="ts">
  import { Bug, FileText, Key, Network, ScrollText } from 'lucide-svelte';
  import '@shoelace-style/shoelace/dist/components/input/input.js';

  import YAMLEditor from '#lib/components/YAMLEditor.svelte';
  import { toast } from 'svelte-sonner';
  import { gunzipSync } from 'fflate';
  import { unpackTar } from 'modern-tar';
  import { renderHelmTemplate } from '#lib';
  import ApplicationHeader from '#lib/components/ApplicationHeader.svelte';

  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
  const MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;
  const MAX_FILES_COUNT = 1000;

  let activeSidebarTab = $state<'manifests' | 'graph' | 'vulnerabilities'>('manifests');

  let fileName = $state<string>('');

  let releaseName = $state<string>('');
  let releaseNamespace = $state<string>('');

  let editorContent = $state<string>('');
  let chartFiles = $state<Record<string, string>>({});
  let chartMetadata = $state<{ name: string; version: string } | null>(null);

  let renderedCharts = $state<Record<string, string>>({});
  let isRendering = $state(false);

  $effect(() => {
    const files = chartFiles;
    const content = editorContent;
    const name = chartMetadata?.name;
    const version = chartMetadata?.version;

    if (!files || Object.keys(files).length === 0) {
      renderedCharts = {};
      return;
    }

    isRendering = true;

    renderHelmTemplate(files, content, name, version, releaseName, releaseNamespace)
      .then((result) => {
        renderedCharts = result;
      })
      .catch((err) => {
        toast.error(`Error while rendering: ${err.message}`);
        renderedCharts = {};
      })
      .finally(() => {
        isRendering = false;
      });
  });

  function clearState() {
    chartFiles = {};
    chartMetadata = null;
    fileName = '';
  }

  function normalizeChartPaths(rawFiles: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    const keys = Object.keys(rawFiles);

    const first = keys[0];
    const slash = first.indexOf('/');
    const prefix = slash > 0 ? first.slice(0, slash + 1) : '';

    for (const [path, content] of Object.entries(rawFiles)) {
      const cleanPath = prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path;
      normalized[cleanPath] = content;
    }

    return normalized;
  }

  function validateHelmChart(files: Record<string, string>) {
    const filePaths = Object.keys(files);

    const hasChartYaml = filePaths.some((p) => p.endsWith('Chart.yaml') || p.endsWith('Chart.yml'));
    const hasValuesYaml = filePaths.some(
      (p) => p.endsWith('values.yaml') || p.endsWith('values.yml'),
    );

    if (!hasChartYaml || !hasValuesYaml) {
      toast.error(
        'The uploaded package is not a valid helm chart (Chart.yaml or values.yaml are absent)',
      );
      chartFiles = {};
      return;
    }

    chartFiles = files;
    const chartYamlKey = Object.keys(files).find((p) => p === 'Chart.yaml' || p === 'Chart.yml');

    if (chartYamlKey) {
      try {
        const yaml = files[chartYamlKey];
        const nameMatch = yaml.match(/^name:\s*(.+)$/m);
        const versionMatch = yaml.match(/^version:\s*(.+)$/m);

        chartMetadata = {
          name: nameMatch?.[1]?.trim() ?? 'chart',
          version: versionMatch?.[1]?.trim() ?? '0.1.0',
        };
      } catch {
        chartMetadata = null;
      }
    }

    const valuesKey = Object.keys(chartFiles).find(
      (e) => e.endsWith('values.yaml') || e.endsWith('values.yml'),
    );
    editorContent = valuesKey ? chartFiles[valuesKey] : '';

    toast.success('Helm chart successfully parsed!');
  }

  async function handleFileUpload(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const targetFile = target.files[0];
    if (targetFile.size > MAX_UPLOAD_SIZE) {
      toast.error('Maximum file size is 50MB.');
      return;
    }

    fileName = targetFile.name;

    try {
      const arrayBuffer = await targetFile.arrayBuffer();
      const compressedBytes = new Uint8Array(arrayBuffer);

      let tarBytes: Uint8Array;
      try {
        tarBytes = gunzipSync(compressedBytes);
      } catch {
        toast.error('Error: the uploaded file is not a valid .tar.gz.');
        clearState();
        return;
      }

      if (tarBytes.byteLength > MAX_UNCOMPRESSED_SIZE) {
        toast.error('Uncompressed file size exceeded.');
        clearState();
        return;
      }

      const entries = await unpackTar(tarBytes);

      const files: Record<string, string> = {};
      const decoder = new TextDecoder();
      let fileCount = 0;

      for (const entry of entries) {
        if (entry.header.type !== 'file' || !entry.data) continue;

        fileCount++;
        if (fileCount > MAX_FILES_COUNT) {
          toast.error('File limit exceeded.');
          clearState();
        }
        files[entry.header.name] = decoder.decode(entry.data);
      }

      const normalFiles = normalizeChartPaths(files);

      validateHelmChart(normalFiles);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Error while processing helm chart.');
      clearState();
      return;
    }
  }
</script>

<ApplicationHeader
  onChartUpload={handleFileUpload}
  bind:fileName
  bind:releaseName
  bind:releaseNamespace
/>
<main class="layout">
  <div id="editor-group">
    <div class="text-container">
      <div class="editor-header">
        <FileText size={37.5} strokeWidth={1.1} />
        <h2>Values</h2>
      </div>
      <YAMLEditor bind:value={editorContent} />
    </div>
    <div class="text-container">
      {#if activeSidebarTab === 'manifests'}
        <div class="editor-header">
          <img src="img/kubernetes.png" alt="Kubernetes Icon" width="40" />
          <h2>Rendered Manifests</h2>
        </div>
        <YAMLEditor value={Object.values(renderedCharts).join('\n---\n')} readOnly />
      {/if}
    </div>
  </div>
  <aside class="view-selector">
    <button
      id={activeSidebarTab === 'manifests' ? 'active' : ''}
      onclick={() => (activeSidebarTab = 'manifests')}
    >
      <ScrollText size={30} style="opacity: 0.6;" />
      <span class="sidebar-title">Manifests</span>
    </button>
    <button
      id={activeSidebarTab === 'graph' ? 'active' : ''}
      onclick={() => (activeSidebarTab = 'graph')}
    >
      <Network size={30} style="opacity: 0.6;" />
      <span class="sidebar-title">Graph</span>
    </button>
    <button
      id={activeSidebarTab === 'vulnerabilities' ? 'active' : ''}
      onclick={() => (activeSidebarTab = 'vulnerabilities')}
    >
      <Bug size={30} style="opacity: 0.6;" />
      <span class="sidebar-title">Vulns</span>
    </button>
  </aside>
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
  :root {
    --header-purple: #23233f;
    --smooth-white: #f0eff6;
    --light-blue: #3dc4ca;
    --smooth-dark: #1a1c29;
    --light-blue-2: #6cb0b6;

    --background-color: #131521;
    --editor-header-background: #212735;
  }
  .layout {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: stretch;
    gap: 1rem;
    overflow: hidden;
    background-color: var(--background-color);
    flex: 1;
  }

  #editor-group {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    align-self: center;
    padding: 0 2rem;
  }

  .text-container {
    flex: 1;
    min-width: 0;
    max-width: 50%;
    height: 75vh;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border-radius: 12.5px;
  }

  .editor-header {
    background-color: var(--editor-header-background);

    display: flex;
    flex-direction: row;
    align-items: center;
    flex-shrink: 0;
    gap: 10px;
    padding: 2.5px 25px;

    position: sticky;
    top: 0;
    z-index: 10;

    color: var(--smooth-white);

    h2 {
      font-family: 'Inter', 'Arial', sans-serif;
      font-weight: 600;
      font-size: 16pt;
    }
  }

  .view-selector {
    display: flex;
    flex-direction: column;

    background-color: var(--smooth-dark);
    min-width: 110px;

    button {
      display: flex;
      flex-direction: column;
      align-items: center;

      border: none;
      background-color: transparent;
      transition: background-color 0.3s ease;

      gap: 5px;
      padding: 25px 20px;

      &:hover {
        cursor: pointer;
        background-color: rgba(255, 255, 255, 0.1);
      }
    }
  }
  .sidebar-title {
    font-family: 'Inter', 'Arial', sans-serif;
    font-weight: 350;
    opacity: 0.7;
  }

  #active {
    background-color: color-mix(in srgb, var(--smooth-dark) 92.5%, white);
    border-left: 5px solid var(--light-blue-2);
  }
</style>
