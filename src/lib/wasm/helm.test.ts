// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HelmModule = typeof import('./helm');

const run = vi.fn();
const instance = { exports: {} };

//Fake Go runtime exposed by wasm_exec.js
class FakeGo {
  importObject = { go: {} };
  run = run;
}

//Fresh module so the loaded state is reset
async function loadModule(): Promise<HelmModule> {
  vi.resetModules();
  return import('./helm');
}

function mockFetch(ok = true, statusText = 'OK') {
  const response = { ok, statusText };
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, response };
}

beforeEach(() => {
  run.mockReset();
  vi.spyOn(WebAssembly, 'instantiateStreaming').mockResolvedValue({
    instance,
  } as unknown as WebAssembly.WebAssemblyInstantiatedSource);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).Go;
  delete (window as unknown as Record<string, unknown>).helmV3Template;
});

describe('initHelmWasm', () => {
  it('loads wasm_exec.js when Go is not available', async () => {
    const { initHelmWasm } = await loadModule();
    mockFetch();

    //Simulates the script loading and exposing Go
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      vi.stubGlobal('Go', FakeGo);
      (node as HTMLScriptElement).onload?.(new Event('load'));
      return node;
    });

    await initHelmWasm();

    const script = append.mock.calls[0][0] as HTMLScriptElement;
    expect(script.src).toContain('/wasm/wasm_exec.js');
    expect(run).toHaveBeenCalledWith(instance);
  });

  it('rejects when wasm_exec.js fails to load', async () => {
    const { initHelmWasm } = await loadModule();

    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      (node as HTMLScriptElement).onerror?.(new Event('error'));
      return node;
    });

    await expect(initHelmWasm()).rejects.toThrow('Fail while loading wasm_exec.js');
  });

  it('skips the script when Go is already available', async () => {
    const { initHelmWasm } = await loadModule();
    const { fetchMock, response } = mockFetch();
    vi.stubGlobal('Go', FakeGo);
    const append = vi.spyOn(document.head, 'appendChild');

    await initHelmWasm();

    expect(append).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/wasm/helm-template.wasm');
    expect(WebAssembly.instantiateStreaming).toHaveBeenCalledWith(response, { go: {} });
  });

  it('throws when the wasm binary download fails', async () => {
    const { initHelmWasm } = await loadModule();
    mockFetch(false, 'Not Found');
    vi.stubGlobal('Go', FakeGo);

    await expect(initHelmWasm()).rejects.toThrow('Error while downloading WASM Binary: Not Found');
    expect(run).not.toHaveBeenCalled();
  });

  it('loads the binary only once', async () => {
    const { initHelmWasm } = await loadModule();
    const { fetchMock } = mockFetch();
    vi.stubGlobal('Go', FakeGo);

    //Concurrent calls share the same promise
    await Promise.all([initHelmWasm(), initHelmWasm()]);
    //Calls after loading return right away
    await initHelmWasm();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('renderHelmTemplate', () => {
  const files = { 'Chart.yaml': 'name: demo' };

  async function setup(helmFn?: (...args: unknown[]) => unknown) {
    const module = await loadModule();
    mockFetch();
    vi.stubGlobal('Go', FakeGo);
    if (helmFn) vi.stubGlobal('helmV3Template', vi.fn(helmFn));
    return module;
  }

  it('throws when helmV3Template is not exposed', async () => {
    const { renderHelmTemplate } = await setup();

    await expect(renderHelmTemplate(files, '')).rejects.toThrow(
      'The function helmV3Template was not exposed in webassembly.',
    );
  });

  it('passes the serialized files and options to helmV3Template', async () => {
    const { renderHelmTemplate } = await setup(() => ({}));

    await renderHelmTemplate(files, 'replicas: 1', 'demo', '1.0.0', 'release', 'default');

    expect((window as unknown as Record<string, unknown>).helmV3Template).toHaveBeenCalledWith(
      JSON.stringify(files),
      'replicas: 1',
      'demo',
      '1.0.0',
      'release',
      'default',
    );
  });

  it('returns the rendered object', async () => {
    const rendered = { 'templates/deploy.yaml': 'kind: Deployment' };
    const { renderHelmTemplate } = await setup(() => rendered);

    await expect(renderHelmTemplate(files, '')).resolves.toEqual(rendered);
  });

  it('throws the error from an object result', async () => {
    const { renderHelmTemplate } = await setup(() => ({ error: 'template failed' }));

    await expect(renderHelmTemplate(files, '')).rejects.toThrow('template failed');
  });

  it('parses a JSON string result', async () => {
    const rendered = { 'templates/svc.yaml': 'kind: Service' };
    const { renderHelmTemplate } = await setup(() => JSON.stringify(rendered));

    await expect(renderHelmTemplate(files, '')).resolves.toEqual(rendered);
  });

  it('throws the error from a JSON string result', async () => {
    const { renderHelmTemplate } = await setup(() => JSON.stringify({ error: 'bad values' }));

    await expect(renderHelmTemplate(files, '')).rejects.toThrow('bad values');
  });

  it.each([null, 42, undefined])('throws on unexpected result %s', async (value) => {
    const { renderHelmTemplate } = await setup(() => value);

    await expect(renderHelmTemplate(files, '')).rejects.toThrow(
      'Unexpected return type from helmV3Template',
    );
  });
});
