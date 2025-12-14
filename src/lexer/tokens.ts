import type { SourceLocation } from '../errors';

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',

  // Keywords
  LET = 'LET',
  CONST = 'CONST',
  CONTEXT = 'CONTEXT',
  VIBE = 'VIBE',
  DO = 'DO',
  ASK = 'ASK',
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
  PLUS = 'PLUS',           // +
  MINUS = 'MINUS',         // -
  MULTIPLY = 'MULTIPLY',   // *
  DIVIDE = 'DIVIDE',       // /
  MODULO = 'MODULO',       // %
  ASSIGN = 'ASSIGN',       // =
  EQUALS = 'EQUALS',       // ==
  NOT_EQUALS = 'NOT_EQUALS', // !=
  LESS_THAN = 'LESS_THAN', // <
  GREATER_THAN = 'GREATER_THAN', // >
  LESS_EQUAL = 'LESS_EQUAL',     // <=
  GREATER_EQUAL = 'GREATER_EQUAL', // >=
  AND = 'AND',             // and, &&
  OR = 'OR',               // or, ||
  NOT = 'NOT',             // not, !

  // Delimiters
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]
  COMMA = 'COMMA',         // ,
  DOT = 'DOT',             // .
  COLON = 'COLON',         // :
  SEMICOLON = 'SEMICOLON', // ;

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

export const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.LET,
  const: TokenType.CONST,
  context: TokenType.CONTEXT,
  vibe: TokenType.VIBE,
  do: TokenType.DO,
  ask: TokenType.ASK,
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

// Helper to check if a token is a specific type
export function isToken(token: Token, type: TokenType): boolean {
  return token.type === type;
}

// Helper to check if a token is one of multiple types
export function isOneOf(token: Token, types: TokenType[]): boolean {
  return types.includes(token.type);
}

// Get human-readable token name
export function tokenName(type: TokenType): string {
  const names: Record<TokenType, string> = {
    [TokenType.NUMBER]: 'number',
    [TokenType.STRING]: 'string',
    [TokenType.IDENTIFIER]: 'identifier',
    [TokenType.LET]: "'let'",
    [TokenType.CONST]: "'const'",
    [TokenType.CONTEXT]: "'context'",
    [TokenType.VIBE]: "'vibe'",
    [TokenType.DO]: "'do'",
    [TokenType.ASK]: "'ask'",
    [TokenType.FN]: "'fn'",
    [TokenType.RETURN]: "'return'",
    [TokenType.IF]: "'if'",
    [TokenType.ELSE]: "'else'",
    [TokenType.LOOP]: "'loop'",
    [TokenType.WHILE]: "'while'",
    [TokenType.BREAK]: "'break'",
    [TokenType.CONTINUE]: "'continue'",
    [TokenType.TRUE]: "'true'",
    [TokenType.FALSE]: "'false'",
    [TokenType.NULL]: "'null'",
    [TokenType.PLUS]: "'+'",
    [TokenType.MINUS]: "'-'",
    [TokenType.MULTIPLY]: "'*'",
    [TokenType.DIVIDE]: "'/'",
    [TokenType.MODULO]: "'%'",
    [TokenType.ASSIGN]: "'='",
    [TokenType.EQUALS]: "'=='",
    [TokenType.NOT_EQUALS]: "'!='",
    [TokenType.LESS_THAN]: "'<'",
    [TokenType.GREATER_THAN]: "'>'",
    [TokenType.LESS_EQUAL]: "'<='",
    [TokenType.GREATER_EQUAL]: "'>='",
    [TokenType.AND]: "'and'",
    [TokenType.OR]: "'or'",
    [TokenType.NOT]: "'not'",
    [TokenType.LPAREN]: "'('",
    [TokenType.RPAREN]: "')'",
    [TokenType.LBRACE]: "'{'",
    [TokenType.RBRACE]: "'}'",
    [TokenType.LBRACKET]: "'['",
    [TokenType.RBRACKET]: "']'",
    [TokenType.COMMA]: "','",
    [TokenType.DOT]: "'.'",
    [TokenType.COLON]: "':'",
    [TokenType.SEMICOLON]: "';'",
    [TokenType.EOF]: 'end of file',
  };
  return names[type] ?? type;
}
