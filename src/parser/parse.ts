import { tokenize } from '../lexer';
import { vibeParser } from './index';
import { vibeAstVisitor } from './visitor';
import { ParserError } from '../errors';
import type { Program } from '../ast';

/**
 * Parse a Vibe source code string into an AST
 */
export function parse(source: string): Program {
  // Tokenize
  const tokens = tokenize(source);

  // Parse to CST
  vibeParser.input = tokens;
  const cst = vibeParser.program();

  // Check for parse errors
  if (vibeParser.errors.length > 0) {
    const error = vibeParser.errors[0];
    throw new ParserError(
      error.message,
      error.token.image,
      { line: error.token.startLine ?? 1, column: error.token.startColumn ?? 1 },
      source
    );
  }

  // Transform CST to AST
  const ast = vibeAstVisitor.visit(cst);

  return ast;
}
