// Frame management: push and pop stack frames

import type * as AST from '../../ast';
import type { RuntimeState } from '../types';
import { createFrame } from '../state';

/**
 * Push a new frame onto the call stack.
 */
export function execPushFrame(state: RuntimeState, name: string): RuntimeState {
  return {
    ...state,
    callStack: [...state.callStack, createFrame(name)],
  };
}

/**
 * Pop the current frame from the call stack.
 *
 * Context mode determines what happens to the function's context on return:
 * - undefined/verbose: Current behavior - frame is popped (TODO: merge entries to parent)
 * - forget: Frame is popped, entries are not merged to parent
 *
 * Note: Full context mode support for functions is not yet implemented.
 * Currently both modes just pop the frame without merging.
 */
export function execPopFrame(state: RuntimeState, _contextMode?: AST.ContextMode): RuntimeState {
  // TODO: Implement verbose mode to merge function entries to parent frame
  // For now, just pop the frame (current behavior)
  return {
    ...state,
    callStack: state.callStack.slice(0, -1),
  };
}
