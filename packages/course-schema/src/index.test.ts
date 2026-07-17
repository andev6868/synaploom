import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateCanonicalFixture } from './index';

function loadJson(relativePath: string): any {
  return JSON.parse(readFileSync(path.resolve(relativePath), 'utf8'));
}

describe('canonical schemas', () => {
  it('publishes versioned canonical schemas', () => {
    const course = loadJson('schemas/v1/course.schema.json');
    expect(course.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(course.$id).toBe('https://schemas.synaploom.dev/v1/course.schema.json');
    expect(course.unevaluatedProperties).toBe(false);
  });

  it('classifies every catalog fixture', () => {
    const catalog = loadJson('schemas/fixtures/catalog.json') as {
      valid: Array<{ schema: string; path: string }>;
      invalid: Array<{ schema: string; path: string }>;
    };
    for (const fixture of catalog.valid) {
      const result = validateCanonicalFixture(
        fixture.schema,
        loadJson(`schemas/fixtures/${fixture.path}`),
      );
      expect(result.valid, fixture.path).toBe(true);
    }
    for (const fixture of catalog.invalid) {
      const result = validateCanonicalFixture(
        fixture.schema,
        loadJson(`schemas/fixtures/${fixture.path}`),
      );
      expect(result.valid, fixture.path).toBe(false);
    }
  });

  it('accepts a schema 1.1 course with chapter assessments', () => {
    const result = validateCanonicalFixture(
      'course',
      loadJson('tests/fixtures/valid-chapter-course/course.json'),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects assessment prerequisites outside the owning chapter', () => {
    const result = validateCanonicalFixture(
      'course',
      loadJson('tests/fixtures/invalid-chapter-course/course.json'),
    );
    expect(result.valid).toBe(false);
    expect(result.path).toContain('requiresLessons');
  });
});
