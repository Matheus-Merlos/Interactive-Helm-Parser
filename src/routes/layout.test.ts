import { describe, expect, it } from 'vitest';
import { prerender, ssr } from './+layout';

describe('layout options', () => {
  it('disables ssr and prerender', () => {
    expect(ssr).toBe(false);
    expect(prerender).toBe(false);
  });
});
