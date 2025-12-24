# Built-in Libraries & JavaScript Interop - Design Options

## Current Architecture

Vibe runs on a TypeScript/JavaScript runtime (Bun) with:
- Variables store `value: unknown` - can hold **any** JS value (strings, numbers, objects, functions, etc.)
- Functions stored as `Record<string, AST.FunctionDeclaration>`
- Runtime executes via instruction stack pattern
- Already supports object literals `{key: value}` and array literals `[1, 2, 3]`

**Key insight:** We're already on a JS runtime - we can leverage this!

## Option 1: Built-in Vibe Functions (Pure Vibe)

Implement common functions directly in the Vibe runtime, callable like user functions.

```vibe
let numbers = [1, 2, 3, 4, 5]
let doubled = map(numbers, (x) => x * 2)
let total = reduce(numbers, (acc, x) => acc + x, 0)
let text = "hello world"
let upper = toUpperCase(text)
let len = length(text)
```

**Implementation:**
```typescript
// In createInitialState, add built-in functions
const builtinFunctions = {
  print: { type: 'builtin', handler: (args) => console.log(...args) },
  length: { type: 'builtin', handler: ([value]) => value.length },
  // etc...
};
```

**Pros:**
- Full control over behavior
- Type-safe and predictable
- Can add AI-specific functions (e.g., `embedText()`, `classify()`)
- Security - only expose what we want

**Cons:**
- Need to implement everything ourselves
- Limited compared to full JS ecosystem
- Maintenance burden (lots of functions to write)

## Option 2: Member Access + Method Calls (JavaScript Methods)

Allow Vibe to call JavaScript methods on objects directly.

```vibe
let text = "hello"
let upper = text.toUpperCase()      // JS String method
let numbers = [1, 2, 3]
let doubled = numbers.map((x) => x * 2)   // JS Array method
let parsed = JSON.parse('{"x": 1}')       // Global JS object
```

**Implementation:**
Add to AST:
```typescript
export interface MemberExpression extends BaseNode {
  type: 'MemberExpression';
  object: Expression;
  property: string;  // e.g., "toUpperCase"
}
```

Add to runtime:
```typescript
case 'MemberExpression':
  const obj = evalExpression(expr.object);
  return obj[expr.property];  // Direct JS property access!
```

**Pros:**
- **Massive leverage** - instant access to all JS built-ins
- Familiar syntax for developers
- No need to reimplement standard library
- Works with any JS value

**Cons:**
- Security concerns (access to everything)
- Less control over behavior
- Might expose confusing JS quirks
- Need to add operators for it to be really useful

## Option 3: JS Interop Module (Explicit Imports)

Allow controlled imports from JavaScript/TypeScript.

```vibe
import { readFile, writeFile } from "fs"
import axios from "axios"

let data = await readFile("data.txt")
let response = await axios.get("https://api.example.com")
```

**Implementation:**
```typescript
export interface ImportDeclaration extends BaseNode {
  type: 'ImportDeclaration';
  specifiers: string[];  // ['readFile', 'writeFile']
  source: string;        // 'fs'
}
```

**Pros:**
- Explicit and clear what's being used
- Can use any npm package
- Familiar to JS developers
- Can restrict imports (allowlist)

**Cons:**
- Complex implementation
- Need module resolution
- Async/await adds complexity
- Security - arbitrary code execution

## Option 4: Hybrid Approach (Recommended)

Combine built-ins + member access + controlled JS interop.

**Phase 1: Built-in Standard Library**
```vibe
// Vibe built-ins (no import needed)
print("Hello")
let len = length([1, 2, 3])
let joined = join(["a", "b"], ",")
```

**Phase 2: Member Access**
```vibe
// JS methods work automatically
let text = "hello"
let upper = text.toUpperCase()
let nums = [1, 2, 3].map((x) => x * 2)
```

**Phase 3: Global JS Objects**
```vibe
// Access to safe globals
let parsed = JSON.parse('{"x": 1}')
let str = JSON.stringify({x: 1})
let now = Date.now()
let randomNum = Math.random()
```

**Phase 4: Controlled Imports (later)**
```vibe
// Explicit imports with allowlist
import { fetch } from "js:fetch"  // Special syntax
let response = await fetch("https://api.example.com")
```

## Recommended Implementation Plan

### Step 1: Add Member Expression Support (Parser & Runtime)

**Parser changes:**
```typescript
// AST
export interface MemberExpression extends BaseNode {
  type: 'MemberExpression';
  object: Expression;
  property: string | Expression;  // text.length or arr[0]
  computed: boolean;  // true for arr[0], false for text.length
}

// Lexer - add '.' token
export const Dot = token({ name: 'Dot', pattern: /\./ });
```

**Runtime changes:**
```typescript
case 'MemberExpression':
  return execMemberExpression(state, expr);

function execMemberExpression(state: RuntimeState, expr: AST.MemberExpression) {
  // Evaluate object first
  return {
    ...state,
    instructionStack: [
      { op: 'exec_expression', expr: expr.object },
      { op: 'member_access', property: expr.property, computed: expr.computed },
      ...state.instructionStack,
    ],
  };
}

function execMemberAccess(state: RuntimeState, property: string, computed: boolean) {
  const obj = state.lastResult;
  const prop = computed ? evalExpression(property) : property;
  return { ...state, lastResult: obj[prop] };
}
```

### Step 2: Add Built-in Global Objects

```typescript
// In createInitialState
const globalFrame = createFrame('<entry>');
globalFrame.locals['JSON'] = {
  value: JSON,
  isConst: true,
  typeAnnotation: null
};
globalFrame.locals['Math'] = {
  value: Math,
  isConst: true,
  typeAnnotation: null
};
globalFrame.locals['console'] = {
  value: console,
  isConst: true,
  typeAnnotation: null
};
// etc...
```

### Step 3: Add Built-in Functions

```typescript
// Create a builtins module
export const BUILTIN_FUNCTIONS = {
  print: (args: unknown[]) => {
    console.log(...args);
    return null;
  },

  length: (args: unknown[]) => {
    const [value] = args;
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }
    return 0;
  },

  range: (args: unknown[]) => {
    const [start, end] = args as [number, number];
    return Array.from({ length: end - start }, (_, i) => start + i);
  },

  keys: (args: unknown[]) => {
    const [obj] = args;
    return Object.keys(obj);
  },

  // More built-ins...
};

// In execCallFunction, check for built-ins first
function execCallFunction(state: RuntimeState, funcName: string, argCount: number) {
  // ... get args from stack ...

  // Check built-ins first
  if (funcName in BUILTIN_FUNCTIONS) {
    const result = BUILTIN_FUNCTIONS[funcName](args);
    return { ...state, lastResult: result, valueStack: newValueStack };
  }

  // Then check user functions
  // ... existing logic ...
}
```

## Example Usage After Implementation

```vibe
// Built-in functions
print("Hello, World!")
let nums = range(1, 10)
let doubled = nums.map((x) => x * 2)

// Member access
let text = "hello world"
let upper = text.toUpperCase()
let words = text.split(" ")
let firstWord = words[0]

// Global JS objects
let data = JSON.parse('{"name": "Alice", "age": 30}')
let jsonStr = JSON.stringify(data)
let randomNum = Math.floor(Math.random() * 100)
let timestamp = Date.now()

// AI-enhanced operations
let summary = do "Summarize this: {text}" m default
let analyzed = do "Analyze sentiment: {summary}" m default

// Console output
console.log("Analysis:", analyzed)
```

## Security Considerations

**Allowlist approach:**
- Only expose safe globals (JSON, Math, Date, console)
- No `eval()`, `Function()`, `require()`, `import()`
- No filesystem access unless explicitly enabled
- No network access unless explicitly enabled

**For production:**
- Sandbox mode: restrict to Vibe built-ins only
- Controlled mode: allow specific JS globals
- Full mode: unrestricted (development only)

## Summary

**Immediate wins with minimal work:**
1. Add member expression support → unlocks all JS methods
2. Add global objects (JSON, Math, Date) → instant utility
3. Add 10-20 core built-in functions → better DX

**Long-term:**
- Import system for controlled npm packages
- Type checking for JS interop
- Security sandboxing options

This approach gives you 80% of JavaScript's power with 20% of the implementation effort, while maintaining control and safety.
