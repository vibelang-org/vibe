# Plan: Implement `compress` Keyword for Loop Context

**STATUS: IMPLEMENTED** (All 13 implementation tasks completed)

## Overview

The `compress` keyword is already parsed but not implemented at runtime. When a loop exits with `compress` (or `compress("custom prompt")`), it should:

1. Extract all context entries from the loop (between scope-enter and current position)
2. Make an AI call to summarize those entries
3. Replace the loop entries with a single `summary` entry
4. Continue execution

This follows the same async pattern as `do`/`vibe` AI calls.

## Syntax Patterns

Support flexible patterns:

```
} compress                          # default prompt, last-used model
} compress(myModel)                 # default prompt, explicit model (model type)
} compress("summarize this")        # literal prompt, last-used model
} compress(SUMMARY_PROMPT)          # prompt variable, last-used model (prompt type)
} compress("summarize", myModel)    # literal prompt, explicit model
} compress(SUMMARY_PROMPT, myModel) # prompt variable, explicit model
```

Single identifier is resolved by type at semantic analysis:
- `model` type → used as model
- `prompt` type → used as prompt

## Model Resolution

Track `lastUsedModel` in RuntimeState:
- Set when first `model` declaration is evaluated (ensures model exists if any declared)
- Updated whenever `vibe`/`do` executes
- Compress uses explicit model if provided, otherwise `lastUsedModel`
- Error if no model was ever declared

## Current State

- **Parsing**: Partial - supports `compress` and `compress("prompt")`, needs model parameter support
- **AST**: `ContextMode` type needs update to store optional model
- **Runtime**: Compress currently acts like verbose (adds scope markers, no summarization)
- **Summary entry type**: Already exists - `{ kind: 'summary', text: string }`
- **Formatter**: Already handles summaries - displays as `[summary] text`

## Implementation

### 0. Parser & AST Changes (NEW)

**AST** (`src/ast/index.ts`):
```typescript
// Compress argument - either a string literal or identifier reference
export type CompressArg =
  | { kind: 'literal'; value: string }
  | { kind: 'identifier'; name: string };

// Update ContextMode to store raw args (resolved at semantic/runtime)
export type ContextMode =
  | 'forget'
  | 'verbose'
  | { compress: { arg1: CompressArg | null; arg2: CompressArg | null } };
```

**Parser** (`src/parser/index.ts`):
- After `compress`, check for `(`
- Parse args as: string literal OR identifier (max 2 args)
- Store in AST as `{ compress: { arg1: string | identifier | null, arg2: identifier | null } }`
- **Parse-time validation:**
  - First arg must be string literal OR identifier (error otherwise)
  - Second arg (if present) must be identifier (error if string/number/etc)
  - Max 2 arguments (error if more)
  - Error messages: "compress expects (prompt?, model?) but got ..."

**Semantic Analysis** (`src/semantic/analyzer.ts`):
Resolve argument meaning based on types:

Single arg cases:
- `compress("literal")` → prompt is literal, model from lastUsedModel
- `compress(x)` where x is `prompt` type → prompt from x, model from lastUsedModel
- `compress(x)` where x is `model` type → prompt is default, model is x
- `compress(x)` where x is other type → error

Two arg cases:
- `compress("literal", m)` → prompt is literal, model is m (must be model type)
- `compress(p, m)` → p must be prompt type, m must be model type

Errors:
- "compress argument 'x' must be prompt or model type, got text"
- "compress model 'x' is not declared"
- "compress prompt 'x' is not declared"

**RuntimeState** (`src/runtime/types.ts`):
```typescript
// Add to RuntimeState
lastUsedModel: string | null;  // Track most recently used/declared model
```

**Model Declaration** (`src/runtime/exec/statements.ts`):
- When `declare_model` executes, set `state.lastUsedModel = stmt.name` if not already set

**AI Execution** (`src/runtime/ai-provider.ts`):
- When `vibe`/`do` executes, update `state.lastUsedModel = modelName`

### 1. Add `awaiting_compress` Status (`src/runtime/types.ts`)

```typescript
export type RuntimeStatus =
  | 'running'
  | 'awaiting_ai'
  | 'awaiting_compress'  // NEW
  // ... rest
```

Add pending compress state:
```typescript
pendingCompress?: {
  prompt: string | null;        // Custom prompt or null for default
  model: string;                // Model variable name to use
  entriesToSummarize: FrameEntry[];  // Entries to compress
  entryIndex: number;           // Where to insert summary
  scopeType: 'for' | 'while';
  label?: string;
} | null;
```

### 2. Add `resumeWithCompressResult` Function (`src/runtime/state.ts`)

```typescript
export function resumeWithCompressResult(
  state: RuntimeState,
  summary: string
): RuntimeState {
  if (state.status !== 'awaiting_compress' || !state.pendingCompress) {
    throw new Error('Cannot resume: not awaiting compress result');
  }

  const { entryIndex, scopeType, label } = state.pendingCompress;
  const frame = currentFrame(state);

  // Replace loop entries with summary, keeping scope markers
  const newOrderedEntries = [
    ...frame.orderedEntries.slice(0, entryIndex),
    { kind: 'scope-enter' as const, scopeType, label },
    { kind: 'summary' as const, text: summary },
    { kind: 'scope-exit' as const, scopeType, label },
  ];

  return {
    ...state,
    status: 'running',
    pendingCompress: null,
    callStack: [
      ...state.callStack.slice(0, -1),
      { ...frame, orderedEntries: newOrderedEntries },
    ],
  };
}
```

### 3. Update `applyContextMode` in `src/runtime/step.ts`

Change the compress branch (lines 64-68) to pause for AI:

```typescript
if (typeof contextMode === 'object' && 'compress' in contextMode) {
  // Extract entries from this scope
  const entriesToSummarize = frame.orderedEntries.slice(entryIndex);

  return {
    ...state,
    status: 'awaiting_compress',
    pendingCompress: {
      prompt: contextMode.compress,  // Custom prompt or null
      entriesToSummarize,
      entryIndex,
      scopeType,
      label,
    },
    callStack: [
      ...state.callStack.slice(0, -1),
      { ...frame, orderedEntries: newOrderedEntries },  // Keep scope-exit for now
    ],
  };
}
```

### 4. Handle Compress in Runner (`src/runtime/run.ts` or `ai-provider.ts`)

The runner that handles `awaiting_ai` also needs to handle `awaiting_compress`:

```typescript
if (state.status === 'awaiting_compress' && state.pendingCompress) {
  const { prompt, entriesToSummarize } = state.pendingCompress;

  // Format entries for summarization
  const contextText = formatEntriesForSummarization(entriesToSummarize);

  // Build summarization prompt
  const summaryPrompt = prompt
    ? `${prompt}\n\nContext to summarize:\n${contextText}`
    : `Summarize this loop execution in 1-2 sentences, focusing on key results and state changes:\n\n${contextText}`;

  // Make AI call (using current model)
  const summary = await aiProvider.execute(summaryPrompt);

  state = resumeWithCompressResult(state, summary);
}
```

### 5. Add Helper for Formatting Entries (`src/runtime/context.ts`)

```typescript
export function formatEntriesForSummarization(entries: FrameEntry[]): string {
  // Reuse existing formatting logic but for specific entries
  return entries.map(entry => {
    if (entry.kind === 'variable') {
      return `- ${entry.name} = ${JSON.stringify(entry.value)}`;
    }
    if (entry.kind === 'tool-call') {
      return `- [tool] ${entry.toolName}(${JSON.stringify(entry.args)}) → ${JSON.stringify(entry.result)}`;
    }
    if (entry.kind === 'prompt') {
      return `- [${entry.aiType}] "${entry.prompt}" → "${entry.response}"`;
    }
    // Skip scope markers in summary input
    return null;
  }).filter(Boolean).join('\n');
}
```

### 6. Export from Index (`src/runtime/index.ts`)

Add `resumeWithCompressResult` to exports.

### 7. Tests (`src/runtime/test/context-modes.test.ts`)

Update existing compress tests to verify actual summarization:

```typescript
test('for loop with compress summarizes loop entries', async () => {
  const ast = parse(`
    for i in [1, 2, 3] {
      let x = i * 10
    } compress("summarize the multiplications")
    let after = "done"
  `);

  let state = createInitialState(ast);
  state = runUntilPause(state);

  // Should be awaiting compress
  expect(state.status).toBe('awaiting_compress');
  expect(state.pendingCompress?.prompt).toBe('summarize the multiplications');

  // Resume with mock summary
  state = resumeWithCompressResult(state, 'Multiplied 1, 2, 3 by 10');
  state = runUntilPause(state);

  const context = buildLocalContext(state);
  const summary = context.find(e => e.kind === 'summary');
  expect(summary?.text).toBe('Multiplied 1, 2, 3 by 10');
});
```

## Files to Modify

1. `src/ast/index.ts` - Update `ContextMode` type to include model
2. `src/parser/index.ts` - Parse new compress syntax patterns with validation
3. `src/semantic/analyzer.ts` - Validate compress model identifier is declared and is model type
4. `src/runtime/types.ts` - Add status, pending state, and `lastUsedModel`
5. `src/runtime/state.ts` - Add `resumeWithCompressResult`, init `lastUsedModel`
6. `src/runtime/exec/statements.ts` - Set `lastUsedModel` on model declaration
7. `src/runtime/ai-provider.ts` - Update `lastUsedModel` on AI calls
8. `src/runtime/step.ts` - Update `applyContextMode` for compress with model resolution
9. `src/runtime/context.ts` - Add `formatEntriesForSummarization`
10. `src/runtime/index.ts` - Export new function
11. `src/parser/test/*.test.ts` - Test new compress syntax (valid + error cases)
12. `src/semantic/test/*.test.ts` - Test model type validation
13. `src/runtime/test/context-modes.test.ts` - Add/update runtime tests

## Design Decisions

1. **Summary with scope markers** - Output shows `==> for i [summary] text <== for i`
2. **Flexible model resolution** - Explicit model > lastUsedModel > error if none
3. **lastUsedModel tracking** - Set on first model declaration, updated on each AI call
4. **Default prompt** - If no custom prompt, uses sensible default focusing on results
5. **Async pattern** - Follows established `awaiting_*` + `resumeWith*` pattern
6. **Entry formatting** - Reuses context formatting logic for consistency

## Edge Cases

- **Empty loop**: If loop has no iterations, skip compression (nothing to summarize)
- **Nested loops**: Each compress operates on its own scope independently
- **No model declared**: Runtime error "compress requires a model but none declared"
- **AI errors**: Let errors propagate like other AI calls (retry logic in provider)

## Validation Errors

**Parse-time:**
- `compress(123)` → "compress argument must be a string literal or identifier"
- `compress("x", "y")` → "compress second argument must be an identifier"
- `compress(a, b, c)` → "compress takes at most 2 arguments"

**Semantic analysis:**
- `compress(undeclared)` → "compress argument 'undeclared' is not declared"
- `compress(myText)` where myText is `text` → "compress argument 'myText' must be prompt or model type, got text"
- `compress(p, m)` where p is not `prompt` → "compress first argument 'p' must be prompt type when two arguments provided"
- `compress(p, m)` where m is not `model` → "compress second argument 'm' must be model type"
