import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { setBasePath } from '@shoelace-style/shoelace';
import Layout from './+layout.svelte';

//Avoids registering every shoelace component
vi.mock('@shoelace-style/shoelace', () => ({ setBasePath: vi.fn() }));

const children = createRawSnippet(() => ({ render: () => '<p>page content</p>' }));

describe('Layout', () => {
  it('sets the shoelace assets path', () => {
    render(Layout, { children, data: {}, params: {} });

    expect(setBasePath).toHaveBeenCalledWith('/assets/shoelace');
  });

  it('renders the children inside the dark app shell', () => {
    const { container } = render(Layout, { children, data: {}, params: {} });

    const shell = container.querySelector('.app-shell');
    expect(shell).toHaveClass('sl-theme-dark');
    expect(shell).toContainElement(screen.getByText('page content'));
  });
});
