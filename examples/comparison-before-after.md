# Before & After: JavaScript Interop Patterns

## Pattern 1: String Manipulation

### ❌ Current Vibe (Without Member Expressions)
```vibe
// Very limited - would need built-in functions
let text = "hello world"
let upper = toUpperCase(text)  // Need to implement this function!
let words = split(text, " ")   // Need to implement this!
let firstWord = getIndex(words, 0)  // Need to implement this!
```

### ✅ With Member Expressions
```vibe
// Direct JavaScript access - zero implementation needed!
let text = "hello world"
let upper = text.toUpperCase()      // "HELLO WORLD"
let words = text.split(" ")         // ["hello", "world"]
let firstWord = words[0]            // "hello"
let trimmed = text.trim()
let replaced = text.replace("world", "vibe")
let hasHello = text.includes("hello")
```

**Benefit:** Get 50+ string methods for free!

---

## Pattern 2: Array Processing

### ❌ Current Vibe (Without Member Expressions)
```vibe
// Would need to implement each operation
let numbers = [1, 2, 3, 4, 5]

// Need custom map function
function map(arr, fn) {
  let result = []
  // ... implement iteration and transformation
  return result
}

let doubled = map(numbers, (x) => x * 2)

// Need custom filter function
function filter(arr, fn) {
  let result = []
  // ... implement filtering logic
  return result
}

let evens = filter(numbers, (x) => x % 2 == 0)
```

### ✅ With Member Expressions
```vibe
// JavaScript array methods work directly!
let numbers = [1, 2, 3, 4, 5]

let doubled = numbers.map((x) => x * 2)           // [2, 4, 6, 8, 10]
let evens = numbers.filter((x) => x % 2 == 0)     // [2, 4]
let sum = numbers.reduce((a, b) => a + b, 0)      // 15
let first3 = numbers.slice(0, 3)                  // [1, 2, 3]
let joined = numbers.join(", ")                   // "1, 2, 3, 4, 5"

// Chain operations!
let result = numbers
  .filter((x) => x > 2)
  .map((x) => x * 2)
  .reduce((a, b) => a + b, 0)  // 24
```

**Benefit:** Get 30+ array methods for free!

---

## Pattern 3: JSON Handling

### ❌ Current Vibe (Without Member Expressions)
```vibe
// Would need custom JSON parser/stringifier
let jsonText = '{"name": "Alice", "age": 30}'

// Impossible without implementing a full JSON parser!
// let data = parseJSON(jsonText)  // Would take weeks to implement correctly

// Workaround: hardcode the data
let data = {name: "Alice", age: 30}
```

### ✅ With Member Expressions
```vibe
// JavaScript JSON object works directly!
let jsonText = '{"name": "Alice", "age": 30}'
let data = JSON.parse(jsonText)         // {name: "Alice", age: 30}
let name = data.name                    // "Alice"

// Stringify back to JSON
let newData = {name: "Bob", score: 95}
let jsonOutput = JSON.stringify(newData)  // '{"name":"Bob","score":95}'

// Pretty print
let pretty = JSON.stringify(newData, null, 2)
/*
{
  "name": "Bob",
  "score": 95
}
*/
```

**Benefit:** Full JSON support with zero code!

---

## Pattern 4: Real-World AI Workflow

### ❌ Current Vibe (Without Member Expressions)
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

// Limited data processing
let data = {users: ["alice", "bob", "charlie"]}

// Can't easily transform arrays
// Can't convert to/from JSON
// Can't format output nicely

let prompt = "Analyze these users"
let analysis = do prompt m default
```

### ✅ With Member Expressions
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

// Load data from JSON
let rawData = '{"users": ["alice", "bob", "charlie"], "scores": [85, 92, 78]}'
let data = JSON.parse(rawData)

// Transform with JavaScript
let users = data.users
  .map((u) => u.toUpperCase())
  .filter((u) => u.length > 3)
  .join(", ")

// Calculate statistics
let avgScore = data.scores.reduce((a, b) => a + b) / data.scores.length
let maxScore = Math.max(...data.scores)
let minScore = Math.min(...data.scores)

// Build context for AI
let context = `Users: ${users}, Avg Score: ${avgScore}, Range: ${minScore}-${maxScore}`

// Get AI analysis
let analysis = do "Analyze this data: {context}" m default

// Format output
let report = {
  users: users,
  stats: { avg: avgScore, max: maxScore, min: minScore },
  analysis: analysis,
  timestamp: Date.now()
}

let output = JSON.stringify(report, null, 2)
console.log(output)
```

**Benefit:** Complete data pipeline with AI integration!

---

## Pattern 5: Web Data Processing

### ❌ Current Vibe (Without Member Expressions)
```vibe
// Very difficult without string/array methods
let apiResponse = '{"items": [...]}'

// Can't parse JSON
// Can't filter/transform arrays
// Can't format output

// Dead end! 😢
```

### ✅ With Member Expressions
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

// Parse API response
let apiResponse = '{"items": [{"title": "Item 1", "price": 29.99}, {"title": "Item 2", "price": 49.99}]}'
let data = JSON.parse(apiResponse)

// Process items
let expensive = data.items
  .filter((item) => item.price > 30)
  .map((item) => item.title)

// Get AI summary
let summary = do "Summarize these expensive items: {expensive}" m default

// Calculate totals
let total = data.items
  .map((item) => item.price)
  .reduce((sum, price) => sum + price, 0)

let roundedTotal = Math.round(total * 100) / 100

// Build report
let report = {
  total_items: data.items.length,
  expensive_count: expensive.length,
  total_price: roundedTotal,
  ai_summary: summary
}

console.log(JSON.stringify(report, null, 2))
```

**Benefit:** Real-world data workflows become possible!

---

## Pattern 6: Text Analysis Pipeline

### ❌ Current Vibe (Without Member Expressions)
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

let text = "This is some text with multiple sentences. Each sentence is different. Some are longer than others."

// Can't split into sentences
// Can't filter by length
// Can't count words

// Limited analysis only 😢
let analysis = do "Analyze this text" m default
```

### ✅ With Member Expressions
```vibe
model m = { name: "gpt-4", apiKey: "key", url: "http://test" }

let text = "This is some text with multiple sentences. Each sentence is different. Some are longer than others."

// Split into sentences
let sentences = text.split(". ")

// Filter long sentences (>30 chars)
let longSentences = sentences.filter((s) => s.length > 30)

// Count words
let wordCount = text.split(" ").length

// Get statistics
let avgSentenceLength = sentences
  .map((s) => s.length)
  .reduce((a, b) => a + b, 0) / sentences.length

let roundedAvg = Math.round(avgSentenceLength)

// Build rich context for AI
let context = {
  total_sentences: sentences.length,
  long_sentences: longSentences.length,
  word_count: wordCount,
  avg_sentence_length: roundedAvg,
  sample_long_sentence: longSentences[0]
}

let contextStr = JSON.stringify(context)

// AI analysis with rich context
let analysis = do "Analyze this text data: {contextStr}" m default

// Format final report
let report = {
  statistics: context,
  ai_analysis: analysis,
  processed_at: new Date().toISOString()
}

console.log(JSON.stringify(report, null, 2))
```

**Benefit:** Sophisticated text analysis pipelines!

---

## Summary: Lines of Code Saved

| Task | Without Member Expressions | With Member Expressions | Savings |
|------|---------------------------|------------------------|---------|
| String manipulation | ~50 lines (custom functions) | 1 line (`.toUpperCase()`) | 98% less code |
| Array filtering | ~20 lines (custom filter) | 1 line (`.filter()`) | 95% less code |
| JSON parsing | ~500 lines (full parser) | 1 line (`JSON.parse()`) | 99.8% less code |
| Math operations | ~100 lines (math library) | 1 line (`Math.max()`) | 99% less code |

**Total time saved: Weeks → Hours**

## Implementation Effort

**Without member expressions:**
- Implement string functions: ~1 week
- Implement array methods: ~1 week
- Implement JSON parser: ~2 weeks
- Implement math library: ~3 days
- **Total: ~4-5 weeks**

**With member expressions:**
- Add AST node: ~30 min
- Add lexer token: ~15 min
- Add parser rule: ~1 hour
- Add runtime handler: ~1 hour
- Add tests: ~1 hour
- **Total: ~4 hours**

**ROI: ~50x return on investment!**
