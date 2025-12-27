import { describe, it, expect } from 'vitest';
import { add } from '../src/index.js';

describe('Basic Math', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
