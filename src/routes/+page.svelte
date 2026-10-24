<script lang="ts">
  import { Bolt, Upload } from 'lucide-svelte';
  import '@shoelace-style/shoelace/dist/components/input/input.js';

  import YAMLEditor from '#lib/components/YAMLEditor.svelte';
  import { toast } from 'svelte-sonner';
  import { gunzipSync } from 'fflate';
  import { unpackTar } from 'modern-tar';
  import { renderHelmTemplate } from '#lib';

  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
  const MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;
  const MAX_FILES_COUNT = 1000;

  let fileName = $state<string | null>(null);

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

    renderHelmTemplate(files, content, name, version)
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
    fileName = null;
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

<header class="header">
  <div class="icon-container">
    <img src="img/helm.png" alt="Helm Icon" id="icon" />
    <h1>Helm Lab</h1>
  </div>
  <div class="upload-container">
    <input
      type="file"
      id="tar-upload"
      class="hidden-input"
      accept=".tar.gz,.tgz"
      onchange={handleFileUpload}
    />
    <label for="tar-upload" class="upload-button">
      <Upload size={18} />
      <span>{fileName ? fileName : 'Upload Chart'}</span>
    </label>
  </div>
  <div class="other-inputs-container">
    <sl-input
      label="Release Name"
      filled
      placeholder="Release name..."
      size="small"
      class="sl-header-input"
      value={releaseName}
      oninput={(e: Event) => (releaseName = (e.target as HTMLInputElement).value)}
    >
    </sl-input>
    <sl-input
      label="Namespace"
      filled
      placeholder="Namespace..."
      size="small"
      class="sl-header-input"
      value={releaseNamespace}
      oninput={(e: Event) => (releaseNamespace = (e.target as HTMLInputElement).value)}
    >
    </sl-input>
  </div>
  <div class="settings-container">
    <button class="settings">
      <Bolt size="100%" />
    </button>
  </div>
</header>
<div class="layout">
  <div class="wrapper-editor">
    <YAMLEditor bind:value={editorContent} />
  </div>
  <section class="view-selector">
    <YAMLEditor value={Object.values(renderedCharts).join('\n---\n')} readOnly />
  </section>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
  :root {
    --header-purple: #23233f;
    --smooth-white: #f0eff6;
    --light-blue: #3dc4ca;
  }
  .header {
    display: grid;
    height: 100px;
    align-items: center;
    grid-template-columns: 1.33fr 0.5fr 1fr auto;
    gap: 1.5rem;
    padding: 0 1.5rem;

    background-color: var(--header-purple);

    h1 {
      font-family: 'Noto Sans', sans-serif;
      font-weight: bolder;
      font-size: 24pt;
      color: var(--smooth-white);
    }
  }
  .icon-container {
    display: flex;
  }
  .other-inputs-container {
    display: flex;
    gap: 1rem;
    width: 100%;
  }
  #icon {
    object-fit: contain;
    width: 72px;
    padding-right: 15px;
  }
  .layout {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    height: 80vh;
  }
  .wrapper-editor {
    flex: 1;
  }
  .view-selector {
    flex: 1;
  }

  /* upload hbutton */
  .hidden-input {
    display: none;
  }
  .upload-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background-color: var(--light-blue);
    padding: 10px 18px;
    border-radius: 8px;
    user-select: none;

    max-width: 250px;
    overflow: hidden;

    font-family: 'Inter', 'arial', sans-serif;
    transition:
      background-color 0.2s ease,
      transform 0.1s ease;

    &:hover {
      cursor: pointer;
      background-color: color-mix(in srgb, var(--light-blue) 65%, white);
    }

    &:active {
      transform: scale(0.975);
    }

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  /* Other header inputs */
  .sl-header-input {
    flex: 1;

    --sl-input-label-color: var(--light-blue);

    &::part(base) {
      background-color: rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      transition: border-color 0.2s ease;
    }

    &::part(base):hover {
      border-color: var(--light-blue);
    }

    &::part(base):focus-within {
      border-color: var(--light-blue);
      box-shadow: 0 0 0 2px rgba(61, 196, 202, 0.2);
    }
  }
  .settings {
    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 50%;
    border: none;
    background-color: transparent;
    color: var(--smooth-white);

    width: 45px;
    height: 45px;

    transition: background-color 0.15s ease;

    &:hover {
      cursor: pointer;
      background-color: rgba(255, 255, 255, 0.05);
    }
  }
  .settings-container {
    display: flex;
    justify-content: end;
    height: 100%;
    align-items: center;
  }
</style>
