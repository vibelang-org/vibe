import type { CstNode, IToken } from 'chevrotain';
import { vibeParser } from './index';
import * as AST from '../ast';
import type { SourceLocation } from '../errors';

// Get the base visitor class from the parser
const BaseVibeVisitor = vibeParser.getBaseCstVisitorConstructor();

// Helper to get location from a token
function tokenLocation(token: IToken): SourceLocation {
  return {
    line: token.startLine ?? 1,
    column: token.startColumn ?? 1,
  };
}

// Helper to extract string value from a string literal token
function parseStringLiteral(token: IToken): string {
  const raw = token.image;
  // Remove quotes and unescape
  return raw.slice(1, -1).replace(/\\(.)/g, '$1');
}

class VibeAstVisitor extends BaseVibeVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  // ============================================================================
  // Program
  // ============================================================================

  program(ctx: { statement?: CstNode[] }): AST.Program {
    const statements = ctx.statement?.map((s) => this.visit(s)) ?? [];
    return {
      type: 'Program',
      body: statements,
      location: statements[0]?.location ?? { line: 1, column: 1 },
    };
  }

  // ============================================================================
  // Statements
  // ============================================================================

  statement(ctx: Record<string, CstNode[]>): AST.Statement {
    if (ctx.letDeclaration) return this.visit(ctx.letDeclaration);
    if (ctx.constDeclaration) return this.visit(ctx.constDeclaration);
    if (ctx.modelDeclaration) return this.visit(ctx.modelDeclaration);
    if (ctx.functionDeclaration) return this.visit(ctx.functionDeclaration);
    if (ctx.returnStatement) return this.visit(ctx.returnStatement);
    if (ctx.ifStatement) return this.visit(ctx.ifStatement);
    if (ctx.breakStatement) return this.visit(ctx.breakStatement);
    if (ctx.continueStatement) return this.visit(ctx.continueStatement);
    if (ctx.blockStatement) return this.visit(ctx.blockStatement);
    if (ctx.expressionStatement) return this.visit(ctx.expressionStatement);
    throw new Error('Unknown statement type');
  }

  letDeclaration(ctx: { Let: IToken[]; Identifier: IToken[]; TextType?: IToken[]; JsonType?: IToken[]; PromptType?: IToken[]; expression?: CstNode[] }): AST.LetDeclaration {
    const typeAnnotation = ctx.TextType ? 'text' : ctx.JsonType ? 'json' : ctx.PromptType ? 'prompt' : null;
    return {
      type: 'LetDeclaration',
      name: ctx.Identifier[0].image,
      typeAnnotation,
      initializer: ctx.expression ? this.visit(ctx.expression) : null,
      location: tokenLocation(ctx.Let[0]),
    };
  }

  constDeclaration(ctx: { Const: IToken[]; Identifier: IToken[]; TextType?: IToken[]; JsonType?: IToken[]; PromptType?: IToken[]; expression: CstNode[] }): AST.ConstDeclaration {
    const typeAnnotation = ctx.TextType ? 'text' : ctx.JsonType ? 'json' : ctx.PromptType ? 'prompt' : null;
    return {
      type: 'ConstDeclaration',
      name: ctx.Identifier[0].image,
      typeAnnotation,
      initializer: this.visit(ctx.expression),
      location: tokenLocation(ctx.Const[0]),
    };
  }

  modelDeclaration(ctx: { Model: IToken[]; Identifier: IToken[]; objectLiteral: CstNode[] }): AST.ModelDeclaration {
    const { properties, location } = this.visit(ctx.objectLiteral) as { properties: Map<string, { value: AST.Expression; location: SourceLocation }>; location: SourceLocation };

    // Extract required fields (validation happens in semantic analyzer)
    const modelName = properties.get('name')?.value ?? null;
    const apiKey = properties.get('apiKey')?.value ?? null;
    const url = properties.get('url')?.value ?? null;

    // Track which fields were provided for validation
    const providedFields = [...properties.keys()];

    return {
      type: 'ModelDeclaration',
      name: ctx.Identifier[0].image,
      config: {
        type: 'ModelConfig',
        modelName,
        apiKey,
        url,
        providedFields,
        location: location,
      },
      location: tokenLocation(ctx.Model[0]),
    };
  }

  objectLiteral(ctx: { LBrace: IToken[]; propertyList?: CstNode[] }): { properties: Map<string, { value: AST.Expression; location: SourceLocation }>; location: SourceLocation } {
    const properties = new Map<string, { value: AST.Expression; location: SourceLocation }>();
    if (ctx.propertyList) {
      const propList = this.visit(ctx.propertyList) as AST.ObjectProperty[];
      for (const prop of propList) {
        properties.set(prop.key, { value: prop.value, location: prop.location });
      }
    }
    return {
      properties,
      location: tokenLocation(ctx.LBrace[0]),
    };
  }

  propertyList(ctx: { property: CstNode[] }): AST.ObjectProperty[] {
    return ctx.property.map((p) => this.visit(p));
  }

  property(ctx: { Identifier: IToken[]; expression: CstNode[] }): AST.ObjectProperty {
    return {
      type: 'ObjectProperty',
      key: ctx.Identifier[0].image,
      value: this.visit(ctx.expression),
      location: tokenLocation(ctx.Identifier[0]),
    };
  }

  functionDeclaration(ctx: { Function: IToken[]; Identifier: IToken[]; parameterList?: CstNode[]; blockStatement: CstNode[] }): AST.FunctionDeclaration {
    const params = ctx.parameterList ? this.visit(ctx.parameterList) : [];
    return {
      type: 'FunctionDeclaration',
      name: ctx.Identifier[0].image,
      params,
      body: this.visit(ctx.blockStatement),
      location: tokenLocation(ctx.Function[0]),
    };
  }

  parameterList(ctx: { Identifier: IToken[] }): string[] {
    return ctx.Identifier.map((t) => t.image);
  }

  returnStatement(ctx: { Return: IToken[]; expression?: CstNode[] }): AST.ReturnStatement {
    return {
      type: 'ReturnStatement',
      value: ctx.expression ? this.visit(ctx.expression) : null,
      location: tokenLocation(ctx.Return[0]),
    };
  }

  ifStatement(ctx: { If: IToken[]; expression: CstNode[]; blockStatement: CstNode[]; ifStatement?: CstNode[] }): AST.IfStatement {
    let alternate: AST.BlockStatement | AST.IfStatement | null = null;
    if (ctx.ifStatement) {
      alternate = this.visit(ctx.ifStatement);
    } else if (ctx.blockStatement.length > 1) {
      alternate = this.visit(ctx.blockStatement[1]);
    }

    return {
      type: 'IfStatement',
      condition: this.visit(ctx.expression),
      consequent: this.visit(ctx.blockStatement[0]),
      alternate,
      location: tokenLocation(ctx.If[0]),
    };
  }

  breakStatement(ctx: { Break: IToken[] }): AST.BreakStatement {
    return {
      type: 'BreakStatement',
      location: tokenLocation(ctx.Break[0]),
    };
  }

  continueStatement(ctx: { Continue: IToken[] }): AST.ContinueStatement {
    return {
      type: 'ContinueStatement',
      location: tokenLocation(ctx.Continue[0]),
    };
  }

  blockStatement(ctx: { LBrace: IToken[]; statement?: CstNode[] }): AST.BlockStatement {
    return {
      type: 'BlockStatement',
      body: ctx.statement?.map((s) => this.visit(s)) ?? [],
      location: tokenLocation(ctx.LBrace[0]),
    };
  }

  expressionStatement(ctx: { expression: CstNode[] }): AST.ExpressionStatement {
    const expr = this.visit(ctx.expression);
    return {
      type: 'ExpressionStatement',
      expression: expr,
      location: expr.location,
    };
  }

  // ============================================================================
  // Expressions
  // ============================================================================

  expression(ctx: { Do?: IToken[]; Vibe?: IToken[]; Ask?: IToken[]; assignmentExpression?: CstNode[]; callExpression?: CstNode[]; expression?: CstNode[]; contextSpecifier?: CstNode[] }): AST.Expression {
    if (ctx.Do) {
      return {
        type: 'DoExpression',
        prompt: this.visit(ctx.expression![0]),
        model: this.visit(ctx.expression![1]),
        context: this.visit(ctx.contextSpecifier!),
        location: tokenLocation(ctx.Do[0]),
      };
    }

    if (ctx.Vibe) {
      return {
        type: 'VibeExpression',
        prompt: this.visit(ctx.expression!),
        location: tokenLocation(ctx.Vibe[0]),
      };
    }

    if (ctx.Ask) {
      return {
        type: 'AskExpression',
        prompt: this.visit(ctx.expression![0]),
        model: this.visit(ctx.expression![1]),
        context: this.visit(ctx.contextSpecifier!),
        location: tokenLocation(ctx.Ask[0]),
      };
    }

    if (ctx.assignmentExpression) {
      return this.visit(ctx.assignmentExpression);
    }

    return this.visit(ctx.callExpression!);
  }

  assignmentExpression(ctx: { Identifier: IToken[]; expression: CstNode[] }): AST.AssignmentExpression {
    return {
      type: 'AssignmentExpression',
      target: {
        type: 'Identifier',
        name: ctx.Identifier[0].image,
        location: tokenLocation(ctx.Identifier[0]),
      },
      value: this.visit(ctx.expression),
      location: tokenLocation(ctx.Identifier[0]),
    };
  }

  contextSpecifier(ctx: { Default?: IToken[]; Local?: IToken[]; Identifier?: IToken[] }): AST.ContextSpecifier {
    if (ctx.Default) {
      return {
        type: 'ContextSpecifier',
        kind: 'default',
        location: tokenLocation(ctx.Default[0]),
      };
    }
    if (ctx.Local) {
      return {
        type: 'ContextSpecifier',
        kind: 'local',
        location: tokenLocation(ctx.Local[0]),
      };
    }
    return {
      type: 'ContextSpecifier',
      kind: 'variable',
      variable: ctx.Identifier![0].image,
      location: tokenLocation(ctx.Identifier![0]),
    };
  }

  callExpression(ctx: { primaryExpression: CstNode[]; LParen?: IToken[]; argumentList?: CstNode[] }): AST.Expression {
    let expr = this.visit(ctx.primaryExpression);

    // Process call chain
    const callCount = ctx.LParen?.length ?? 0;
    for (let i = 0; i < callCount; i++) {
      const args = ctx.argumentList?.[i] ? this.visit(ctx.argumentList[i]) : [];
      expr = {
        type: 'CallExpression',
        callee: expr,
        arguments: args,
        location: expr.location,
      };
    }

    return expr;
  }

  argumentList(ctx: { expression: CstNode[] }): AST.Expression[] {
    return ctx.expression.map((e) => this.visit(e));
  }

  primaryExpression(ctx: {
    StringLiteral?: IToken[];
    True?: IToken[];
    False?: IToken[];
    Identifier?: IToken[];
    objectLiteralExpr?: CstNode[];
    arrayLiteral?: CstNode[];
    expression?: CstNode[];
  }): AST.Expression {
    if (ctx.StringLiteral) {
      return {
        type: 'StringLiteral',
        value: parseStringLiteral(ctx.StringLiteral[0]),
        location: tokenLocation(ctx.StringLiteral[0]),
      };
    }

    if (ctx.True) {
      return {
        type: 'BooleanLiteral',
        value: true,
        location: tokenLocation(ctx.True[0]),
      };
    }

    if (ctx.False) {
      return {
        type: 'BooleanLiteral',
        value: false,
        location: tokenLocation(ctx.False[0]),
      };
    }

    if (ctx.objectLiteralExpr) {
      return this.visit(ctx.objectLiteralExpr);
    }

    if (ctx.arrayLiteral) {
      return this.visit(ctx.arrayLiteral);
    }

    if (ctx.Identifier) {
      return {
        type: 'Identifier',
        name: ctx.Identifier[0].image,
        location: tokenLocation(ctx.Identifier[0]),
      };
    }

    // Grouped expression
    if (ctx.expression) {
      return this.visit(ctx.expression);
    }

    throw new Error('Unknown primary expression');
  }

  objectLiteralExpr(ctx: { LBrace: IToken[]; propertyList?: CstNode[] }): AST.ObjectLiteral {
    const properties: AST.ObjectProperty[] = ctx.propertyList
      ? this.visit(ctx.propertyList)
      : [];
    return {
      type: 'ObjectLiteral',
      properties,
      location: tokenLocation(ctx.LBrace[0]),
    };
  }

  arrayLiteral(ctx: { LBracket: IToken[]; elementList?: CstNode[] }): AST.ArrayLiteral {
    const elements: AST.Expression[] = ctx.elementList
      ? this.visit(ctx.elementList)
      : [];
    return {
      type: 'ArrayLiteral',
      elements,
      location: tokenLocation(ctx.LBracket[0]),
    };
  }

  elementList(ctx: { expression: CstNode[] }): AST.Expression[] {
    return ctx.expression.map((e) => this.visit(e));
  }
}

// Export a singleton visitor instance
export const vibeAstVisitor = new VibeAstVisitor();
