<script lang="ts">
  import YAMLEditor from '#lib/components/YAMLEditor.svelte';
  import { toast } from 'svelte-sonner';
  import { gunzipSync } from 'fflate';
  import { unpackTar } from 'modern-tar';
  import { renderHelmTemplate } from '#lib';

  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
  const MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;
  const MAX_FILES_COUNT = 1000;

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

<div class="layout">
  <div class="wrapper-editor">
    <div>
      <input type="file" accept=".tgz,.tar.gz" onchange={handleFileUpload} />
    </div>
    <YAMLEditor bind:value={editorContent} />
  </div>
  <section class="view-selector">
    <YAMLEditor value={Object.values(renderedCharts).join('\n---\n')} readOnly />
  </section>
</div>

<style>
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
</style>
