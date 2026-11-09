import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { EditorView } from '@codemirror/view';
import YAMLEditor from './YAMLEditor.svelte';
import YAMLEditorHarness from '../../tests/harness/YAMLEditorHarness.svelte';

//Gets the CodeMirror view mounted inside the container
function getView(container: HTMLElement): EditorView {
  const editor = container.querySelector('.cm-editor') as HTMLElement;
  return EditorView.findFromDOM(editor)!;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('YAMLEditor', () => {
  it('renders the initial value', () => {
    const { container } = render(YAMLEditor, { value: 'replicas: 3' });

    expect(getView(container).state.doc.toString()).toBe('replicas: 3');
  });

  it('is editable by default', () => {
    const { container } = render(YAMLEditor);

    expect(container.querySelector('.editor-container')).not.toHaveClass('read-only');
    expect(container.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'true');
  });

  it('is not editable when readOnly is set', () => {
    const { container } = render(YAMLEditor, { value: 'a: 1', readOnly: true });

    expect(container.querySelector('.editor-container')).toHaveClass('read-only');
    expect(container.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false');
  });

  it('updates the bound value when the document changes', async () => {
    const { container } = render(YAMLEditorHarness);
    const view = getView(container);

    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'key: changed' } });

    expect(await screen.findByText('key: changed')).toBeInTheDocument();
  });

  it('ignores updates that do not change the document', async () => {
    const { container } = render(YAMLEditorHarness);

    getView(container).dispatch({ selection: { anchor: 1 } });

    expect(screen.getByTestId('value')).toHaveTextContent('key: value');
  });

  it('syncs the editor when the value changes externally', async () => {
    const { container } = render(YAMLEditorHarness);

    await fireEvent.click(screen.getByText('external'));

    expect(getView(container).state.doc.toString()).toBe('external: true');
  });

  it('does not dispatch when the value matches the document', async () => {
    const { container, rerender } = render(YAMLEditor, { value: 'same: 1' });
    const dispatch = vi.spyOn(getView(container), 'dispatch');

    await rerender({ value: 'same: 1', readOnly: false });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('destroys the editor on unmount', () => {
    const { container, unmount } = render(YAMLEditor, { value: 'a: 1' });
    const destroy = vi.spyOn(getView(container), 'destroy');

    unmount();

    expect(destroy).toHaveBeenCalled();
  });
});
