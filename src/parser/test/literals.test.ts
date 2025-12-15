import { describe, expect, test } from 'bun:test';
import { parse } from '../parse';

describe('Parser - Object and Array Literals', () => {
  // ============================================================================
  // Object Literals
  // ============================================================================

  test('empty object literal', () => {
    const ast = parse('let x = {}');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      initializer: {
        type: 'ObjectLiteral',
        properties: [],
      },
    });
  });

  test('object literal with one property', () => {
    const ast = parse('let x = {name: "test"}');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      initializer: {
        type: 'ObjectLiteral',
        properties: [
          {
            type: 'ObjectProperty',
            key: 'name',
            value: { type: 'StringLiteral', value: 'test' },
          },
        ],
      },
    });
  });

  test('object literal with multiple properties', () => {
    const ast = parse('let x = {name: "test", count: "42", active: true}');
    expect(ast.body).toHaveLength(1);
    const obj = (ast.body[0] as any).initializer;
    expect(obj.type).toBe('ObjectLiteral');
    expect(obj.properties).toHaveLength(3);
    expect(obj.properties[0].key).toBe('name');
    expect(obj.properties[1].key).toBe('count');
    expect(obj.properties[2].key).toBe('active');
  });

  test('nested object literal', () => {
    const ast = parse('let x = {user: {name: "alice"}}');
    expect(ast.body).toHaveLength(1);
    const obj = (ast.body[0] as any).initializer;
    expect(obj.type).toBe('ObjectLiteral');
    expect(obj.properties[0].key).toBe('user');
    expect(obj.properties[0].value.type).toBe('ObjectLiteral');
    expect(obj.properties[0].value.properties[0].key).toBe('name');
  });

  // ============================================================================
  // Array Literals
  // ============================================================================

  test('empty array literal', () => {
    const ast = parse('let x = []');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      initializer: {
        type: 'ArrayLiteral',
        elements: [],
      },
    });
  });

  test('array literal with one element', () => {
    const ast = parse('let x = ["hello"]');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'x',
      initializer: {
        type: 'ArrayLiteral',
        elements: [{ type: 'StringLiteral', value: 'hello' }],
      },
    });
  });

  test('array literal with multiple elements', () => {
    const ast = parse('let x = ["a", "b", "c"]');
    expect(ast.body).toHaveLength(1);
    const arr = (ast.body[0] as any).initializer;
    expect(arr.type).toBe('ArrayLiteral');
    expect(arr.elements).toHaveLength(3);
  });

  test('array literal with mixed types', () => {
    const ast = parse('let x = ["text", true, false]');
    expect(ast.body).toHaveLength(1);
    const arr = (ast.body[0] as any).initializer;
    expect(arr.elements[0].type).toBe('StringLiteral');
    expect(arr.elements[1].type).toBe('BooleanLiteral');
    expect(arr.elements[2].type).toBe('BooleanLiteral');
  });

  test('nested array literal', () => {
    const ast = parse('let x = [["a", "b"], ["c"]]');
    expect(ast.body).toHaveLength(1);
    const arr = (ast.body[0] as any).initializer;
    expect(arr.type).toBe('ArrayLiteral');
    expect(arr.elements[0].type).toBe('ArrayLiteral');
    expect(arr.elements[1].type).toBe('ArrayLiteral');
  });

  // ============================================================================
  // Combined object and array literals
  // ============================================================================

  test('array of objects', () => {
    const ast = parse('let x = [{name: "alice"}, {name: "bob"}]');
    expect(ast.body).toHaveLength(1);
    const arr = (ast.body[0] as any).initializer;
    expect(arr.type).toBe('ArrayLiteral');
    expect(arr.elements[0].type).toBe('ObjectLiteral');
    expect(arr.elements[1].type).toBe('ObjectLiteral');
  });

  test('object with array property', () => {
    const ast = parse('let x = {items: ["a", "b"]}');
    expect(ast.body).toHaveLength(1);
    const obj = (ast.body[0] as any).initializer;
    expect(obj.type).toBe('ObjectLiteral');
    expect(obj.properties[0].value.type).toBe('ArrayLiteral');
  });

  // ============================================================================
  // Block statement vs object literal disambiguation
  // ============================================================================

  test('empty braces as block statement', () => {
    const ast = parse('{}');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'BlockStatement',
      body: [],
    });
  });

  test('braces with statement inside is block', () => {
    const ast = parse('{ let x = "inside" }');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'BlockStatement',
    });
  });

  test('braces with key:value is object literal expression', () => {
    const ast = parse('{key: "value"}');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'ExpressionStatement',
      expression: {
        type: 'ObjectLiteral',
        properties: [{ key: 'key' }],
      },
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================

  test('object literal in function return', () => {
    const ast = parse(`
      function getData() {
        return {name: "test"}
      }
    `);
    const func = ast.body[0] as any;
    const returnStmt = func.body.body[0];
    expect(returnStmt.type).toBe('ReturnStatement');
    expect(returnStmt.value.type).toBe('ObjectLiteral');
  });

  test('array literal in function return', () => {
    const ast = parse(`
      function getItems() {
        return ["a", "b"]
      }
    `);
    const func = ast.body[0] as any;
    const returnStmt = func.body.body[0];
    expect(returnStmt.type).toBe('ReturnStatement');
    expect(returnStmt.value.type).toBe('ArrayLiteral');
  });

  test('object literal as function argument', () => {
    const ast = parse('myFunc({name: "test"})');
    const call = (ast.body[0] as any).expression;
    expect(call.type).toBe('CallExpression');
    expect(call.arguments[0].type).toBe('ObjectLiteral');
  });

  test('array literal as function argument', () => {
    const ast = parse('myFunc(["a", "b"])');
    const call = (ast.body[0] as any).expression;
    expect(call.type).toBe('CallExpression');
    expect(call.arguments[0].type).toBe('ArrayLiteral');
  });

  test('object literal in const declaration', () => {
    const ast = parse('const config = {debug: true}');
    expect(ast.body[0]).toMatchObject({
      type: 'ConstDeclaration',
      name: 'config',
      initializer: {
        type: 'ObjectLiteral',
      },
    });
  });

  test('deeply nested structure', () => {
    const ast = parse('let x = {a: {b: {c: {d: "deep"}}}}');
    const obj = (ast.body[0] as any).initializer;
    expect(obj.properties[0].value.properties[0].value.properties[0].value.properties[0].key).toBe('d');
  });

  test('object with many properties', () => {
    const ast = parse('let x = {a: "1", b: "2", c: "3", d: "4", e: "5"}');
    const obj = (ast.body[0] as any).initializer;
    expect(obj.properties).toHaveLength(5);
  });

  test('array with many elements', () => {
    const ast = parse('let x = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]');
    const arr = (ast.body[0] as any).initializer;
    expect(arr.elements).toHaveLength(10);
  });
});
