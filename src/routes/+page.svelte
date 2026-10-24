<script lang="ts">
  import YAMLEditor from '#lib/components/YAMLEditor.svelte';
  import { toast } from 'svelte-sonner';
  import { gunzipSync } from 'fflate';
  import { unpackTar } from 'modern-tar';

  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
  const MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;
  const MAX_FILES_COUNT = 1000;

  let editorContent = $state<string>('');
  let isValidHelmChart = $state<boolean>(false);
  let chartFiles = $state<Record<string, string>>({});
  let chartMetadata = $state<{ name: string; version: string } | null>(null);

  $effect(() => {
    console.log(chartFiles);
  });

  function clearState() {
    chartFiles = {};
    isValidHelmChart = false;
    chartMetadata = null;
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
      isValidHelmChart = false;
      chartFiles = {};
      return;
    }

    isValidHelmChart = true;
    chartFiles = files;

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

      validateHelmChart(files);
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
    <h2>Teste</h2>
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
