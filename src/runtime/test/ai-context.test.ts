import { describe, expect, test } from 'bun:test';
import { parse } from '../../parser/parse';
import {
  createInitialState,
  runUntilPause,
  resumeWithAIResponse,
  type ContextVariable,
} from '../index';
import { formatContextForAI } from '../context';
import { runWithMockAI } from './helpers';

describe('AI Context Tests', () => {
  // ============================================================================
  // Prompt type filtering in AI calls
  // ============================================================================

  test('prompt typed variables filtered from context during do call', () => {
    const ast = parse(`
      const SYSTEM: prompt = "You are a helpful assistant"
      let userQuestion: prompt = "What is 2+2?"
      let userData = "some user data"
      model m = { name: "test", apiKey: "key", url: "http://test" }
      let result = do userQuestion m default
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('What is 2+2?');

    // Prompt typed variables (SYSTEM, userQuestion) and model should be filtered out
    // Only userData should remain
    expect(state.localContext).toEqual([
      { name: 'userData', value: 'some user data', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    expect(state.globalContext).toEqual(state.localContext);
  });

  test('prompt typed variables filtered in nested function context', () => {
    const ast = parse(`
      const GLOBAL_PROMPT: prompt = "Global system prompt"
      const GLOBAL_DATA = "global data value"
      model m = { name: "test", apiKey: "key", url: "http://test" }

      function processQuery(input) {
        const LOCAL_PROMPT: prompt = "Process this: {input}"
        let localData = "local data"
        return do LOCAL_PROMPT m default
      }

      let result = processQuery("user query")
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('Process this: user query');

    // Local context: function frame only, LOCAL_PROMPT filtered out
    expect(state.localContext).toEqual([
      { name: 'input', value: 'user query', type: null, isConst: false, frameName: 'processQuery', frameDepth: 1 },
      { name: 'localData', value: 'local data', type: null, isConst: false, frameName: 'processQuery', frameDepth: 1 },
    ]);

    // Global context: entry frame + function frame, all prompts and model filtered
    expect(state.globalContext).toEqual([
      { name: 'GLOBAL_DATA', value: 'global data value', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'input', value: 'user query', type: null, isConst: false, frameName: 'processQuery', frameDepth: 1 },
      { name: 'localData', value: 'local data', type: null, isConst: false, frameName: 'processQuery', frameDepth: 1 },
    ]);
  });

  test('prompt filtering with multiple do calls and result assignment', () => {
    // Assignment order: inputData, model, ANALYZE_PROMPT, analyzed, SUMMARIZE_PROMPT, summary
    // Context should show visible variables in assignment order (prompts/model filtered)
    const ast = parse(`
      let inputData = "raw data"
      model m = { name: "test", apiKey: "key", url: "http://test" }
      const ANALYZE_PROMPT: prompt = "Analyze this"
      let analyzed = do ANALYZE_PROMPT m default
      const SUMMARIZE_PROMPT: prompt = "Summarize this"
      let summary = do SUMMARIZE_PROMPT m default
    `);

    let state = createInitialState(ast);

    // First do call - after inputData, model, ANALYZE_PROMPT assigned
    state = runUntilPause(state);
    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('Analyze this');

    // Context at first AI call: only inputData visible (model, ANALYZE_PROMPT filtered)
    expect(state.localContext).toEqual([
      { name: 'inputData', value: 'raw data', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    // Verify formatted text context at first pause
    const formatted1 = formatContextForAI(state.localContext, { includeInstructions: false });
    expect(formatted1.text).toBe(
      `  <entry> (current scope)
    - inputData: raw data`
    );

    // Resume - analyzed gets assigned, then SUMMARIZE_PROMPT, then pause at second do
    state = resumeWithAIResponse(state, 'analysis result');
    state = runUntilPause(state);
    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('Summarize this');

    // Context at second AI call: inputData, analyzed (in assignment order, prompts filtered)
    expect(state.localContext).toEqual([
      { name: 'inputData', value: 'raw data', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'analyzed', value: 'analysis result', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    // Verify formatted text context at second pause - shows assignment order
    const formatted2 = formatContextForAI(state.localContext, { includeInstructions: false });
    expect(formatted2.text).toBe(
      `  <entry> (current scope)
    - inputData: raw data
    - analyzed: analysis result`
    );

    // Complete execution
    state = resumeWithAIResponse(state, 'summary result');
    state = runUntilPause(state);
    expect(state.status).toBe('completed');

    // Verify locals have values in assignment order (including filtered types)
    const locals = state.callStack[0].locals;
    expect(locals['inputData'].value).toBe('raw data');
    // model filtered from context
    expect(locals['ANALYZE_PROMPT'].value).toBe('Analyze this');
    expect(locals['analyzed'].value).toBe('analysis result');
    expect(locals['SUMMARIZE_PROMPT'].value).toBe('Summarize this');
    expect(locals['summary'].value).toBe('summary result');

    // Context at completion - now includes all final variables
    expect(state.localContext).toEqual([
      { name: 'inputData', value: 'raw data', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'analyzed', value: 'analysis result', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'summary', value: 'summary result', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    // Verify formatted text context at completion - shows all variables in assignment order
    const formatted3 = formatContextForAI(state.localContext, { includeInstructions: false });
    expect(formatted3.text).toBe(
      `  <entry> (current scope)
    - inputData: raw data
    - analyzed: analysis result
    - summary: summary result`
    );
  });

  test('deeply nested functions with prompt variables at each level', () => {
    const ast = parse(`
      const ROOT_PROMPT: prompt = "Root prompt"
      const ROOT_DATA = "root data"
      model m = { name: "test", apiKey: "key", url: "http://test" }

      function level1(input) {
        const L1_PROMPT: prompt = "Level 1 prompt"
        let l1Data = "level 1 data"
        return level2(input)
      }

      function level2(input) {
        const L2_PROMPT: prompt = "Level 2 prompt"
        let l2Data = "level 2 data"
        return do "Process {input}" m default
      }

      let result = level1("deep input")
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('Process deep input');

    // Local context: level2 frame only, L2_PROMPT filtered
    expect(state.localContext).toEqual([
      { name: 'input', value: 'deep input', type: null, isConst: false, frameName: 'level2', frameDepth: 2 },
      { name: 'l2Data', value: 'level 2 data', type: null, isConst: false, frameName: 'level2', frameDepth: 2 },
    ]);

    // Global context: all frames, all prompts filtered, all models filtered
    expect(state.globalContext).toEqual([
      { name: 'ROOT_DATA', value: 'root data', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'input', value: 'deep input', type: null, isConst: false, frameName: 'level1', frameDepth: 1 },
      { name: 'l1Data', value: 'level 1 data', type: null, isConst: false, frameName: 'level1', frameDepth: 1 },
      { name: 'input', value: 'deep input', type: null, isConst: false, frameName: 'level2', frameDepth: 2 },
      { name: 'l2Data', value: 'level 2 data', type: null, isConst: false, frameName: 'level2', frameDepth: 2 },
    ]);

    // Verify formatted output shows proper nesting without any prompts
    const formatted = formatContextForAI(state.globalContext, { includeInstructions: false });
    expect(formatted.text).toBe(
      `  <entry> (entry)
    - ROOT_DATA: root data

    level1 (depth 1)
      - input: deep input
      - l1Data: level 1 data

      level2 (current scope)
        - input: deep input
        - l2Data: level 2 data`
    );
  });

  // ============================================================================
  // Context captured before AI calls
  // ============================================================================

  test('context captured before do call', () => {
    const ast = parse(`
      const API_KEY = "secret"
      let counter = "0"
      model m = { name: "test", apiKey: "key123", url: "http://test" }
      let result = do "process data" m default
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');

    // Verify complete local context before AI call (models filtered out)
    expect(state.localContext).toEqual([
      { name: 'API_KEY', value: 'secret', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'counter', value: '0', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    // Global context same as local at top level
    expect(state.globalContext).toEqual(state.localContext);
  });

  test('context includes function parameters when inside function', () => {
    const ast = parse(`
      model m = { name: "test", apiKey: "key", url: "http://test" }
      function process(input) {
        let localVar = "local value"
        return do "process {input}" m default
      }
      let result = process("my input")
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');

    // Local context should have function params and locals only (depth 1 = called from entry)
    expect(state.localContext).toEqual([
      { name: 'input', value: 'my input', type: null, isConst: false, frameName: 'process', frameDepth: 1 },
      { name: 'localVar', value: 'local value', type: null, isConst: false, frameName: 'process', frameDepth: 1 },
    ]);

    // Global context has entry frame (depth 0, model filtered out) + function frame (depth 1)
    expect(state.globalContext).toEqual([
      { name: 'input', value: 'my input', type: null, isConst: false, frameName: 'process', frameDepth: 1 },
      { name: 'localVar', value: 'local value', type: null, isConst: false, frameName: 'process', frameDepth: 1 },
    ]);
  });

  // ============================================================================
  // Context formatter tests
  // ============================================================================

  test('context formatter formats variables in declaration order', () => {
    // Note: models are filtered out before reaching formatter
    const context: ContextVariable[] = [
      { name: 'mutableVar', value: 'changing', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'CONFIG', value: { key: 'value' }, type: 'json', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'anotherLet', value: 'also changing', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'SYSTEM_PROMPT', value: 'be helpful', type: 'text', isConst: true, frameName: '<entry>', frameDepth: 0 },
    ];

    const formatted = formatContextForAI(context);

    // Variables remain in original order (no sorting)
    expect(formatted.variables).toEqual(context);

    // Verify formatted text - all variables together in declaration order
    expect(formatted.text).toBe(
      `## VIBE Program Context
Variables from the VIBE language call stack.

  <entry> (current scope)
    - mutableVar: changing
    - CONFIG (json): {"key":"value"}
    - anotherLet: also changing
    - SYSTEM_PROMPT (text): be helpful`
    );
  });

  test('context formatter preserves declaration order', () => {
    const context: ContextVariable[] = [
      { name: 'z_const', value: 'z', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'a_let', value: 'a', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'a_const', value: 'a', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'z_let', value: 'z', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ];

    const formatted = formatContextForAI(context);

    // Variables remain in original declaration order
    expect(formatted.variables).toEqual(context);

    // Verify formatted text preserves order (no instructions for clarity)
    const noInstructions = formatContextForAI(context, { includeInstructions: false });
    expect(noInstructions.text).toBe(
      `  <entry> (current scope)
    - z_const: z
    - a_let: a
    - a_const: a
    - z_let: z`
    );
  });

  test('context with all type annotations formats correctly', () => {
    // Note: models are filtered out before reaching formatter, so only text/json/null types
    const context: ContextVariable[] = [
      { name: 'jsonVar', value: { key: 'value' }, type: 'json', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'textVar', value: 'text value', type: 'text', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'untypedConst', value: 'constant', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'untypedLet', value: 'mutable', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ];

    const formatted = formatContextForAI(context);

    // Verify formatted output - all variables together in declaration order
    expect(formatted.text).toBe(
      `## VIBE Program Context
Variables from the VIBE language call stack.

  <entry> (current scope)
    - jsonVar (json): {"key":"value"}
    - textVar (text): text value
    - untypedConst: constant
    - untypedLet: mutable`
    );

    // Verify variables array matches input
    expect(formatted.variables).toEqual(context);
  });

  test('context without instructions outputs variables only', () => {
    const context: ContextVariable[] = [
      { name: 'API_KEY', value: 'secret123', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'counter', value: '42', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ];

    const formatted = formatContextForAI(context, { includeInstructions: false });

    expect(formatted.text).toBe(
      `  <entry> (current scope)
    - API_KEY: secret123
    - counter: 42`
    );
  });

  // ============================================================================
  // Full program tests with mock AI
  // ============================================================================

  test('full program with mock AI response', () => {
    const ast = parse(`
      model m = { name: "test", apiKey: "key", url: "http://test" }
      let input = "hello"
      let result = do "transform {input}" m default
    `);

    let state = createInitialState(ast);
    state = runWithMockAI(state, 'TRANSFORMED');

    expect(state.status).toBe('completed');
    expect(state.callStack[0].locals['result'].value).toBe('TRANSFORMED');
  });

  test('multiple do calls with different mock responses', () => {
    const ast = parse(`
      model m = { name: "test", apiKey: "key", url: "http://test" }
      let first = do "first prompt" m default
      let second = do "second prompt" m default
    `);

    let state = createInitialState(ast);
    state = runWithMockAI(state, {
      'first prompt': 'FIRST_RESPONSE',
      'second prompt': 'SECOND_RESPONSE',
    });

    expect(state.status).toBe('completed');
    expect(state.callStack[0].locals['first'].value).toBe('FIRST_RESPONSE');
    expect(state.callStack[0].locals['second'].value).toBe('SECOND_RESPONSE');
  });

  test('context state correct after mock AI response', () => {
    const ast = parse(`
      model m = { name: "test", apiKey: "key", url: "http://test" }
      const SYSTEM = "system prompt"
      let result = do "query" m default
    `);

    let state = createInitialState(ast);
    state = runWithMockAI(state, 'AI_RESPONSE');

    expect(state.status).toBe('completed');

    // Verify final variables have correct values and isConst
    const locals = state.callStack[0].locals;
    expect(locals['m'].isConst).toBe(true);
    expect(locals['SYSTEM'].isConst).toBe(true);
    expect(locals['result'].isConst).toBe(false);
    expect(locals['result'].value).toBe('AI_RESPONSE');
  });

  // ============================================================================
  // Complex program context tests
  // ============================================================================

  test('complex program with mix of const, let, models - global scope', () => {
    // Complex program with multiple models, constants, and variables
    const ast = parse(`
      const API_BASE = "https://api.example.com"
      const CONFIG: json = { timeout: "30", retries: "3" }
      model gpt = { name: "gpt-4", apiKey: "key1", url: "http://gpt" }
      model claude = { name: "claude", apiKey: "key2", url: "http://claude" }
      let userInput: text = "hello world"
      let counter = "0"
      let metadata: json = { version: "1.0" }
      let result = do "process {userInput}" gpt default
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');

    // Models (gpt, claude) should be filtered out of context
    // Verify complete local context with correct order and types (all in entry frame, depth 0)
    expect(state.localContext).toEqual([
      { name: 'API_BASE', value: 'https://api.example.com', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'CONFIG', value: { timeout: '30', retries: '3' }, type: 'json', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'userInput', value: 'hello world', type: 'text', isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'counter', value: '0', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'metadata', value: { version: '1.0' }, type: 'json', isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    // Global context same at top level
    expect(state.globalContext).toEqual(state.localContext);

    // Verify formatted context sorts const first
    const formatted = formatContextForAI(state.localContext);
    expect(formatted.variables).toEqual([
      { name: 'API_BASE', value: 'https://api.example.com', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'CONFIG', value: { timeout: '30', retries: '3' }, type: 'json', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'userInput', value: 'hello world', type: 'text', isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'counter', value: '0', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'metadata', value: { version: '1.0' }, type: 'json', isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);
  });

  test('complex function with params, locals, and nested block', () => {
    // Function with multiple parameters, local variables, and AI call inside nested block
    const ast = parse(`
      const SYSTEM_PROMPT = "You are a helpful assistant"
      model m = { name: "test", apiKey: "key", url: "http://test" }

      function processData(inputText, options) {
        const FUNC_CONST = "function constant"
        let normalized: text = "normalized"
        let result: json = { status: "pending" }

        if (inputText) {
          let blockVar = "inside block"
          let response = do "analyze {inputText}" m default
        }
      }

      let output = processData("test input", "opts")
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');

    // Local context should only have current frame (function scope + block scope)
    // Should NOT include model m (filtered out) or outer SYSTEM_PROMPT (different frame)
    // Depth 1 = called from entry
    expect(state.localContext).toEqual([
      { name: 'inputText', value: 'test input', type: null, isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'options', value: 'opts', type: null, isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'FUNC_CONST', value: 'function constant', type: null, isConst: true, frameName: 'processData', frameDepth: 1 },
      { name: 'normalized', value: 'normalized', type: 'text', isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'result', value: { status: 'pending' }, type: 'json', isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'blockVar', value: 'inside block', type: null, isConst: false, frameName: 'processData', frameDepth: 1 },
    ]);

    // Global context includes all frames: <entry> (depth 0) + function (depth 1), models filtered out
    expect(state.globalContext).toEqual([
      { name: 'SYSTEM_PROMPT', value: 'You are a helpful assistant', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'inputText', value: 'test input', type: null, isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'options', value: 'opts', type: null, isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'FUNC_CONST', value: 'function constant', type: null, isConst: true, frameName: 'processData', frameDepth: 1 },
      { name: 'normalized', value: 'normalized', type: 'text', isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'result', value: { status: 'pending' }, type: 'json', isConst: false, frameName: 'processData', frameDepth: 1 },
      { name: 'blockVar', value: 'inside block', type: null, isConst: false, frameName: 'processData', frameDepth: 1 },
    ]);

    // Verify formatted global context preserves declaration order
    const formatted = formatContextForAI(state.globalContext);
    expect(formatted.variables).toEqual(state.globalContext);
  });

  test('context at multiple call depths via sequential do calls', () => {
    // Multi-checkpoint test: verify context at each do call as we traverse the call stack
    const ast = parse(`
      const GLOBAL_CONST = "global"
      model m = { name: "test", apiKey: "key", url: "http://test" }

      function helper(value) {
        const HELPER_CONST = "helper const"
        let helperVar = "helper value"
        return do "helper work with {value}" m default
      }

      function main(input) {
        const MAIN_CONST = "main const"
        let mainVar = "main value"
        let mainResult = do "main work with {input}" m default
        return helper(input)
      }

      let result = main("test")
    `);

    let state = createInitialState(ast);

    // === Checkpoint 1: Inside main(), at first do call ===
    state = runUntilPause(state);
    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('main work with test');

    // Local context: main's frame only (depth 1 = called from entry)
    expect(state.localContext).toEqual([
      { name: 'input', value: 'test', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
      { name: 'MAIN_CONST', value: 'main const', type: null, isConst: true, frameName: 'main', frameDepth: 1 },
      { name: 'mainVar', value: 'main value', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
    ]);

    // Global context: <entry> (depth 0) + main function (depth 1), models filtered
    expect(state.globalContext).toEqual([
      { name: 'GLOBAL_CONST', value: 'global', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'input', value: 'test', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
      { name: 'MAIN_CONST', value: 'main const', type: null, isConst: true, frameName: 'main', frameDepth: 1 },
      { name: 'mainVar', value: 'main value', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
    ]);

    // Verify formatted context preserves declaration order at checkpoint 1
    const formatted1 = formatContextForAI(state.globalContext);
    expect(formatted1.variables).toEqual(state.globalContext);

    // Resume and continue to next pause
    state = resumeWithAIResponse(state, 'main response');

    // === Checkpoint 2: Inside helper(), at second do call ===
    state = runUntilPause(state);
    expect(state.status).toBe('awaiting_ai');
    expect(state.pendingAI?.prompt).toBe('helper work with test');

    // Local context: helper's frame only (depth 2 = called from main which is called from entry)
    expect(state.localContext).toEqual([
      { name: 'value', value: 'test', type: null, isConst: false, frameName: 'helper', frameDepth: 2 },
      { name: 'HELPER_CONST', value: 'helper const', type: null, isConst: true, frameName: 'helper', frameDepth: 2 },
      { name: 'helperVar', value: 'helper value', type: null, isConst: false, frameName: 'helper', frameDepth: 2 },
    ]);

    // Global context: <entry> (depth 0) + main (depth 1) + helper (depth 2), models filtered
    // Note: mainResult now has the response from checkpoint 1
    expect(state.globalContext).toEqual([
      { name: 'GLOBAL_CONST', value: 'global', type: null, isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'input', value: 'test', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
      { name: 'MAIN_CONST', value: 'main const', type: null, isConst: true, frameName: 'main', frameDepth: 1 },
      { name: 'mainVar', value: 'main value', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
      { name: 'mainResult', value: 'main response', type: null, isConst: false, frameName: 'main', frameDepth: 1 },
      { name: 'value', value: 'test', type: null, isConst: false, frameName: 'helper', frameDepth: 2 },
      { name: 'HELPER_CONST', value: 'helper const', type: null, isConst: true, frameName: 'helper', frameDepth: 2 },
      { name: 'helperVar', value: 'helper value', type: null, isConst: false, frameName: 'helper', frameDepth: 2 },
    ]);

    // Verify formatted context preserves declaration order at checkpoint 2
    const formatted2 = formatContextForAI(state.globalContext);
    expect(formatted2.variables).toEqual(state.globalContext);

    // Verify formatted text with nested call stack (3 frames: entry=0, main=1, helper=2)
    // All variables together, grouped by frame with indentation
    // Entry is leftmost (least indented), deeper calls are more indented
    expect(formatted2.text).toBe(
      `## VIBE Program Context
Variables from the VIBE language call stack.

  <entry> (entry)
    - GLOBAL_CONST: global

    main (depth 1)
      - input: test
      - MAIN_CONST: main const
      - mainVar: main value
      - mainResult: main response

      helper (current scope)
        - value: test
        - HELPER_CONST: helper const
        - helperVar: helper value`
    );

    // Resume and complete
    state = resumeWithAIResponse(state, 'helper response');
    state = runUntilPause(state);
    expect(state.status).toBe('completed');
  });

  test('context with all type annotations and complex values', () => {
    const ast = parse(`
      const PROMPT: text = "analyze this data"
      const CONFIG: json = { modelName: "gpt-4", temperature: "high" }
      model ai = { name: "test", apiKey: "key", url: "http://test" }
      let userMessage: text = "user says hello"
      let data: json = { items: ["a", "b", "c"], count: "3" }
      let untypedVar = "plain string"
      let result = do "process" ai default
    `);

    let state = createInitialState(ast);
    state = runUntilPause(state);

    expect(state.status).toBe('awaiting_ai');

    // Verify all variables with their types (model 'ai' filtered out)
    expect(state.localContext).toEqual([
      { name: 'PROMPT', value: 'analyze this data', type: 'text', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'CONFIG', value: { modelName: 'gpt-4', temperature: 'high' }, type: 'json', isConst: true, frameName: '<entry>', frameDepth: 0 },
      { name: 'userMessage', value: 'user says hello', type: 'text', isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'data', value: { items: ['a', 'b', 'c'], count: '3' }, type: 'json', isConst: false, frameName: '<entry>', frameDepth: 0 },
      { name: 'untypedVar', value: 'plain string', type: null, isConst: false, frameName: '<entry>', frameDepth: 0 },
    ]);

    // Verify formatted output - all variables together in declaration order
    const formatted = formatContextForAI(state.localContext, { includeInstructions: false });
    expect(formatted.text).toBe(
      `  <entry> (current scope)
    - PROMPT (text): analyze this data
    - CONFIG (json): {"modelName":"gpt-4","temperature":"high"}
    - userMessage (text): user says hello
    - data (json): {"items":["a","b","c"],"count":"3"}
    - untypedVar: plain string`
    );
  });
});
