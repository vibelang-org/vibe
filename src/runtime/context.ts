import type { RuntimeState, ContextVariable } from './types';

// Build local context - variables from current frame only
// Pure function: takes full state, returns context array
// Note: Model variables are filtered out (they are config, not data for AI context)
export function buildLocalContext(state: RuntimeState): ContextVariable[] {
  const frameIndex = state.callStack.length - 1;
  const frame = state.callStack[frameIndex];
  if (!frame) return [];

  return Object.entries(frame.locals)
    .filter(([, variable]) => variable.typeAnnotation !== 'model')
    .map(([name, variable]) => ({
      name,
      value: variable.value,
      type: variable.typeAnnotation as 'text' | 'json' | null,
      isConst: variable.isConst,
      frameName: frame.name,
      frameDepth: frameIndex, // Depth from entry: 0 = entry, higher = deeper in call stack
    }));
}

// Build global context - variables from all frames in call stack
// Pure function: takes full state, returns context array
// Note: Model variables are filtered out (they are config, not data for AI context)
// Variables are returned with frameDepth: 0 = entry frame, higher = deeper in call stack
export function buildGlobalContext(state: RuntimeState): ContextVariable[] {
  return state.callStack.flatMap((frame, frameIndex) => {
    // frameDepth: 0 = entry (first in stack), higher = deeper calls
    const frameDepth = frameIndex;

    return Object.entries(frame.locals)
      .filter(([, variable]) => variable.typeAnnotation !== 'model')
      .map(([name, variable]) => ({
        name,
        value: variable.value,
        type: variable.typeAnnotation as 'text' | 'json' | null,
        isConst: variable.isConst,
        frameName: frame.name,
        frameDepth,
      }));
  });
}

// Formatted context for AI consumption
export interface FormattedContext {
  text: string;
  variables: ContextVariable[];
}

// Format context for AI calls with instructional wrapping
// Sorts const/model variables first (for input caching), let variables last
export function formatContextForAI(
  context: ContextVariable[],
  options?: { includeInstructions?: boolean }
): FormattedContext {
  const sorted = sortContextVariables(context);
  const text = formatContextText(sorted, options?.includeInstructions ?? true);
  return { text, variables: sorted };
}

// Sort context: const/model first (stable), let last (mutable)
// Preserves original order within each group
function sortContextVariables(context: ContextVariable[]): ContextVariable[] {
  const constVars = context.filter((v) => v.isConst);
  const letVars = context.filter((v) => !v.isConst);
  return [...constVars, ...letVars];
}

// Group variables by frame for structured output
function groupByFrame(variables: ContextVariable[]): Map<string, ContextVariable[]> {
  const groups = new Map<string, ContextVariable[]>();

  for (const v of variables) {
    const key = `${v.frameDepth}:${v.frameName}`;
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, v]);
  }

  return groups;
}

// Format context as text with optional instruction header
// Outputs ALL const variables first (for input caching), then ALL let variables
// Within each section, variables are grouped by call stack frame
function formatContextText(
  variables: ContextVariable[],
  includeInstructions: boolean
): string {
  const lines: string[] = [];

  if (includeInstructions) {
    lines.push('## VIBE Program Context');
    lines.push('Variables from the VIBE language call stack.');
    lines.push('');
  }

  // Split into const and let sections for input caching
  const constVars = variables.filter((v) => v.isConst);
  const letVars = variables.filter((v) => !v.isConst);

  // Output const section first (stable, cacheable)
  if (constVars.length > 0) {
    lines.push('### Constants');
    formatFrameGroups(constVars, lines);
  }

  // Output let section last (mutable, changes between calls)
  if (letVars.length > 0) {
    lines.push('### Variables');
    formatFrameGroups(letVars, lines);
  }

  return lines.join('\n').trimEnd();
}

// Format variables grouped by frame with indentation
// Depth 0 = entry (leftmost), higher depth = deeper in call stack (more indented)
function formatFrameGroups(variables: ContextVariable[], lines: string[]): void {
  const frameGroups = groupByFrame(variables);
  const sortedKeys = [...frameGroups.keys()].sort((a, b) => {
    const depthA = parseInt(a.split(':')[0]);
    const depthB = parseInt(b.split(':')[0]);
    return depthA - depthB; // Lower depth (entry) first
  });

  // Find max depth to identify current scope
  const maxDepth = Math.max(...variables.map((v) => v.frameDepth));

  for (const key of sortedKeys) {
    const frameVars = frameGroups.get(key) ?? [];
    if (frameVars.length === 0) continue;

    const { frameName, frameDepth } = frameVars[0];
    // Label: entry at depth 0, current scope at max depth, otherwise show depth
    const scopeLabel =
      frameDepth === maxDepth
        ? '(current scope)'
        : frameDepth === 0
          ? '(entry)'
          : `(depth ${frameDepth})`;
    // Indent: base indent for section + extra indent per frame depth
    const indent = '  ' + '  '.repeat(frameDepth);
    lines.push(`${indent}${frameName} ${scopeLabel}`);

    for (const v of frameVars) {
      const typeStr = v.type ? ` (${v.type})` : '';
      const valueStr =
        typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value);
      lines.push(`${indent}  - ${v.name}${typeStr}: ${valueStr}`);
    }

    lines.push('');
  }
}
