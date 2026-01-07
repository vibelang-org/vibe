# AI Result Object with Tool Call History

## Overview

When assigning AI call results to variables, capture both the response and tool call history in a single object with ergonomic access patterns.

```vibe
const ret = vibe "search for weather in Seattle and summarize"
print(ret)              // prints the AI's final text response
print(ret.toolCalls)    // prints array of tool calls with results
```

## Design

### Result Object Shape

```typescript
interface AIResultObject {
  value: string | number | boolean | object  // The AI's final response (parsed if JSON)
  toolCalls: ToolCallRecord[]                 // Ordered list of tool calls made
}

interface ToolCallRecord {
  tool: string       // Tool name
  args: object       // Arguments passed to the tool
  result: string     // Tool's return value (if successful)
  error: string      // Error message (if failed), null otherwise
  duration: number   // Execution time in milliseconds
}
```

### Access Patterns

| Expression | Returns |
|------------|---------|
| `ret` | The `value` (response text/parsed value) |
| `ret.toolCalls` | Array of `{tool, args, result}` objects |
| `ret.toolCalls[0].tool` | First tool's name |
| `ret.toolCalls.length` | Number of tool calls made |

### Primitive Coercion

When `ret` is used in contexts expecting a primitive (string interpolation, comparisons, print), it should resolve to `ret.value`:

```vibe
const ret = vibe "what is 2+2?"
print(ret)                    // "4" (the value)
const msg = "Answer: " + ret  // "Answer: 4"
if ret == "4" { ... }         // true
```

## Implementation

### 1. Define AIResultObject Type

**File:** `src/ast.ts` or new `src/types.ts`

```typescript
interface ToolCallRecord {
  tool: string
  args: Record<string, unknown>
  result: string | null   // null if error
  error: string | null    // null if success
  duration: number        // milliseconds
}

interface AIResultObject {
  __type: 'AIResult'  // Type discriminator
  value: unknown
  toolCalls: ToolCallRecord[]
}

function isAIResultObject(val: unknown): val is AIResultObject {
  return typeof val === 'object' && val !== null && (val as any).__type === 'AIResult'
}
```

### 2. Build Result Object in AI Provider

**File:** `src/ai-provider.ts`

In `executeWithTools()`, accumulate tool calls as they execute:

```typescript
const toolCallRecords: ToolCallRecord[] = []

// Inside the tool execution loop:
for (const toolCall of toolCalls) {
  const startTime = Date.now()
  try {
    const result = await executeTool(toolCall)
    toolCallRecords.push({
      tool: toolCall.name,
      args: toolCall.arguments,
      result: String(result),
      error: null,
      duration: Date.now() - startTime
    })
  } catch (err) {
    toolCallRecords.push({
      tool: toolCall.name,
      args: toolCall.arguments,
      result: null,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime
    })
  }
}

// When returning final result:
return {
  __type: 'AIResult',
  value: finalResponse,
  toolCalls: toolCallRecords
}
```

### 3. Store Full Object in Variable

**File:** `src/runtime.ts`

When an AI statement has an assignment target, store the full `AIResultObject`:

```typescript
// In handleVibeStatement or similar:
if (stmt.assignTo) {
  // Store the full result object, not just the value
  state.setVariable(stmt.assignTo, aiResultObject)
}
```

### 4. Value Resolution for Primitives

**File:** `src/runtime.ts`

Add helper to unwrap AIResult when primitive is needed:

```typescript
function resolveValue(val: unknown): unknown {
  if (isAIResultObject(val)) {
    return val.value
  }
  return val
}
```

Use `resolveValue()` in:
- String interpolation
- Binary operations (+, ==, etc.)
- `print()` built-in
- Passing to tools expecting primitives

### 5. Property Access for .toolCalls

**File:** `src/runtime.ts`

In member expression evaluation, handle AIResultObject:

```typescript
function evaluateMemberExpression(obj: unknown, property: string): unknown {
  if (isAIResultObject(obj)) {
    if (property === 'toolCalls') {
      return obj.toolCalls
    }
    if (property === 'value') {
      return obj.value
    }
    // For other properties, delegate to value if it's an object
    if (typeof obj.value === 'object' && obj.value !== null) {
      return (obj.value as any)[property]
    }
  }
  // ... existing member access logic
}
```

### 6. Block Iteration on AIResultObject

**File:** `src/runtime.ts`

In for-loop evaluation, check for AIResultObject and throw:

```typescript
function evaluateForLoop(iterable: unknown, ...): void {
  if (isAIResultObject(iterable)) {
    throw new Error('Cannot iterate over AIResult directly. Use .toolCalls or .value')
  }
  // ... existing iteration logic
}
```

### 7. Context Display

**File:** `src/context.ts`

When formatting context, show just the value (not the full object):

```typescript
function formatVariableForContext(name: string, val: unknown): string {
  const displayVal = isAIResultObject(val) ? val.value : val
  return `${name}: ${JSON.stringify(displayVal)}`
}
```

## Edge Cases

### No Tool Calls
When AI responds without calling tools, `toolCalls` is an empty array:
```vibe
const ret = vibe "what is 2+2?"
print(ret.toolCalls)  // []
print(ret)            // "4"
```

### `do` vs `vibe` Keywords
Both should return `AIResultObject`. The difference is:
- `do`: Single round, max one set of tool calls
- `vibe`: Multi-turn, may have many tool calls across rounds

### JSON Response Parsing
If the AI response is valid JSON, `value` should be the parsed object:
```vibe
const ret = vibe "return a JSON object with name and age"
print(ret.value.name)      // Access parsed JSON
print(ret.toolCalls)       // Tool call history still available
```

### Tool Errors
When a tool throws an error, it's captured in the record rather than stopping execution:
```vibe
const ret = vibe "fetch data from the API"
for call in ret.toolCalls {
  if call.error {
    print("Tool " + call.tool + " failed: " + call.error)
  } else {
    print("Tool " + call.tool + " returned: " + call.result)
  }
}
```

### Nested Tool Calls
If a tool itself makes AI calls, those inner tool calls are NOT included in the outer `toolCalls` array. Each AI call tracks only its direct tool invocations.

## Testing

### Unit Tests (`src/__tests__/ai-result-object.test.ts`)

1. **Basic assignment** - `const ret = vibe "..."` stores AIResultObject
2. **Value access** - `ret` in expressions resolves to value
3. **toolCalls access** - `ret.toolCalls` returns array
4. **Empty toolCalls** - No tools called → empty array
5. **Multiple tool calls** - Order preserved in array
6. **String interpolation** - `"Result: ${ret}"` uses value
7. **Comparison** - `ret == "expected"` compares value
8. **JSON value** - Parsed JSON accessible via `ret.field`
9. **Tool error captured** - Failed tool has `{result: null, error: "message"}`
10. **Mixed success/error** - Array contains both successful and failed calls
11. **Duration tracked** - Each record has `duration` in milliseconds

### Integration Tests

1. Real AI call with tool use, verify toolCalls populated
2. Multi-turn vibe with multiple tool rounds

## Migration

This is additive - existing code that uses AI responses as strings will continue to work due to primitive coercion. The `toolCalls` property is simply newly available.

## Design Decisions

1. **Args included** - Yes, useful for debugging/logging which arguments were passed
2. **Timing included** - Yes, `duration` in milliseconds for profiling slow tools
3. **Errors captured** - Yes. `{tool, args, result, error, duration}` where `error` is null on success
4. **Iteration** - `for item in ret` throws an error ("Cannot iterate over AIResult, use ret.toolCalls or ret.value"). Forces explicit access.
