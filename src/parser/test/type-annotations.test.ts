import { describe, expect, test } from 'bun:test';
import { parse } from '../parse';

describe('Parser - Type Annotations', () => {
  // ============================================================================
  // Let with type annotations
  // ============================================================================

  test('let with text type', () => {
    const ast = parse('let x: text = "hello"');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      typeAnnotation: 'text',
      initializer: {
        type: 'StringLiteral',
        value: 'hello',
      },
    });
  });

  test('let with json type', () => {
    const ast = parse('let x: json = "{\\"key\\": \\"value\\"}"');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      typeAnnotation: 'json',
      initializer: {
        type: 'StringLiteral',
      },
    });
  });

  test('let with text type no initializer', () => {
    const ast = parse('let x: text');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      typeAnnotation: 'text',
      initializer: null,
    });
  });

  test('let with json type no initializer', () => {
    const ast = parse('let x: json');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      typeAnnotation: 'json',
      initializer: null,
    });
  });

  test('let without type annotation (null)', () => {
    const ast = parse('let x = "hello"');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      typeAnnotation: null,
    });
  });

  // ============================================================================
  // Const with type annotations
  // ============================================================================

  test('const with text type', () => {
    const ast = parse('const x: text = "hello"');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'ConstDeclaration',
      name: 'x',
      typeAnnotation: 'text',
      initializer: {
        type: 'StringLiteral',
        value: 'hello',
      },
    });
  });

  test('const with json type', () => {
    const ast = parse('const x: json = "[]"');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'ConstDeclaration',
      name: 'x',
      typeAnnotation: 'json',
      initializer: {
        type: 'StringLiteral',
        value: '[]',
      },
    });
  });

  test('const without type annotation (null)', () => {
    const ast = parse('const x = "hello"');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'ConstDeclaration',
      name: 'x',
      typeAnnotation: null,
    });
  });
});
