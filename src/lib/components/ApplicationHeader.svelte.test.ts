import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ApplicationHeader from './ApplicationHeader.svelte';
import ApplicationHeaderHarness from '../../tests/harness/ApplicationHeaderHarness.svelte';

//Sets the value of a shoelace input and fires the input event
async function typeInto(element: Element, value: string) {
  (element as HTMLInputElement).value = value;
  await fireEvent.input(element);
}

describe('ApplicationHeader', () => {
  it('renders the title and the helm icon', () => {
    render(ApplicationHeader, { onChartUpload: vi.fn() });

    expect(screen.getByRole('heading', { name: 'Helm Lab' })).toBeInTheDocument();
    expect(screen.getByAltText('Helm Icon')).toHaveAttribute('src', 'img/helm.png');
  });

  it('shows the upload label when there is no file', () => {
    render(ApplicationHeader, { onChartUpload: vi.fn() });

    expect(screen.getByText('Upload Chart')).toBeInTheDocument();
  });

  it('shows the file name when a file was uploaded', () => {
    render(ApplicationHeader, { onChartUpload: vi.fn(), fileName: 'chart-1.0.0.tgz' });

    expect(screen.getByText('chart-1.0.0.tgz')).toBeInTheDocument();
    expect(screen.queryByText('Upload Chart')).not.toBeInTheDocument();
  });

  it('accepts only tar.gz files', () => {
    const { container } = render(ApplicationHeader, { onChartUpload: vi.fn() });

    const input = container.querySelector('#tar-upload');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.tar.gz,.tgz');
  });

  it('calls onChartUpload when a file is selected', async () => {
    const onChartUpload = vi.fn();
    const { container } = render(ApplicationHeader, { onChartUpload });

    await fireEvent.change(container.querySelector('#tar-upload')!);

    expect(onChartUpload).toHaveBeenCalledOnce();
    expect(onChartUpload.mock.calls[0][0]).toBeInstanceOf(Event);
  });

  it('passes the release values to the inputs', () => {
    const { container } = render(ApplicationHeader, {
      onChartUpload: vi.fn(),
      releaseName: 'my-release',
      releaseNamespace: 'production',
    });

    const [name, namespace] = container.querySelectorAll('sl-input');
    expect(name).toHaveAttribute('value', 'my-release');
    expect(namespace).toHaveAttribute('value', 'production');
  });

  it('binds the release name and namespace', async () => {
    const { container } = render(ApplicationHeaderHarness, { onChartUpload: vi.fn() });
    const [name, namespace] = container.querySelectorAll('sl-input');

    await typeInto(name, 'my-release');
    await typeInto(namespace, 'staging');

    expect(screen.getByTestId('release-name')).toHaveTextContent('my-release');
    expect(screen.getByTestId('release-namespace')).toHaveTextContent('staging');
  });

  it('renders the settings button', () => {
    const { container } = render(ApplicationHeader, { onChartUpload: vi.fn() });

    expect(container.querySelector('button.settings svg.lucide-bolt')).toBeInTheDocument();
  });
});
