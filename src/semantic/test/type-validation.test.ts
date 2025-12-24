import { describe, expect, test } from 'bun:test';
import { parse } from '../../parser/parse';
import { SemanticAnalyzer } from '../analyzer';

describe('Semantic Analyzer - Type Validation', () => {
  const analyzer = new SemanticAnalyzer();

  function getErrors(code: string): string[] {
    const ast = parse(code);
    const errors = analyzer.analyze(ast, code);
    return errors.map((e) => e.message);
  }

  // ============================================================================
  // Valid type annotations
  // ============================================================================

  test('text type is valid', () => {
    const errors = getErrors('let x: text = "hello"');
    expect(errors).toEqual([]);
  });

  test('json type is valid', () => {
    const errors = getErrors('let x: json = "{\\"key\\": \\"value\\"}"');
    expect(errors).toEqual([]);
  });

  test('prompt type is valid', () => {
    const errors = getErrors('let x: prompt = "What is your name?"');
    expect(errors).toEqual([]);
  });

  test('no type annotation is valid', () => {
    const errors = getErrors('let x = "hello"');
    expect(errors).toEqual([]);
  });

  // ============================================================================
  // JSON literal validation (compile-time)
  // Note: Invalid type annotations (like "number", "boolean") are rejected
  // at parse time, not semantic analysis time, since the parser only accepts
  // 'text' and 'json' as valid type tokens.
  // ============================================================================

  test('valid JSON object literal passes', () => {
    const errors = getErrors('let x: json = "{\\"name\\": \\"test\\"}"');
    expect(errors).toEqual([]);
  });

  test('valid JSON array literal passes', () => {
    const errors = getErrors('let x: json = "[1, 2, 3]"');
    expect(errors).toEqual([]);
  });

  test('valid empty object literal passes', () => {
    const errors = getErrors('let x: json = "{}"');
    expect(errors).toEqual([]);
  });

  test('valid empty array literal passes', () => {
    const errors = getErrors('let x: json = "[]"');
    expect(errors).toEqual([]);
  });

  test('invalid JSON literal errors', () => {
    const errors = getErrors('let x: json = "{invalid json}"');
    expect(errors).toContain('Invalid JSON literal');
  });

  test('invalid JSON - missing quotes errors', () => {
    const errors = getErrors('let x: json = "{key: value}"');
    expect(errors).toContain('Invalid JSON literal');
  });

  test('invalid JSON - trailing comma errors', () => {
    const errors = getErrors('let x: json = "{\\"key\\": \\"value\\",}"');
    expect(errors).toContain('Invalid JSON literal');
  });

  test('invalid JSON on const errors', () => {
    const errors = getErrors('const x: json = "not json at all"');
    expect(errors).toContain('Invalid JSON literal');
  });

  // ============================================================================
  // JSON type with non-literal (no compile-time check)
  // ============================================================================

  test('json type with variable reference has no compile-time error', () => {
    const code = `
      let source = "{\\"key\\": \\"value\\"}"
      let x: json = source
    `;
    const errors = getErrors(code);
    expect(errors).toEqual([]);
  });

  test('json type with do expression has no compile-time error', () => {
    const code = `
      model myModel = {
        name: "test",
        apiKey: "key",
        url: "http://example.com"
      }
      let x: json = do "return JSON" myModel default
    `;
    const errors = getErrors(code);
    expect(errors).toEqual([]);
  });
});
