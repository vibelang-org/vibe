# Vibe Language - TODO

## Pending

### AI Integration
- [ ] Handle streaming responses
- [ ] Parallel AI calls
  - [ ] Auto-parallelize independent AI calls (no data dependencies)
  - [ ] Configurable concurrency limit

### Context Management Features
- [ ] Context checkpoints beyond local/global
- [ ] Context orchestration functions
- [ ] Variable visibility modifiers
- [ ] Implement `compress` keyword for context compression (PLAN: PLAN-compress-keyword.md)
  - [ ] Add `awaiting_compress` status to RuntimeStatus
  - [ ] Add `pendingCompress` field to RuntimeState
  - [ ] Add `resumeWithCompressResult` function to state.ts
  - [ ] Update `applyContextMode` in step.ts to pause for AI
  - [ ] Add `formatEntriesForSummarization` helper to context.ts
  - [ ] Handle `awaiting_compress` in runner (run.ts or ai-provider.ts)
  - [ ] Update tests in context-modes.test.ts
- [ ] Add convention for storing tool call results in variables
  - [ ] Currently tool results go into context but can't be captured in variables
  - [ ] Need a way to assign tool results so they can be returned from functions
  - [ ] Example: `let result = do "fetch user data"` or similar syntax

### Cleanup
- [x] Remove all `do` keyword references from docs (replaced by `vibe`)
- [x] Remove `cache` keyword from lexer and docs (no longer needed)
- [x] Fix all TypeScript errors (`bun tsc --noEmit`)

### Permission System
- [ ] Command permission scheme (like Claude Code settings)
  - [ ] Config file format (`.vibe/settings.json` or `vibe.config.json`)
  - [ ] Allow/deny lists with glob patterns for tools and commands
  - [ ] Interactive prompts for unknown/dangerous operations
  - [ ] Global config (`~/.vibe/settings.json`) and project config
  - [ ] CLI flags: `--yes-all`, `--safe-mode`

### Real-World Examples
- [ ] Code review assistant (`examples/code-review.vibe`)
  - Takes git diff, AI analyzes, outputs structured review
- [ ] Changelog generator (`examples/changelog.vibe`)
  - Reads git log between tags, AI summarizes into categories
- [ ] File organizer (`examples/file-organizer.vibe`)
  - Scans directory, AI categorizes, moves files to folders
- [ ] Interactive chat (`examples/chat.vibe`)
  - Simple REPL chat demonstrating context management

### VSCode Integration
- [ ] Build VSCode LSP for Vibe
  - [ ] Syntax highlighting
  - [ ] Diagnostics (errors, warnings)
  - [ ] Go to definition
  - [ ] Hover information
  - [ ] Autocomplete
- [ ] Build debug support for VSCode
  - [ ] Debug Adapter Protocol (DAP) implementation
  - [ ] Breakpoints
  - [ ] Step through execution
  - [ ] Variable inspection
  - [ ] Call stack visualization

### Claude Code Plugin Distribution
- [ ] Package symbol-tree as shareable plugin

## Completed (Last 10)

- [x] Remove context modes from functions (e3014ad)
  - [x] Functions now always "forget" context on exit like traditional callstack
  - [x] Loops retain forget/verbose/compress modes
  - [x] Return values are the interface for passing data out

- [x] Single-round AI command (`do` keyword)
  - [x] `do` keyword for single-round AI call (executes tools once, no loop back)
  - [x] `vibe` continues to support multi-turn tool calling (up to 10 rounds)
  - [x] Parser, visitor, runtime types, AI provider updated
  - [x] Removed `Ask` token from lexer (internal `'ask'` type preserved for user input)

- [x] Runtime safety for const objects in ts blocks
  - [x] Deep freeze const JSON objects before passing to ts blocks
  - [x] Added 'use strict' to AsyncFunction for proper error throwing
  - [x] Const objects/arrays cannot be mutated; let objects can be

- [x] Code Generation Tool (bash, runCode)
  - [x] `bash` tool using Bun's cross-platform shell via temp script
  - [x] `runCode` tool with subprocess isolation and scope injection
  - [x] Unique run folders (.vibe-cache/r1, r2...) with mutex for concurrency
  - [x] Timeout enforcement with process kill

- [x] AI-initiated tool calling (Phase 5)
  - [x] Tool schema conversion for OpenAI, Anthropic, Google providers
  - [x] Tool call parsing from AI responses (all 3 providers)
  - [x] Multi-turn tool execution loop (`executeWithTools`)
  - [x] Tool calls embedded in prompt entries for proper context ordering
  - [x] Context shows: AI call → tool calls → results → final response
  - [x] Flow tests with mock AI provider executing real tools
  - [x] Loop context modes (forget/verbose) properly handle tool calls

- [x] Tool calling system (foundation)
  - [x] Tool registry with built-in tools (sleep, now, jsonParse, jsonStringify, env, etc.)
  - [x] `tool` keyword for user-defined tools with `@description` and `@param` decorators
  - [x] TypeScript type extraction for complex parameter types (JSON Schema)
  - [x] Tool execution via `awaiting_tool` status and `resumeWithToolResult`
  - [x] Tools callable like functions in Vibe code

- [x] Context modes for loops and functions
  - [x] Trailing keywords: `forget`, `verbose`, `compress("prompt")`
  - [x] Snapshot values in orderedEntries (not references)
  - [x] Scope-enter/scope-exit markers for context output
  - [x] Store AI response in prompt entry when AI returns
  - [x] Default behavior: verbose (keep full history)

- [x] Anthropic prompt caching optimization
  - [x] Progressive chunked caching for growing context
  - [x] `cache_control: { type: "ephemeral" }` on system prompt
  - [x] Cache breakpoint on 2nd-to-last chunk (latest can change freely)

- [x] Add TypeScript types, interfaces, and enums to symbol tree output
  - [x] Include in symbol summary section with start/end line numbers
  - [x] Show type dependencies (extends, uses relationships)

- [x] Context improvements for AI conversation history
  - [x] Track value source on variables (`ai`, `user`, or `undefined`)
  - [x] Show AI responses with `<--` prefix vs `-` for regular variables
  - [x] Format: `--> vibe: "prompt"` followed by `<-- varName: response`
