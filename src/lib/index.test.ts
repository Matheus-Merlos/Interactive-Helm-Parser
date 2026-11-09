import { describe, expect, it } from 'vitest';
import * as lib from './index';
import { renderHelmTemplate } from './wasm/helm';

describe('lib index', () => {
  it('re-exports renderHelmTemplate', () => {
    expect(lib.renderHelmTemplate).toBe(renderHelmTemplate);
  });
});
