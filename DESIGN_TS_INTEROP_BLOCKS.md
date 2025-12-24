# TypeScript Interop Blocks - Design Proposal

## Concept

Add `ts { }` blocks to Vibe that execute TypeScript code directly, with explicit variable passing between Vibe and TypeScript contexts.

## Syntax Options

### Option 1: Inline Expression (Simplest)
```vibe
let random = ts { Math.random() * 100 }
let now = ts { Date.now() }
```

### Option 2: Function-Style with Parameters
```vibe
let text = "hello world"
let upper = ts(text) {
  return text.toUpperCase();
}

let numbers = [1, 2, 3]
let doubled = ts(numbers) {
  return numbers.map(x => x * 2);
}
```

### Option 3: Multi-line with Explicit Return
```vibe
let data = [1, 2, 3, 4, 5]
let result = ts(data) {
  const filtered = data.filter(x => x > 2);
  const doubled = filtered.map(x => x * 2);
  const sum = doubled.reduce((a, b) => a + b, 0);
  return sum;
}
// result = 24
```

### Option 4: Named TypeScript Functions (Reusable)
```vibe
// Define a TypeScript function
ts function processArray(arr) {
  return arr
    .filter(x => x > 0)
    .map(x => x * 2)
    .sort((a, b) => a - b);
}

// Use it like a Vibe function
let nums = [-1, 3, 1, 4, -2, 5]
let processed = processArray(nums)  // [2, 6, 8, 10]
```

### Option 5: Multi-statement with Imports
```vibe
ts {
  import { readFileSync } from 'fs';
  import axios from 'axios';

  export function loadData(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  export async function fetchAPI(url) {
    const response = await axios.get(url);
    return response.data;
  }
}

// Use the exported functions
let config = loadData("config.json")
let apiData = await fetchAPI("https://api.example.com/data")
```

## Real-World Examples

### Example 1: Data Processing Pipeline
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

// Load and parse JSON with TypeScript
let rawData = ts {
  const fs = require('fs');
  return JSON.parse(fs.readFileSync('data.json', 'utf-8'));
}

// Process with TypeScript
let processed = ts(rawData) {
  return rawData.items
    .filter(item => item.active)
    .map(item => ({
      id: item.id,
      name: item.name.toUpperCase(),
      score: Math.round(item.score * 100) / 100
    }))
    .sort((a, b) => b.score - a.score);
}

// Build prompt for AI
let topItems = processed.slice(0, 5)
let itemNames = ts(topItems) {
  return topItems.map(i => i.name).join(', ');
}

// Use AI for analysis
let analysis = do "Analyze these top performers: {itemNames}" m default

// Format output with TypeScript
let report = ts(processed, analysis) {
  return JSON.stringify({
    total: processed.length,
    top_5: processed.slice(0, 5),
    ai_analysis: analysis,
    timestamp: new Date().toISOString()
  }, null, 2);
}

console.log(report)
```

### Example 2: Web Scraping + AI Analysis
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

// Fetch data with TypeScript (can use any npm package!)
let webData = ts {
  const axios = require('axios');
  const cheerio = require('cheerio');

  const html = await axios.get('https://example.com/articles');
  const $ = cheerio.load(html.data);

  const articles = [];
  $('.article').each((i, elem) => {
    articles.push({
      title: $(elem).find('h2').text(),
      excerpt: $(elem).find('.excerpt').text(),
      date: $(elem).find('.date').text()
    });
  });

  return articles;
}

// Process each article with AI
let summaries = []
for (let article in webData) {
  let title = article.title
  let excerpt = article.excerpt
  let summary = do "Summarize this article: {title} - {excerpt}" m default
  summaries.push(summary)
}

// Aggregate with TypeScript
let report = ts(webData, summaries) {
  return {
    article_count: webData.length,
    summaries: summaries,
    generated_at: Date.now()
  };
}
```

### Example 3: Mixed Vibe/TS Workflow
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

// Define reusable TypeScript utilities
ts {
  export function parseCSV(text) {
    return text.split('\n').map(line => line.split(','));
  }

  export function groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const value = item[key];
      (groups[value] = groups[value] || []).push(item);
      return groups;
    }, {});
  }

  export function stats(numbers) {
    const sum = numbers.reduce((a, b) => a + b, 0);
    const avg = sum / numbers.length;
    const sorted = [...numbers].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { sum, avg, median, min: sorted[0], max: sorted[sorted.length - 1] };
  }
}

// Load data
let csvText = ts { require('fs').readFileSync('sales.csv', 'utf-8') }
let rows = parseCSV(csvText)

// Group by category
let grouped = groupBy(rows, "category")

// Calculate stats for each group
let categoryStats = ts(grouped) {
  const result = {};
  for (const [category, items] of Object.entries(grouped)) {
    const sales = items.map(item => parseFloat(item.amount));
    result[category] = stats(sales);
  }
  return result;
}

// Use AI to interpret
let interpretation = do "Interpret these sales stats: {categoryStats}" m default

// Final report
let output = ts(categoryStats, interpretation) {
  return JSON.stringify({
    statistics: categoryStats,
    ai_interpretation: interpretation,
    report_date: new Date().toISOString()
  }, null, 2);
}
```

## AST Design

```typescript
// Option 1: Inline expression
export interface TSExpression extends BaseNode {
  type: 'TSExpression';
  code: string;           // The TypeScript code as a string
  parameters: string[];   // Parameter names to pass in
}

// Option 2: Named function
export interface TSFunctionDeclaration extends BaseNode {
  type: 'TSFunctionDeclaration';
  name: string;
  parameters: string[];
  code: string;           // TypeScript function body
}

// Option 3: Module block
export interface TSModuleBlock extends BaseNode {
  type: 'TSModuleBlock';
  code: string;           // Full TypeScript module code
  exports: string[];      // Names of exported functions
}
```

## Runtime Implementation

### Simple Approach (eval-based)
```typescript
function execTSExpression(state: RuntimeState, expr: AST.TSExpression): RuntimeState {
  // Get parameter values from Vibe scope
  const paramValues = expr.parameters.map(name => {
    const found = lookupVariable(state, name);
    return found ? found.variable.value : undefined;
  });

  // Create TypeScript function
  const paramNames = expr.parameters.join(', ');
  const tsFunction = new Function(paramNames, expr.code);

  // Execute and get result
  const result = tsFunction(...paramValues);

  return { ...state, lastResult: result };
}
```

### Advanced Approach (with type checking)
```typescript
import ts from 'typescript';

function execTSExpression(state: RuntimeState, expr: AST.TSExpression): RuntimeState {
  // Wrap in function
  const wrappedCode = `
    (${expr.parameters.join(', ')}) => {
      ${expr.code}
    }
  `;

  // Transpile TypeScript to JavaScript
  const result = ts.transpileModule(wrappedCode, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  });

  // Evaluate
  const fn = eval(result.outputText);
  const paramValues = expr.parameters.map(name => getVariable(state, name));
  const output = fn(...paramValues);

  return { ...state, lastResult: output };
}
```

## Comparison: TS Blocks vs Member Expressions

| Feature | TS Blocks | Member Expressions |
|---------|-----------|-------------------|
| **Implementation** | Simple (eval/Function) | Medium (parser, runtime) |
| **TypeScript Power** | 100% (full TS) | ~60% (only what we implement) |
| **npm Packages** | Yes (any package) | No (unless we add imports) |
| **Syntax** | Explicit boundary | Seamless integration |
| **Learning Curve** | Low (devs know TS) | Medium (new syntax) |
| **Security** | Risky (arbitrary code) | Safer (controlled) |
| **Performance** | Slower (eval overhead) | Faster (direct execution) |
| **Debugging** | Harder (two contexts) | Easier (one context) |
| **Type Safety** | Yes (with TS compiler) | No (unless we add types) |

## Hybrid Approach (Best of Both Worlds)

Combine both approaches:

```vibe
// Built-in member expressions for common cases
let text = "hello"
let upper = text.toUpperCase()        // Member expression
let nums = [1, 2, 3].map(x => x * 2)  // Member expression

// TS blocks for complex/library code
let data = ts {
  const axios = require('axios');
  const response = await axios.get('https://api.example.com');
  return response.data;
}

// AI processing
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }
let analysis = do "Analyze this data: {data}" m default

// TS block for formatting
let report = ts(analysis, data) {
  return {
    summary: analysis,
    data_points: data.length,
    timestamp: Date.now()
  };
}
```

## Security Considerations

### Sandboxing Options

**Option 1: No Sandbox (Development)**
```typescript
// Direct eval - full access
const result = eval(tsCode);
```

**Option 2: VM2 Sandbox**
```typescript
import { VM } from 'vm2';

const vm = new VM({
  timeout: 1000,
  sandbox: {
    // Only expose what we want
    console: console,
    Math: Math,
    JSON: JSON,
    // No 'require', 'process', 'fs', etc.
  }
});

const result = vm.run(tsCode);
```

**Option 3: Deno-style Permissions**
```vibe
// Explicit permission flags
ts --allow-net --allow-read="./data" {
  const data = await fetch('https://api.example.com');
  const file = Deno.readTextFileSync('./data/config.json');
  return { data, file };
}
```

## Pros & Cons

### Pros
✅ **Simple implementation** - just eval TypeScript code
✅ **Full TypeScript power** - any feature, any library
✅ **npm ecosystem** - can use any package
✅ **Familiar to developers** - it's just TypeScript
✅ **Type safety** - TypeScript compiler catches errors
✅ **No parsing needed** - don't need to implement JS parser
✅ **Clear boundaries** - obvious what's Vibe vs TypeScript

### Cons
❌ **Security risk** - arbitrary code execution
❌ **Two contexts** - harder to debug
❌ **Performance overhead** - eval is slow
❌ **Less elegant** - explicit blocks vs seamless integration
❌ **Async complexity** - need to handle promises
❌ **Tooling** - syntax highlighting might be confused

## Recommended Approach

**Phase 1: Simple TS Expressions**
```vibe
// Just inline expressions with parameter passing
let result = ts(x, y) { x.toUpperCase() + y.toLowerCase() }
```

**Phase 2: Named TS Functions**
```vibe
ts function process(data) {
  return data.map(x => x * 2).filter(x => x > 5);
}
```

**Phase 3: TS Module Blocks**
```vibe
ts {
  import axios from 'axios';
  export async function fetchData(url) {
    const res = await axios.get(url);
    return res.data;
  }
}
```

**Phase 4: Add Member Expressions**
```vibe
// For common cases, member expressions are nicer
let upper = text.toUpperCase()  // Simple and clean
```

## Implementation Estimate

- AST changes: ~30 minutes
- Lexer changes: ~15 minutes (add `ts` keyword)
- Parser changes: ~1 hour (parse TS blocks as strings)
- Runtime execution: ~2 hours (eval + parameter passing)
- Testing: ~1 hour
- **Total: ~4-5 hours**

## Conclusion

**TS blocks are a great pragmatic approach** that gives you:
- Maximum leverage (entire JS/TS ecosystem)
- Minimal implementation effort
- Clear escape hatch for complex operations
- Familiar syntax for developers

**Combine with member expressions later** for best developer experience:
- Member expressions for simple cases (`.map()`, `.filter()`)
- TS blocks for complex operations (web requests, file I/O, npm packages)

This gives you the best of both worlds!
