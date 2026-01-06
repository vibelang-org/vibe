import { describe, expect, test } from 'bun:test';
import { parse } from '../parse';

describe('Parser - Call Expression Context Mode', () => {
  test('function call with forget context mode', () => {
    const ast = parse(`
let result = myFunc() forget
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      name: 'result',
      initializer: {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'myFunc',
        },
        arguments: [],
        contextMode: 'forget',
      },
    });
  });

  test('function call with verbose context mode', () => {
    const ast = parse(`
let result = myFunc() verbose
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      initializer: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'myFunc' },
        contextMode: 'verbose',
      },
    });
  });

  test('function call with compress context mode', () => {
    const ast = parse(`
let result = myFunc() compress
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      initializer: {
        type: 'CallExpression',
        contextMode: { compress: null },
      },
    });
  });

  test('function call with compress and prompt', () => {
    const ast = parse(`
let result = myFunc() compress("summarize the function output")
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      initializer: {
        type: 'CallExpression',
        contextMode: { compress: 'summarize the function output' },
      },
    });
  });

  test('function call with arguments and context mode', () => {
    const ast = parse(`
let result = calculate(1, 2, 3) forget
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      initializer: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'calculate' },
        arguments: [
          { type: 'NumberLiteral', value: 1 },
          { type: 'NumberLiteral', value: 2 },
          { type: 'NumberLiteral', value: 3 },
        ],
        contextMode: 'forget',
      },
    });
  });

  test('function call without context mode has undefined contextMode', () => {
    const ast = parse(`
let result = myFunc()
`);
    expect(ast.body).toHaveLength(1);
    const decl = ast.body[0] as { type: string; initializer: { contextMode?: unknown } };
    expect(decl.type).toBe('LetDeclaration');
    expect(decl.initializer.contextMode).toBeUndefined();
  });

  test('chained function call with context mode on last call', () => {
    const ast = parse(`
let result = foo().bar() forget
`);
    expect(ast.body).toHaveLength(1);
    // The outer call (bar()) should have the context mode
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      initializer: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'foo' },
          },
          property: 'bar',
        },
        contextMode: 'forget',
      },
    });
  });

  test('member access then call with context mode', () => {
    const ast = parse(`
let result = obj.method() verbose
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'LetDeclaration',
      initializer: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'obj' },
          property: 'method',
        },
        contextMode: 'verbose',
      },
    });
  });

  test('function call as statement with context mode', () => {
    const ast = parse(`
doSomething() forget
`);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'doSomething' },
        contextMode: 'forget',
      },
    });
  });
});
