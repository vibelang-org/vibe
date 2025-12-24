# Implementation Guide: Member Expressions & JavaScript Interop

## Overview

This document shows exactly how to implement member expressions in Vibe, enabling JavaScript method calls and property access.

## Step 1: AST Changes (src/ast/index.ts)

Add `MemberExpression` to the AST:

```typescript
// Add to Expression type union
export type Expression =
  | Identifier
  | StringLiteral
  | TemplateLiteral
  | BooleanLiteral
  | ObjectLiteral
  | ArrayLiteral
  | MemberExpression      // NEW!
  | AssignmentExpression
  | CallExpression
  | DoExpression
  | VibeExpression
  | AskExpression;

// New interface
export interface MemberExpression extends BaseNode {
  type: 'MemberExpression';
  object: Expression;      // The thing before the dot (e.g., 'text' in text.toUpperCase)
  property: Expression;    // The property/method name (e.g., 'toUpperCase')
  computed: boolean;       // true for arr[0], false for obj.prop
}
```

## Step 2: Lexer Changes (src/lexer/index.ts)

Add the dot token:

```typescript
// Add with other operators
export const Dot = token({ name: 'Dot', pattern: /\./ });

// Add to allTokens array (after operators section)
export const allTokens = [
  // ... existing tokens ...
  Equals,
  Dot,        // NEW!
  // ... delimiters ...
];
```

## Step 3: Parser Changes (src/parser/visitor.ts)

Update the parser to handle member expressions:

```typescript
// In the expression parsing rule, handle member access
expression(ctx: ExpressionContext): AST.Expression {
  // ... existing Do/Ask/Vibe handling ...

  // Handle member access (highest precedence)
  if (ctx.primaryExpression && ctx.Dot) {
    return this.memberExpression(ctx);
  }

  // ... rest of expression handling ...
}

// New method to parse member expressions
memberExpression(ctx: any): AST.MemberExpression {
  let object = this.visit(ctx.primaryExpression[0]);

  // Handle chains: a.b.c.d
  for (let i = 0; i < ctx.Dot.length; i++) {
    const property = ctx.Identifier[i];
    object = {
      type: 'MemberExpression',
      object: object,
      property: {
        type: 'Identifier',
        name: property.image,
        location: tokenLocation(property),
      },
      computed: false,
      location: tokenLocation(ctx.Dot[i]),
    };
  }

  return object;
}

// Handle computed member access: arr[0], obj["key"]
computedMemberExpression(ctx: any): AST.MemberExpression {
  return {
    type: 'MemberExpression',
    object: this.visit(ctx.object),
    property: this.visit(ctx.property),
    computed: true,
    location: tokenLocation(ctx.LBracket[0]),
  };
}
```

## Step 4: Runtime Changes (src/runtime/step.ts)

Add execution logic for member expressions:

```typescript
// In execExpression
function execExpression(state: RuntimeState, expr: AST.Expression): RuntimeState {
  switch (expr.type) {
    // ... existing cases ...

    case 'MemberExpression':
      return execMemberExpression(state, expr);

    // ... rest of cases ...
  }
}

// New function to execute member access
function execMemberExpression(state: RuntimeState, expr: AST.MemberExpression): RuntimeState {
  if (expr.computed) {
    // arr[index] - need to evaluate both object and property
    return {
      ...state,
      instructionStack: [
        { op: 'exec_expression', expr: expr.object },
        { op: 'push_value' },
        { op: 'exec_expression', expr: expr.property },
        { op: 'member_access_computed' },
        ...state.instructionStack,
      ],
    };
  } else {
    // obj.prop - property is a literal identifier
    const propertyName = (expr.property as AST.Identifier).name;
    return {
      ...state,
      instructionStack: [
        { op: 'exec_expression', expr: expr.object },
        { op: 'member_access', property: propertyName },
        ...state.instructionStack,
      ],
    };
  }
}
```

## Step 5: Runtime Instruction Handlers

Add the instruction handlers:

```typescript
// In execInstruction switch
switch (instruction.op) {
  // ... existing cases ...

  case 'member_access':
    return execMemberAccess(state, instruction.property);

  case 'member_access_computed':
    return execMemberAccessComputed(state);

  // ... rest of cases ...
}

// Handler for obj.prop
function execMemberAccess(state: RuntimeState, property: string): RuntimeState {
  const obj = state.lastResult;

  // Handle null/undefined safely
  if (obj === null || obj === undefined) {
    throw new Error(`Cannot read property '${property}' of ${obj}`);
  }

  // Direct JavaScript property access!
  const value = (obj as any)[property];

  return { ...state, lastResult: value };
}

// Handler for arr[index]
function execMemberAccessComputed(state: RuntimeState): RuntimeState {
  const property = state.lastResult;  // The computed property/index
  const obj = state.valueStack[state.valueStack.length - 1];  // The object

  if (obj === null || obj === undefined) {
    throw new Error(`Cannot read property of ${obj}`);
  }

  const value = (obj as any)[property];

  return {
    ...state,
    lastResult: value,
    valueStack: state.valueStack.slice(0, -1),  // Pop object from stack
  };
}
```

## Step 6: Update Runtime Types (src/runtime/types.ts)

Add new instruction types:

```typescript
export type Instruction =
  // ... existing instructions ...

  // Member access
  | { op: 'member_access'; property: string }           // obj.prop
  | { op: 'member_access_computed' };                   // obj[expr]
```

## Step 7: Add Global Objects (src/runtime/state.ts)

Inject JavaScript globals into the entry frame:

```typescript
export function createInitialState(program: AST.Program): RuntimeState {
  // ... existing function collection ...

  // Create entry frame with JavaScript globals
  const entryFrame = createFrame('<entry>');

  // Add global JavaScript objects
  entryFrame.locals['JSON'] = {
    value: JSON,
    isConst: true,
    typeAnnotation: null,
  };

  entryFrame.locals['Math'] = {
    value: Math,
    isConst: true,
    typeAnnotation: null,
  };

  entryFrame.locals['Date'] = {
    value: Date,
    isConst: true,
    typeAnnotation: null,
  };

  entryFrame.locals['console'] = {
    value: console,
    isConst: true,
    typeAnnotation: null,
  };

  entryFrame.locals['Object'] = {
    value: Object,
    isConst: true,
    typeAnnotation: null,
  };

  return {
    status: 'running',
    program,
    functions,
    callStack: [entryFrame],
    // ... rest of state initialization ...
  };
}
```

## Usage Examples

### Before (Current Vibe)
```vibe
// ❌ This doesn't work yet
let text = "hello"
let upper = text.toUpperCase()  // Error: no member access

let nums = [1, 2, 3]
let doubled = nums.map((x) => x * 2)  // Error: no member access
```

### After (With Member Expressions)
```vibe
// ✅ All of this works!
let text = "hello"
let upper = text.toUpperCase()      // "HELLO"
let words = text.split(" ")         // ["hello"]
let len = text.length               // 5

let nums = [1, 2, 3]
let doubled = nums.map((x) => x * 2)     // [2, 4, 6]
let sum = nums.reduce((a, b) => a + b)   // 6
let first = nums[0]                      // 1

let data = JSON.parse('{"x": 1}')   // {x: 1}
let str = JSON.stringify(data)      // '{"x":1}'
let random = Math.random()          // 0.847...
```

## Testing Strategy

### Test 1: Basic Property Access
```typescript
test('member expression - property access', () => {
  const ast = parse('let x = "hello".length');
  let state = createInitialState(ast);
  state = runUntilPause(state);

  expect(state.callStack[0].locals['x'].value).toBe(5);
});
```

### Test 2: Method Calls
```typescript
test('member expression - method call', () => {
  const ast = parse('let x = "hello".toUpperCase()');
  let state = createInitialState(ast);
  state = runUntilPause(state);

  expect(state.callStack[0].locals['x'].value).toBe('HELLO');
});
```

### Test 3: Chained Access
```typescript
test('member expression - chained', () => {
  const ast = parse('let x = "hello world".split(" ")[0].toUpperCase()');
  let state = createInitialState(ast);
  state = runUntilPause(state);

  expect(state.callStack[0].locals['x'].value).toBe('HELLO');
});
```

### Test 4: Array Methods
```typescript
test('member expression - array map', () => {
  const ast = parse(`
    let nums = [1, 2, 3]
    let doubled = nums.map((x) => x * 2)
  `);
  let state = createInitialState(ast);
  state = runUntilPause(state);

  expect(state.callStack[0].locals['doubled'].value).toEqual([2, 4, 6]);
});
```

### Test 5: Global Objects
```typescript
test('global - JSON.parse', () => {
  const ast = parse('let x = JSON.parse(\'{"a": 1}\')');
  let state = createInitialState(ast);
  state = runUntilPause(state);

  expect(state.callStack[0].locals['x'].value).toEqual({ a: 1 });
});
```

## Security Considerations

### Safe Globals (Recommended)
Only expose these globals by default:
- `JSON` - safe parsing/stringifying
- `Math` - mathematical operations
- `Date` - date/time operations
- `console` - logging (can be redirected)
- `Object` - object utilities (keys, values, entries)

### Unsafe Globals (Do NOT Expose)
- `eval` - arbitrary code execution
- `Function` - constructor can run arbitrary code
- `require` / `import` - filesystem/module access
- `process` - OS-level access
- `fs` - filesystem access
- `child_process` - command execution

### Sandbox Mode
Add a configuration option:

```typescript
interface VibeConfig {
  securityMode: 'sandbox' | 'controlled' | 'full';
  allowedGlobals?: string[];
}

// In createInitialState:
function createInitialState(program: AST.Program, config?: VibeConfig) {
  const allowedGlobals = config?.securityMode === 'sandbox'
    ? []  // No globals
    : config?.securityMode === 'full'
    ? ['JSON', 'Math', 'Date', 'console', 'Object', 'Array', 'String', 'Number']
    : ['JSON', 'Math', 'Date', 'console'];  // controlled (default)

  // Only add allowed globals
  if (allowedGlobals.includes('JSON')) {
    entryFrame.locals['JSON'] = { value: JSON, isConst: true, typeAnnotation: null };
  }
  // ... etc
}
```

## Estimated Implementation Time

- AST changes: ~30 minutes
- Lexer changes: ~15 minutes
- Parser changes: ~1 hour (handling precedence correctly)
- Runtime changes: ~1 hour
- Testing: ~1 hour
- **Total: ~3-4 hours**

## Benefits

1. **Instant access to 100+ JavaScript methods** - no reimplementation needed
2. **Familiar syntax** - developers already know `.map()`, `.filter()`, etc.
3. **Powerful combinations** - JS data manipulation + AI analysis
4. **Minimal code** - leverage existing runtime
5. **Type safety** - TypeScript ensures methods exist on objects

## Next Steps

After member expressions work, consider:
1. **Operators** - `+`, `-`, `*`, `/`, `==`, `<`, `>`, etc.
2. **Arrow functions** - already used in examples above
3. **Spread operator** - `[...arr1, ...arr2]`
4. **Destructuring** - `let {name, age} = user`
5. **Import system** - controlled npm package access
