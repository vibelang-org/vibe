# TypeScript Compilation Pipeline for Vibe

## The Problem

When mixing Vibe and TypeScript code, we need to handle two different languages:

```vibe
// Vibe code (needs Vibe parser)
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }
let text = "hello"

// TypeScript code (needs TS compiler)
let upper = ts(text) {
  return text.toUpperCase();
}

// More Vibe code
let result = do "Analyze: {upper}" m default
```

**Challenge:** How do we compile both Vibe and TypeScript?

## Current Vibe Pipeline

```
Source Code (.vibe)
    ↓
Lexer (tokenize)
    ↓
Parser (build AST)
    ↓
Runtime (execute AST)
    ↓
Result
```

## Option 1: Parse TS as Raw Strings (Simplest)

Treat TS blocks as opaque string literals during parsing, compile at runtime.

### Implementation

**Lexer:**
```typescript
// Add TS token that captures everything inside braces
export const TSBlock = token({
  name: 'TSBlock',
  pattern: /ts\s*(?:\([^)]*\))?\s*\{(?:[^}]|\{[^}]*\})*\}/,
  line_breaks: true
});
```

**Parser:**
```typescript
// Parse TS block as expression
tSExpression(ctx): AST.TSExpression {
  const fullText = ctx.TSBlock[0].image;

  // Extract parameters: ts(x, y) { ... }
  const paramMatch = fullText.match(/ts\s*\(([^)]*)\)/);
  const params = paramMatch
    ? paramMatch[1].split(',').map(p => p.trim())
    : [];

  // Extract code: { ... }
  const codeMatch = fullText.match(/\{([\s\S]*)\}/);
  const code = codeMatch ? codeMatch[1] : '';

  return {
    type: 'TSExpression',
    parameters: params,
    code: code,  // Raw TypeScript string
    location: tokenLocation(ctx.TSBlock[0])
  };
}
```

**Runtime:**
```typescript
function execTSExpression(state: RuntimeState, expr: AST.TSExpression): RuntimeState {
  // Get parameter values from Vibe scope
  const paramValues = expr.parameters.map(name => {
    const found = lookupVariable(state, name);
    return found ? found.variable.value : undefined;
  });

  // Build JavaScript function
  const paramNames = expr.parameters.join(', ');
  const jsCode = `(${paramNames}) => { ${expr.code} }`;

  // Eval and execute
  const fn = eval(jsCode);
  const result = fn(...paramValues);

  return { ...state, lastResult: result };
}
```

### Pipeline Diagram
```
┌─────────────────┐
│ Source (.vibe)  │
│                 │
│ let x = "hi"    │
│ let y = ts(x) { │  ← TS block stored as raw string
│   x.upper()     │
│ }               │
└────────┬────────┘
         ↓
    ┌────────┐
    │ Lexer  │ ← Tokenize (TS block = one token)
    └────┬───┘
         ↓
    ┌────────┐
    │ Parser │ ← Build AST (TS code = string field)
    └────┬───┘
         ↓
 ┌───────────────┐
 │   AST         │
 │ TSExpression: │
 │   code: "..." │  ← TypeScript as string
 │   params: [x] │
 └───────┬───────┘
         ↓
    ┌────────┐
    │Runtime │ ← eval() TS code at execution time
    └────┬───┘
         ↓
   ┌──────────┐
   │  Result  │
   └──────────┘
```

### Pros & Cons

✅ **Pros:**
- Simple implementation (~2-3 hours)
- No TS compiler dependency at parse time
- Works with Bun's built-in transpiler
- Familiar eval() pattern

❌ **Cons:**
- No TypeScript type checking
- Syntax errors only found at runtime
- Security risk (eval)
- No IDE support for TS blocks
- Can't optimize TS code

---

## Option 2: Pre-compile TS Blocks (Two-Pass)

Extract and compile all TS blocks before parsing Vibe.

### Implementation

**Step 1: Extract TS Blocks**
```typescript
function extractTSBlocks(source: string): {
  transformedSource: string;
  tsBlocks: Map<string, string>;
} {
  const tsBlocks = new Map();
  let blockId = 0;

  // Replace ts { ... } with placeholder IDs
  const transformed = source.replace(
    /ts\s*(?:\([^)]*\))?\s*\{(?:[^}]|\{[^}]*\})*\}/g,
    (match) => {
      const id = `__TS_BLOCK_${blockId++}__`;
      tsBlocks.set(id, match);
      return id;
    }
  );

  return { transformedSource: transformed, tsBlocks };
}
```

**Step 2: Compile TS Blocks**
```typescript
import ts from 'typescript';

function compileTSBlocks(tsBlocks: Map<string, string>): Map<string, string> {
  const compiled = new Map();

  for (const [id, tsCode] of tsBlocks) {
    // Extract code
    const codeMatch = tsCode.match(/\{([\s\S]*)\}/);
    const code = codeMatch ? codeMatch[1] : '';

    // Compile TypeScript to JavaScript
    const result = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS
      }
    });

    // Check for errors
    if (result.diagnostics && result.diagnostics.length > 0) {
      throw new Error(`TypeScript compilation error in ${id}`);
    }

    compiled.set(id, result.outputText);
  }

  return compiled;
}
```

**Step 3: Parse Vibe with Compiled JS**
```typescript
export function parseWithTS(source: string): AST.Program {
  // Extract TS blocks
  const { transformedSource, tsBlocks } = extractTSBlocks(source);

  // Compile TS to JS
  const compiledBlocks = compileTSBlocks(tsBlocks);

  // Parse transformed Vibe
  const ast = parse(transformedSource);

  // Replace placeholder IDs with compiled JS in AST
  replaceBlocksInAST(ast, compiledBlocks);

  return ast;
}
```

### Pipeline Diagram
```
┌─────────────────┐
│ Source (.vibe)  │
│                 │
│ let x = "hi"    │
│ let y = ts(x) { │
│   x.upper()     │
│ }               │
└────────┬────────┘
         ↓
  ┌──────────────┐
  │  Extract TS  │ ← Find all ts { } blocks
  └──────┬───────┘
         ↓
  ┌──────────────────────────────┐
  │ Transformed Source            │
  │                               │
  │ let x = "hi"                  │
  │ let y = __TS_BLOCK_0__        │ ← Placeholder
  └──────┬───────────────────────┘
         │
         ├─────────────────┐
         ↓                 ↓
  ┌──────────┐      ┌─────────────┐
  │TS Compiler│      │ Vibe Parser │
  │           │      │             │
  │ Compile   │      │ Parse Vibe  │
  │ blocks    │      │ with IDs    │
  └─────┬────┘      └──────┬──────┘
        │                  │
        ↓                  ↓
  ┌──────────┐      ┌──────────┐
  │Compiled  │      │   AST    │
  │JS blocks │      │          │
  └─────┬────┘      └──────┬───┘
        │                  │
        └────────┬─────────┘
                 ↓
          ┌──────────────┐
          │  Merge: AST  │ ← Replace IDs with compiled JS
          │  + Compiled  │
          └──────┬───────┘
                 ↓
            ┌────────┐
            │Runtime │ ← Execute compiled JS
            └────┬───┘
                 ↓
            ┌────────┐
            │ Result │
            └────────┘
```

### Pros & Cons

✅ **Pros:**
- TypeScript type checking
- Syntax errors caught at compile time
- Can optimize TS code
- Better IDE support (could highlight errors)

❌ **Cons:**
- Complex implementation (~1-2 days)
- Requires TypeScript compiler dependency
- Two-pass compilation slower
- Harder to debug (line numbers don't match)

---

## Option 3: JIT Compilation with Caching

Compile TS blocks just-in-time when first executed, cache results.

### Implementation

**AST Storage:**
```typescript
export interface TSExpression extends BaseNode {
  type: 'TSExpression';
  parameters: string[];
  code: string;           // Raw TypeScript
  compiledJS?: string;    // Cached compiled JavaScript
  compiledFn?: Function;  // Cached compiled function
}
```

**Runtime with Caching:**
```typescript
import ts from 'typescript';

function execTSExpression(state: RuntimeState, expr: AST.TSExpression): RuntimeState {
  // Check cache
  if (!expr.compiledFn) {
    // First time executing - compile it
    const paramNames = expr.parameters.join(', ');
    const wrappedCode = `(${paramNames}) => { ${expr.code} }`;

    // Transpile TypeScript to JavaScript
    const result = ts.transpileModule(wrappedCode, {
      compilerOptions: { target: ts.ScriptTarget.ES2020 }
    });

    if (result.diagnostics?.length) {
      throw new Error(`TS compilation error: ${result.diagnostics[0].messageText}`);
    }

    // Cache compiled function
    expr.compiledJS = result.outputText;
    expr.compiledFn = eval(result.outputText);
  }

  // Execute cached function
  const paramValues = expr.parameters.map(name => {
    const found = lookupVariable(state, name);
    return found ? found.variable.value : undefined;
  });

  const result = expr.compiledFn(...paramValues);

  return { ...state, lastResult: result };
}
```

### Pipeline Diagram
```
First Execution:
┌─────────┐
│ Runtime │ hits TSExpression
└────┬────┘
     ↓
     ├─ Check cache: MISS
     ↓
┌──────────────┐
│ TS Compiler  │ ← Compile on demand
└──────┬───────┘
       ↓
  ┌────────┐
  │ Cache  │ ← Store compiled function in AST
  └────┬───┘
       ↓
  ┌────────┐
  │Execute │
  └────────┘

Subsequent Executions:
┌─────────┐
│ Runtime │ hits TSExpression
└────┬────┘
     ↓
     ├─ Check cache: HIT
     ↓
  ┌────────┐
  │Execute │ ← Use cached function
  └────────┘
```

### Pros & Cons

✅ **Pros:**
- TypeScript type checking
- Simple parser (TS as string)
- Fast subsequent executions
- Only compile what's actually used

❌ **Cons:**
- First execution slower
- Still need TS compiler at runtime
- Syntax errors only on first execution
- Cache invalidation complexity

---

## Option 4: Bun Native (Leverage Runtime)

Use Bun's built-in TypeScript support - no compilation needed!

### Implementation

Bun can execute TypeScript directly:

```typescript
function execTSExpression(state: RuntimeState, expr: AST.TSExpression): RuntimeState {
  const paramValues = expr.parameters.map(name => {
    const found = lookupVariable(state, name);
    return found ? found.variable.value : undefined;
  });

  // Bun handles TypeScript natively!
  const paramNames = expr.parameters.join(', ');
  const tsCode = `(${paramNames}) => { ${expr.code} }`;

  // Just eval - Bun transpiles automatically
  const fn = eval(tsCode);
  const result = fn(...paramValues);

  return { ...state, lastResult: result };
}
```

### Pipeline Diagram
```
┌─────────────────┐
│ Source (.vibe)  │
│                 │
│ let x = "hi"    │
│ let y = ts(x) { │
│   x.upper()     │
│ }               │
└────────┬────────┘
         ↓
    ┌────────┐
    │ Lexer  │ ← Tokenize (TS = string)
    └────┬───┘
         ↓
    ┌────────┐
    │ Parser │ ← Build AST (TS = string)
    └────┬───┘
         ↓
 ┌───────────────┐
 │   AST         │
 │ TSExpression: │
 │   code: "..." │  ← Raw TypeScript
 └───────┬───────┘
         ↓
    ┌────────┐
    │Runtime │
    │  (Bun) │ ← Bun's built-in TS support
    └────┬───┘
         ↓
   ┌──────────┐
   │  Result  │
   └──────────┘
```

### Pros & Cons

✅ **Pros:**
- **Simplest implementation** (~2 hours)
- No TS compiler dependency
- Bun handles transpilation
- Fast execution
- Zero configuration

❌ **Cons:**
- Tied to Bun runtime (can't use Node.js)
- No type checking
- Limited error messages
- Bun-specific behavior

---

## Recommended Approach

### Phase 1: Start with Option 4 (Bun Native) ⭐

**Why:**
- Fastest to implement
- Leverages existing infrastructure
- Vibe already uses Bun
- Good enough for MVP

**Implementation:**
```typescript
// Lexer: treat ts{} as raw string token
// Parser: extract parameters and code body
// Runtime: eval() with Bun's native TS support
```

**Time:** ~2-3 hours

---

### Phase 2: Add JIT Compilation (Option 3)

When you need type checking:

```typescript
import ts from 'typescript';

function execTSExpression(state: RuntimeState, expr: AST.TSExpression): RuntimeState {
  if (!expr.compiledFn) {
    // Type check + compile
    const result = ts.transpileModule(expr.code, {
      compilerOptions: { noEmit: false, strict: true }
    });

    if (result.diagnostics?.length) {
      // Return helpful error
      throw new TypeScriptError(result.diagnostics);
    }

    expr.compiledFn = eval(result.outputText);
  }

  return executeCompiledFunction(state, expr);
}
```

**Time:** +2-3 hours

---

## Real-World Example

### With Option 4 (Bun Native)

```vibe
// Source file: pipeline.vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

let data = ts {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('data.json', 'utf-8'));
}

let processed = ts(data) {
  return data.items
    .filter((item: any) => item.active)
    .map((item: any) => item.name.toUpperCase());
}

let summary = do "Summarize: {processed}" m default
```

**Execution:**
```bash
$ bun run src/index.ts pipeline.vibe
```

**What happens:**
1. Vibe lexer tokenizes entire file
2. TS blocks stored as strings in AST
3. Runtime hits first `ts {}` block
4. Bun's eval() transparently transpiles and executes TypeScript
5. Result flows back to Vibe runtime
6. Continue execution

**No explicit compilation step needed!**

---

## Testing Strategy

```typescript
describe('TypeScript Interop', () => {
  test('simple TS expression', () => {
    const ast = parse('let x = ts { 1 + 1 }');
    const state = createInitialState(ast);
    const result = runUntilPause(state);

    expect(result.callStack[0].locals['x'].value).toBe(2);
  });

  test('TS with parameters', () => {
    const ast = parse(`
      let text = "hello"
      let upper = ts(text) { text.toUpperCase() }
    `);
    const state = createInitialState(ast);
    const result = runUntilPause(state);

    expect(result.callStack[0].locals['upper'].value).toBe('HELLO');
  });

  test('TS with TypeScript features', () => {
    const ast = parse(`
      let nums = [1, 2, 3]
      let result = ts(nums) {
        const doubled = nums.map((x: number) => x * 2);
        return doubled.reduce((a, b) => a + b, 0);
      }
    `);
    const state = createInitialState(ast);
    const result = runUntilPause(state);

    expect(result.callStack[0].locals['result'].value).toBe(12);
  });
});
```

---

## Migration Path

### Today (MVP)
```
Bun Native (Option 4)
↓
Simple eval()
Fast to implement
```

### Short Term
```
Add type checking flag
↓
Optional TS compiler
Better errors
```

### Long Term
```
Pre-compilation mode
↓
Build step
Production optimizations
```

---

## Summary

| Option | Complexity | Type Check | Speed | Dependency |
|--------|-----------|------------|-------|------------|
| 1. Raw Strings | Low | ❌ | Fast | None |
| 2. Pre-compile | High | ✅ | Slow build | TS compiler |
| 3. JIT + Cache | Medium | ✅ | Fast runtime | TS compiler |
| 4. Bun Native | **Lowest** | ❌ | **Fastest** | **None** |

**Recommendation: Start with Option 4 (Bun Native)**
- 2-3 hours implementation
- Leverages Bun's built-in TS support
- Zero dependencies
- Upgrade to JIT later if needed

This gives you 80% of the value with 20% of the work!
