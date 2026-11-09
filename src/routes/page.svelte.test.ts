import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { gunzipSync, gzipSync } from 'fflate';
import { packTar, unpackTar } from 'modern-tar';
import { toast } from 'svelte-sonner';
import { renderHelmTemplate } from '#lib';
import Page from './+page.svelte';

vi.mock('#lib', () => ({ renderHelmTemplate: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@shoelace-style/shoelace/dist/components/input/input.js', () => ({}));

//Heavy components are replaced by stubs
vi.mock('#lib/components/YAMLEditor.svelte', async () => ({
  default: (await import('../tests/stubs/YAMLEditorStub.svelte')).default,
}));
vi.mock('#lib/components/GraphView.svelte', async () => ({
  default: (await import('../tests/stubs/GraphViewStub.svelte')).default,
}));

//Real implementations wrapped in spies
vi.mock('fflate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fflate')>();
  return { ...actual, gunzipSync: vi.fn(actual.gunzipSync) };
});
vi.mock('modern-tar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('modern-tar')>();
  return { ...actual, unpackTar: vi.fn(actual.unpackTar) };
});

const CHART_YAML = 'apiVersion: v2\nname: mychart\nversion: 1.2.3\n';
const VALUES_YAML = 'replicaCount: 1\n';
const DEPLOYMENT = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec: {}\n';

const defaultChart = {
  'mychart/Chart.yaml': CHART_YAML,
  'mychart/values.yaml': VALUES_YAML,
  'mychart/templates/deployment.yaml': 'template',
  'mychart/templates/NOTES.txt': 'notes',
  'mychart/.helmignore': '*.tmp',
};

//Packs the files into a .tar.gz File
async function createChart(files: Record<string, string>, name = 'mychart-1.2.3.tgz') {
  const encoder = new TextEncoder();
  const tar = await packTar([
    { header: { name: 'mychart/', size: 0, type: 'directory' } },
    ...Object.entries(files).map(([path, content]) => ({
      header: { name: path, size: encoder.encode(content).byteLength, type: 'file' as const },
      body: content,
    })),
  ]);
  return new File([gzipSync(tar)], name);
}

//Selects files on the hidden upload input
async function upload(container: HTMLElement, files: Array<File>) {
  const input = container.querySelector('#tar-upload') as HTMLInputElement;
  await fireEvent.change(input, { target: { files } });
}

async function uploadChart(container: HTMLElement, files: Record<string, string> = defaultChart) {
  await upload(container, [await createChart(files)]);
}

function getValuesEditor() {
  return screen.getByTestId('values-editor') as HTMLTextAreaElement;
}

function getManifestsEditor() {
  return screen.getByTestId('manifests-editor') as HTMLTextAreaElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(renderHelmTemplate).mockResolvedValue({
    'templates/deployment.yaml': DEPLOYMENT,
    'templates/extra.yaml': 'foo: bar',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Page', () => {
  it('renders the empty state', () => {
    render(Page);

    expect(screen.getByText('Upload Chart')).toBeInTheDocument();
    expect(getValuesEditor().value).toBe('');
    expect(getManifestsEditor().value).toBe('');
    expect(renderHelmTemplate).not.toHaveBeenCalled();
  });

  describe('chart upload', () => {
    it('parses a valid chart and renders the templates', async () => {
      const { container } = render(Page);

      await uploadChart(container);

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Helm chart successfully parsed!'),
      );
      expect(getValuesEditor().value).toBe(VALUES_YAML);
      expect(screen.getByText('mychart-1.2.3.tgz')).toBeInTheDocument();
      expect(renderHelmTemplate).toHaveBeenCalledWith(
        {
          'Chart.yaml': CHART_YAML,
          'values.yaml': VALUES_YAML,
          'templates/deployment.yaml': 'template',
        },
        VALUES_YAML,
        'mychart',
        '1.2.3',
        '',
        '',
      );
    });

    it('shows the rendered manifests and parses them for the graph', async () => {
      const { container } = render(Page);

      await uploadChart(container);

      await waitFor(() => expect(getManifestsEditor().value).toBe(`${DEPLOYMENT}\n---\nfoo: bar`));
      expect(screen.getByTestId('graph-view')).toHaveTextContent('Deployment/web');
    });

    it('uses default metadata when Chart.yaml has no name or version', async () => {
      const { container } = render(Page);

      await uploadChart(container, {
        'mychart/Chart.yml': 'apiVersion: v2\n',
        'mychart/values.yml': VALUES_YAML,
      });

      await waitFor(() =>
        expect(renderHelmTemplate).toHaveBeenCalledWith(
          expect.any(Object),
          VALUES_YAML,
          'chart',
          '0.1.0',
          '',
          '',
        ),
      );
    });

    it('keeps paths without a common folder prefix', async () => {
      const { container } = render(Page);

      await uploadChart(container, {
        'README.md': 'readme',
        'nested/Chart.yaml': CHART_YAML,
        'nested/values.yaml': VALUES_YAML,
      });

      //Chart.yaml is not at the root, so there is no metadata
      await waitFor(() =>
        expect(renderHelmTemplate).toHaveBeenCalledWith(
          {
            'README.md': 'readme',
            'nested/Chart.yaml': CHART_YAML,
            'nested/values.yaml': VALUES_YAML,
          },
          VALUES_YAML,
          undefined,
          undefined,
          '',
          '',
        ),
      );
    });

    it('rejects packages without Chart.yaml or values.yaml', async () => {
      const { container } = render(Page);

      await uploadChart(container, { 'mychart/Chart.yaml': CHART_YAML });

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'The uploaded package is not a valid helm chart (Chart.yaml or values.yaml are absent)',
        ),
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(renderHelmTemplate).not.toHaveBeenCalled();
    });

    it('ignores the change event when no file is selected', async () => {
      const { container } = render(Page);

      await upload(container, []);

      expect(gunzipSync).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('rejects files bigger than 50MB', async () => {
      const { container } = render(Page);
      const file = new File(['data'], 'big.tgz');
      Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 });

      await upload(container, [file]);

      expect(toast.error).toHaveBeenCalledWith('Maximum file size is 50MB.');
      expect(screen.getByText('Upload Chart')).toBeInTheDocument();
    });

    it('rejects files that are not gzip', async () => {
      const { container } = render(Page);

      await upload(container, [new File(['plain text'], 'chart.tgz')]);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Error: the uploaded file is not a valid .tar.gz.',
        ),
      );
      expect(screen.getByText('Upload Chart')).toBeInTheDocument();
    });

    it('rejects archives bigger than 100MB when uncompressed', async () => {
      const { container } = render(Page);
      vi.mocked(gunzipSync).mockReturnValueOnce({
        byteLength: 100 * 1024 * 1024 + 1,
      } as Uint8Array<ArrayBuffer>);

      await uploadChart(container);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Uncompressed file size exceeded.'),
      );
      expect(unpackTar).not.toHaveBeenCalled();
    });

    it('warns when the archive has more than 1000 files', async () => {
      const { container } = render(Page);
      const data = new TextEncoder().encode('content');
      const entries = Array.from({ length: 1001 }, (_, i) => ({
        header: { name: `mychart/file-${i}.yaml`, size: data.byteLength, type: 'file' as const },
        data,
      }));
      vi.mocked(unpackTar).mockResolvedValueOnce(entries);

      await uploadChart(container);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('File limit exceeded.'));
    });

    it('shows the error message when the archive cannot be read', async () => {
      const { container } = render(Page);
      vi.mocked(unpackTar).mockRejectedValueOnce(new Error('corrupted archive'));

      await uploadChart(container);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('corrupted archive'));
      expect(screen.getByText('Upload Chart')).toBeInTheDocument();
    });

    it('shows a generic error when the error has no message', async () => {
      const { container } = render(Page);
      vi.mocked(unpackTar).mockRejectedValueOnce(new Error());

      await uploadChart(container);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Error while processing helm chart.'),
      );
    });
  });

  describe('rendering', () => {
    it('shows an error when the template rendering fails', async () => {
      vi.mocked(renderHelmTemplate).mockRejectedValue(new Error('boom'));
      const { container } = render(Page);

      await uploadChart(container);

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error while rendering: boom'));
      expect(getManifestsEditor().value).toBe('');
    });

    it('renders again when the values change', async () => {
      const { container } = render(Page);
      await uploadChart(container);
      await waitFor(() => expect(renderHelmTemplate).toHaveBeenCalled());

      await fireEvent.input(getValuesEditor(), { target: { value: 'replicaCount: 3' } });

      await waitFor(() =>
        expect(renderHelmTemplate).toHaveBeenLastCalledWith(
          expect.any(Object),
          'replicaCount: 3',
          'mychart',
          '1.2.3',
          '',
          '',
        ),
      );
    });

    it('renders again when the release name and namespace change', async () => {
      const { container } = render(Page);
      await uploadChart(container);
      await waitFor(() => expect(renderHelmTemplate).toHaveBeenCalled());

      const [name, namespace] = container.querySelectorAll('sl-input');
      name.value = 'my-release';
      await fireEvent.input(name);
      namespace.value = 'production';
      await fireEvent.input(namespace);

      await waitFor(() =>
        expect(renderHelmTemplate).toHaveBeenLastCalledWith(
          expect.any(Object),
          VALUES_YAML,
          'mychart',
          '1.2.3',
          'my-release',
          'production',
        ),
      );
      expect(screen.getByTestId('graph-view')).toHaveAttribute('data-release', 'my-release');
    });
  });

  describe('sidebar', () => {
    it('shows the manifests tab by default', () => {
      render(Page);

      expect(screen.getByText('Rendered Manifests').closest('.tab-pane')).not.toHaveClass('hidden');
      expect(screen.getByText('Graph View').closest('.tab-pane')).toHaveClass('hidden');
      expect(screen.getByRole('button', { name: 'Manifests' })).toHaveAttribute('id', 'active');
    });

    it('switches between the manifests and graph tabs', async () => {
      render(Page);

      await fireEvent.click(screen.getByRole('button', { name: 'Graph' }));

      expect(screen.getByText('Rendered Manifests').closest('.tab-pane')).toHaveClass('hidden');
      expect(screen.getByText('Graph View').closest('.tab-pane')).not.toHaveClass('hidden');
      expect(screen.getByRole('button', { name: 'Graph' })).toHaveAttribute('id', 'active');
      expect(screen.getByRole('button', { name: 'Manifests' })).toHaveAttribute('id', '');

      await fireEvent.click(screen.getByRole('button', { name: 'Manifests' }));

      expect(screen.getByText('Rendered Manifests').closest('.tab-pane')).not.toHaveClass('hidden');
    });
  });

  describe('downloads', () => {
    const downloads: Array<{ href: string; download: string }> = [];
    const blobs: Array<Blob> = [];

    beforeEach(() => {
      downloads.length = 0;
      blobs.length = 0;

      //jsdom does not implement object urls nor navigation
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:download';
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push({ href: this.href, download: this.download });
      });
    });

    it('downloads the values file', async () => {
      const { container } = render(Page);
      await uploadChart(container);
      await waitFor(() => expect(getValuesEditor().value).toBe(VALUES_YAML));

      await fireEvent.click(screen.getByRole('button', { name: 'Download Values' }));

      expect(downloads).toEqual([{ href: 'blob:download', download: 'values.yaml' }]);
      expect(await blobs[0].text()).toBe(VALUES_YAML);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download');
      expect(document.querySelector('a[download]')).not.toBeInTheDocument();
    });

    it.each([0, 1])('downloads the rendered manifests from button %i', async (index) => {
      const { container } = render(Page);
      await uploadChart(container);
      await waitFor(() => expect(getManifestsEditor().value).not.toBe(''));

      await fireEvent.click(screen.getAllByRole('button', { name: 'Download Manifests' })[index]);

      expect(downloads).toEqual([{ href: 'blob:download', download: 'manifests.yaml' }]);
      expect(await blobs[0].text()).toBe(`${DEPLOYMENT}\n---\nfoo: bar`);
    });
  });
});
