/* eslint-disable @typescript-eslint/no-explicit-any */
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function initHelmWasm(): Promise<void> {
  if (isLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (!(window as any).Go) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/wasm/wasm_exec.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Fail while loading wasm_exec.js'));
        document.head.appendChild(script);
      });
    }

    const Go = (window as any).Go;
    const go = new Go();

    const response = await fetch('/wasm/helm-template.wasm');
    if (!response.ok) {
      throw new Error(`Error while downloading WASM Binary: ${response.statusText}`);
    }

    const result = await WebAssembly.instantiateStreaming(response, go.importObject);

    go.run(result.instance);

    isLoaded = true;
  })();

  return loadPromise;
}

export async function renderHelmTemplate(
  files: Record<string, string>,
  valuesStr: string,
  chartName?: string,
  chartVersion?: string,
  releaseName?: string,
  namespace?: string,
): Promise<Record<string, string>> {
  await initHelmWasm();

  const helmFn = (window as any).helmV3Template;
  if (!helmFn) {
    throw new Error('The function helmV3Template was not exposed in webassembly.');
  }

  const filesJSON = JSON.stringify(files);
  const result = helmFn(filesJSON, valuesStr, chartName, chartVersion, releaseName, namespace);

  if (typeof result === 'object' && result !== null) {
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  }

  if (typeof result === 'string') {
    const parsed = JSON.parse(result);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return parsed;
  }

  throw new Error('Unexpected return type from helmV3Template');
}
