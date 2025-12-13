export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',
  BOOLEAN = 'BOOLEAN',

  // Keywords
  LET = 'LET',
  CONST = 'CONST',
  CONTEXT = 'CONTEXT',
  VIBE = 'VIBE',
  DO = 'DO',
  FN = 'FN',
  RETURN = 'RETURN',
  IF = 'IF',
  ELSE = 'ELSE',
  LOOP = 'LOOP',
  WHILE = 'WHILE',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  MODULO = 'MODULO',
  ASSIGN = 'ASSIGN',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  LESS_THAN = 'LESS_THAN',
  GREATER_THAN = 'GREATER_THAN',
  LESS_EQUAL = 'LESS_EQUAL',
  GREATER_EQUAL = 'GREATER_EQUAL',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  DOT = 'DOT',
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',

  // Special
  EOF = 'EOF',
  NEWLINE = 'NEWLINE',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.LET,
  const: TokenType.CONST,
  context: TokenType.CONTEXT,
  vibe: TokenType.VIBE,
  do: TokenType.DO,
  fn: TokenType.FN,
  return: TokenType.RETURN,
  if: TokenType.IF,
  else: TokenType.ELSE,
  loop: TokenType.LOOP,
  while: TokenType.WHILE,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  null: TokenType.NULL,
  and: TokenType.AND,
  or: TokenType.OR,
  not: TokenType.NOT,
};
