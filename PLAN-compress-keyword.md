# Plan: Implement `compress` Keyword for Loop Context

## Overview

The `compress` keyword is already parsed but not implemented at runtime. When a loop exits with `compress` (or `compress("custom prompt")`), it should:

1. Extract all context entries from the loop (between scope-enter and current position)
2. Make an AI call to summarize those entries
3. Replace the loop entries with a single `summary` entry
4. Continue execution

This follows the same async pattern as `do`/`vibe` AI calls.

## Current State

- **Parsing**: Complete - `compress` and `compress("prompt")` parse correctly
- **AST**: `ContextMode` type already supports `{ compress: string | null }`
- **Runtime**: Compress currently acts like verbose (adds scope markers, no summarization)
- **Summary entry type**: Already exists - `{ kind: 'summary', text: string }`
- **Formatter**: Already handles summaries - displays as `[summary] text`

## Implementation

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

1. `src/runtime/types.ts` - Add status and pending state
2. `src/runtime/state.ts` - Add `resumeWithCompressResult`
3. `src/runtime/step.ts` - Update `applyContextMode` for compress
4. `src/runtime/context.ts` - Add `formatEntriesForSummarization`
5. `src/runtime/index.ts` - Export new function
6. `src/runtime/run.ts` or `src/runtime/ai-provider.ts` - Handle awaiting_compress
7. `src/runtime/test/context-modes.test.ts` - Add/update tests

## Design Decisions

1. **Summary with scope markers** - Output shows `==> for i [summary] text <== for i`
2. **Uses current model** - Compress uses whatever model is configured (via `model` declaration)
3. **Default prompt** - If no custom prompt, uses sensible default focusing on results
4. **Async pattern** - Follows established `awaiting_*` + `resumeWith*` pattern
5. **Entry formatting** - Reuses context formatting logic for consistency

## Edge Cases

- **Empty loop**: If loop has no iterations, skip compression (nothing to summarize)
- **Nested loops**: Each compress operates on its own scope independently
- **AI errors**: Let errors propagate like other AI calls (retry logic in provider)
