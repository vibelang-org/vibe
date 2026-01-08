// Multi-language Hello World Translator Integration Test
// Tests optional model/context syntax and lastUsedModel feature

import { describe, test, expect } from 'bun:test';
import { Runtime, formatAIInteractions } from '../../../src/runtime';
import { createRealAIProvider } from '../../../src/runtime/ai-provider';
import { parse } from '../../../src/parser/parse';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function runVibe(code: string, logAi = true): Promise<Runtime> {
  const program = parse(code);
  const runtime = new Runtime(
    program,
    createRealAIProvider(() => runtime.getState()),
    { logAiInteractions: logAi }
  );
  await runtime.run();

  if (logAi) {
    const interactions = runtime.getAIInteractions();
    console.log('\n' + formatAIInteractions(interactions));
  }

  return runtime;
}

describe.skipIf(!ANTHROPIC_API_KEY)('Hello World Translator', () => {

  test('translate Hello World to multiple languages', async () => {
    const code = `
import { print, env } from "system"

model translator = {
  name: "claude-haiku-4-5",
  provider: "anthropic",
  apiKey: env("ANTHROPIC_API_KEY")
}

// First call establishes lastUsedModel
let languages: text[] = do "List the major human languages as a JSON array of strings."

// Loop uses lastUsedModel (translator) since no model specified
for language in languages {
  let translated = do "Translate 'Hello World' into {language}. Return only the translation, nothing else."
  print(translated)
}
`;

    const runtime = await runVibe(code);

    // Check that languages array was populated
    const languages = runtime.getValue('languages') as string[];
    expect(Array.isArray(languages)).toBe(true);
    expect(languages.length).toBeGreaterThanOrEqual(1);

    // The loop should have run and printed translations
    expect(runtime.getState().status).toBe('completed');
  }, 60000);


});
