import * as AST from '../ast';
import { parse } from '../parser/parse';

// Runtime status
export enum RuntimeStatus {
  RUNNING = 'RUNNING',
  AWAITING_AI_RESPONSE = 'AWAITING_AI_RESPONSE',
  AWAITING_USER_INPUT = 'AWAITING_USER_INPUT',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

// Variable entry with mutability flag
interface Variable {
  value: unknown;
  isConst: boolean;
}

// Stack frame for function calls
interface StackFrame {
  name: string;
  locals: Map<string, Variable>;
}

// AI operation history entry
interface AIOperation {
  type: 'do' | 'vibe' | 'ask';
  prompt: string;
  response: unknown;
  timestamp: number;
}

// Runtime state
export interface RuntimeState {
  status: RuntimeStatus;
  callStack: StackFrame[];
  aiHistory: AIOperation[];
  error: Error | null;
}

// AI provider interface
export interface AIProvider {
  execute(prompt: string): Promise<string>;
  generateCode(prompt: string): Promise<string>;
  askUser(prompt: string): Promise<string>;
}

// Control flow exceptions
class ReturnValue {
  constructor(public value: unknown) {}
}

class BreakException {}
class ContinueException {}

export class Runtime {
  private state: RuntimeState;
  private program: AST.Program;
  private functions: Map<string, AST.FunctionDeclaration> = new Map();
  private aiProvider: AIProvider;

  constructor(program: AST.Program, aiProvider: AIProvider) {
    this.program = program;
    this.aiProvider = aiProvider;
    this.state = {
      status: RuntimeStatus.RUNNING,
      callStack: [],
      aiHistory: [],
      error: null,
    };
  }

  getState(): RuntimeState {
    return { ...this.state };
  }

  async run(): Promise<unknown> {
    try {
      // First pass: collect function declarations
      for (const stmt of this.program.body) {
        if (stmt.type === 'FunctionDeclaration') {
          this.functions.set(stmt.name, stmt);
        }
      }

      // Create global frame
      this.pushFrame('main');

      // Execute program body
      let result: unknown = null;
      for (const stmt of this.program.body) {
        result = await this.executeStatement(stmt);
      }

      this.state.status = RuntimeStatus.COMPLETED;
      return result;
    } catch (error) {
      if (error instanceof ReturnValue) {
        this.state.status = RuntimeStatus.COMPLETED;
        return error.value;
      }
      this.state.status = RuntimeStatus.ERROR;
      this.state.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  private pushFrame(name: string): void {
    this.state.callStack.push({
      name,
      locals: new Map(),
    });
  }

  private popFrame(): StackFrame | undefined {
    return this.state.callStack.pop();
  }

  private currentFrame(): StackFrame {
    const frame = this.state.callStack[this.state.callStack.length - 1];
    if (!frame) {
      throw new Error('No active stack frame');
    }
    return frame;
  }

  private declareVariable(name: string, value: unknown, isConst: boolean): void {
    const frame = this.currentFrame();
    if (frame.locals.has(name)) {
      throw new Error(`Variable '${name}' is already declared`);
    }
    frame.locals.set(name, { value, isConst });
  }

  private getVariable(name: string): unknown {
    const frame = this.currentFrame();
    const variable = frame.locals.get(name);
    if (variable) {
      return variable.value;
    }

    // Check if it's a function
    if (this.functions.has(name)) {
      return { __vibeFunction: true, name };
    }

    throw new Error(`Undefined variable '${name}'`);
  }

  private async executeStatement(stmt: AST.Statement): Promise<unknown> {
    switch (stmt.type) {
      case 'LetDeclaration':
        return this.executeLetDeclaration(stmt);

      case 'ConstDeclaration':
        return this.executeConstDeclaration(stmt);

      case 'FunctionDeclaration':
        return null;

      case 'ModelDeclaration':
        // Models are declarative and don't execute anything
        return null;

      case 'ReturnStatement':
        throw new ReturnValue(stmt.value ? await this.evaluateExpression(stmt.value) : null);

      case 'IfStatement':
        return this.executeIfStatement(stmt);

      case 'BreakStatement':
        throw new BreakException();

      case 'ContinueStatement':
        throw new ContinueException();

      case 'BlockStatement':
        return this.executeBlockStatement(stmt);

      case 'ExpressionStatement':
        return this.evaluateExpression(stmt.expression);

      default:
        throw new Error(`Unknown statement type: ${(stmt as AST.Statement).type}`);
    }
  }

  private async executeLetDeclaration(stmt: AST.LetDeclaration): Promise<void> {
    const value = stmt.initializer ? await this.evaluateExpression(stmt.initializer) : null;
    this.declareVariable(stmt.name, value, false);
  }

  private async executeConstDeclaration(stmt: AST.ConstDeclaration): Promise<void> {
    const value = await this.evaluateExpression(stmt.initializer);
    this.declareVariable(stmt.name, value, true);
  }

  private async executeIfStatement(stmt: AST.IfStatement): Promise<unknown> {
    const condition = await this.evaluateExpression(stmt.condition);

    if (this.isTruthy(condition)) {
      return this.executeBlockStatement(stmt.consequent);
    } else if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        return this.executeIfStatement(stmt.alternate);
      } else {
        return this.executeBlockStatement(stmt.alternate);
      }
    }
    return null;
  }

  private async executeBlockStatement(stmt: AST.BlockStatement): Promise<unknown> {
    const frame = this.currentFrame();
    const savedLocals = new Map(frame.locals);

    try {
      let result: unknown = null;
      for (const s of stmt.body) {
        result = await this.executeStatement(s);
      }
      return result;
    } finally {
      // Remove variables declared in this block
      const newVars = [...frame.locals.keys()].filter((k) => !savedLocals.has(k));
      for (const v of newVars) {
        frame.locals.delete(v);
      }
    }
  }

  private async evaluateExpression(expr: AST.Expression): Promise<unknown> {
    switch (expr.type) {
      case 'StringLiteral':
        return this.interpolateString(expr.value);

      case 'Identifier':
        return this.getVariable(expr.name);

      case 'CallExpression':
        return this.evaluateCallExpression(expr);

      case 'DoExpression':
        return this.evaluateDoExpression(expr);

      case 'VibeExpression':
        return this.evaluateVibeExpression(expr);

      case 'AskExpression':
        return this.evaluateAskExpression(expr);

      default:
        throw new Error(`Unknown expression type: ${(expr as AST.Expression).type}`);
    }
  }

  private interpolateString(str: string): string {
    return str.replace(/\{(\w+)\}/g, (_, name) => {
      try {
        const value = this.getVariable(name);
        return String(value);
      } catch {
        return `{${name}}`;
      }
    });
  }

  private async evaluateCallExpression(expr: AST.CallExpression): Promise<unknown> {
    const callee = await this.evaluateExpression(expr.callee);

    if (typeof callee === 'object' && callee !== null && '__vibeFunction' in callee) {
      const funcName = (callee as { __vibeFunction: boolean; name: string }).name;
      const func = this.functions.get(funcName);
      if (!func) {
        throw new Error(`Function '${funcName}' not found`);
      }

      const args: unknown[] = [];
      for (const arg of expr.arguments) {
        args.push(await this.evaluateExpression(arg));
      }

      this.pushFrame(funcName);

      try {
        for (let i = 0; i < func.params.length; i++) {
          this.declareVariable(func.params[i], args[i] ?? null, false);
        }

        await this.executeBlockStatement(func.body);
        return null;
      } catch (e) {
        if (e instanceof ReturnValue) {
          return e.value;
        }
        throw e;
      } finally {
        this.popFrame();
      }
    }

    if (typeof callee === 'function') {
      const args: unknown[] = [];
      for (const arg of expr.arguments) {
        args.push(await this.evaluateExpression(arg));
      }
      return callee(...args);
    }

    throw new Error('Cannot call non-function');
  }

  private async evaluateDoExpression(expr: AST.DoExpression): Promise<unknown> {
    const prompt = String(await this.evaluateExpression(expr.prompt));

    this.state.status = RuntimeStatus.AWAITING_AI_RESPONSE;

    const response = await this.aiProvider.execute(prompt);

    this.state.aiHistory.push({
      type: 'do',
      prompt,
      response,
      timestamp: Date.now(),
    });

    this.state.status = RuntimeStatus.RUNNING;
    return response;
  }

  private async evaluateVibeExpression(expr: AST.VibeExpression): Promise<unknown> {
    const prompt = String(await this.evaluateExpression(expr.prompt));

    this.state.status = RuntimeStatus.AWAITING_AI_RESPONSE;

    const generatedCode = await this.aiProvider.generateCode(prompt);

    this.state.aiHistory.push({
      type: 'vibe',
      prompt,
      response: generatedCode,
      timestamp: Date.now(),
    });

    this.state.status = RuntimeStatus.RUNNING;

    // Parse and execute the generated code
    const ast = parse(generatedCode);

    let result: unknown = null;
    for (const stmt of ast.body) {
      result = await this.executeStatement(stmt);
    }

    return result;
  }

  private async evaluateAskExpression(expr: AST.AskExpression): Promise<unknown> {
    const prompt = String(await this.evaluateExpression(expr.prompt));

    this.state.status = RuntimeStatus.AWAITING_USER_INPUT;

    const response = await this.aiProvider.askUser(prompt);

    this.state.aiHistory.push({
      type: 'ask',
      prompt,
      response,
      timestamp: Date.now(),
    });

    this.state.status = RuntimeStatus.RUNNING;
    return response;
  }

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }
}
