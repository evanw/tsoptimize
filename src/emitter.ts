import * as ts from 'typescript';

export const enum Emit {
  Normal,
  Minified,
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
export const enum Level {
  Lowest,
  Comma,
  Spread,
  Yield,
  Assignment,
  Conditional,
  LogicalOr,
  LogicalAnd,
  BitwiseOr,
  BitwiseXor,
  BitwiseAnd,
  Equality,
  Compare,
  Shift,
  Add,
  Multiply,
  Prefix,
  Postfix,
  Call,
  Member,
}

let binaryOperatorLevel: {[kind: number]: Level} = {
  [ts.SyntaxKind.CommaToken]: Level.Comma,

  [ts.SyntaxKind.AmpersandEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.AsteriskEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.BarEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.CaretEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.EqualsToken]: Level.Assignment,
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.MinusEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.PercentEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.PlusEqualsToken]: Level.Assignment,
  [ts.SyntaxKind.SlashEqualsToken]: Level.Assignment,

  [ts.SyntaxKind.BarBarToken]: Level.LogicalOr,
  [ts.SyntaxKind.AmpersandAmpersandToken]: Level.LogicalAnd,
  [ts.SyntaxKind.BarToken]: Level.BitwiseOr,
  [ts.SyntaxKind.CaretToken]: Level.BitwiseXor,
  [ts.SyntaxKind.AmpersandToken]: Level.BitwiseAnd,

  [ts.SyntaxKind.EqualsEqualsToken]: Level.Equality,
  [ts.SyntaxKind.ExclamationEqualsToken]: Level.Equality,
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: Level.Equality,
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: Level.Equality,

  [ts.SyntaxKind.LessThanToken]: Level.Compare,
  [ts.SyntaxKind.GreaterThanToken]: Level.Compare,
  [ts.SyntaxKind.LessThanEqualsToken]: Level.Compare,
  [ts.SyntaxKind.GreaterThanEqualsToken]: Level.Compare,

  [ts.SyntaxKind.LessThanLessThanToken]: Level.Shift,
  [ts.SyntaxKind.GreaterThanGreaterThanToken]: Level.Shift,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: Level.Shift,

  [ts.SyntaxKind.PlusToken]: Level.Add,
  [ts.SyntaxKind.MinusToken]: Level.Add,

  [ts.SyntaxKind.SlashToken]: Level.Multiply,
  [ts.SyntaxKind.PercentToken]: Level.Multiply,
  [ts.SyntaxKind.AsteriskToken]: Level.Multiply,
  [ts.SyntaxKind.AsteriskAsteriskToken]: Level.Multiply,
};

let isRightAssociative: {[kind: number]: boolean} = {
  [ts.SyntaxKind.AsteriskAsteriskToken]: true,

  [ts.SyntaxKind.AmpersandEqualsToken]: true,
  [ts.SyntaxKind.AsteriskAsteriskEqualsToken]: true,
  [ts.SyntaxKind.AsteriskEqualsToken]: true,
  [ts.SyntaxKind.BarEqualsToken]: true,
  [ts.SyntaxKind.CaretEqualsToken]: true,
  [ts.SyntaxKind.EqualsToken]: true,
  [ts.SyntaxKind.GreaterThanGreaterThanEqualsToken]: true,
  [ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: true,
  [ts.SyntaxKind.LessThanLessThanEqualsToken]: true,
  [ts.SyntaxKind.MinusEqualsToken]: true,
  [ts.SyntaxKind.PercentEqualsToken]: true,
  [ts.SyntaxKind.PlusEqualsToken]: true,
  [ts.SyntaxKind.SlashEqualsToken]: true,
};

function wrapToAvoidAmbiguousElse(node: ts.Statement): boolean {
  while (true) {
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement: {
        let elseStatement = (node as ts.IfStatement).elseStatement;
        if (!elseStatement) return true;
        node = elseStatement;
        break;
      }

      case ts.SyntaxKind.ForStatement: node = (node as ts.ForStatement).statement; break;
      case ts.SyntaxKind.ForInStatement: node = (node as ts.ForInStatement).statement; break;
      case ts.SyntaxKind.ForOfStatement: node = (node as ts.ForOfStatement).statement; break;
      case ts.SyntaxKind.WhileStatement: node = (node as ts.WhileStatement).statement; break;
      case ts.SyntaxKind.WithStatement: node = (node as ts.WithStatement).statement; break;

      default: return false;
    }
  }
}

export function emit(program: ts.Program, mode: Emit): string {
  let minify = mode == Emit.Minified;
  let needsSemicolon = false;
  let newline = minify ? '' : '\n';
  let space = minify ? '' : ' ';
  let indent = '';
  let out = '';

  function increaseIndent(): void {
    if (!minify) indent += '  ';
  }

  function decreaseIndent(): void {
    if (!minify) indent = indent.slice(2);
  }

  function emitSemicolonIfNeeded(): void {
    if (needsSemicolon) {
      needsSemicolon = false;
      out += ';';
    }
  }

  function emitSpaceBeforeIdentifier(): void {
    if (out && /^\w$/.test(out[out.length - 1])) {
      out += ' ';
    }
  }

  function emitSemicolonAfterStatement(): void {
    if (minify) needsSemicolon = true;
    else out += ';\n';
  }

  function emitBlockInsideStatement(node: ts.Statement): void {
    if (node.kind == ts.SyntaxKind.Block) {
      out += space;
      emitBlock(node as ts.Block);
      out += newline;
    }

    else {
      out += newline;
      increaseIndent();
      emit(node, Level.Lowest);
      decreaseIndent();
    }
  }

  function emitBlock(block: ts.Block): void {
    out += '{' + newline;
    increaseIndent();
    for (let statement of block.statements) {
      emitSemicolonIfNeeded();
      emit(statement, Level.Lowest);
    }
    decreaseIndent();
    out += indent + '}';
    needsSemicolon = false;
  }

  function emitCommaSeparated(nodes: ts.Node[]): void {
    let isFirst = true;
    for (let node of nodes) {
      if (isFirst) isFirst = false;
      else out += ',' + space;
      emit(node, Level.Comma);
    }
  }

  function emitVariableDeclarations(declarations: ts.VariableDeclaration[]): void {
    let isFirst = true;
    emitSpaceBeforeIdentifier();
    out += 'var' + space;
    for (let declaration of declarations) {
      if (isFirst) isFirst = false;
      else out += ',' + space;
      emit(declaration.name, Level.Lowest);
      if (declaration.initializer) {
        out += space + '=' + space;
        emit(declaration.initializer, Level.Comma);
      }
    }
  }

  function emit(node: ts.Node, level: Level): void {
    switch (node.kind) {
      case ts.SyntaxKind.ComputedPropertyName: {
        let expression = (node as ts.ComputedPropertyName).expression;
        out += '[';
        emit(expression, Level.Lowest);
        out += ']';
        break;
      }

      case ts.SyntaxKind.PropertyAssignment: {
        let name = (node as ts.PropertyAssignment).name;
        let initializer = (node as ts.PropertyAssignment).initializer;
        emit(name, Level.Comma);
        out += ':' + space;
        emit(initializer, Level.Comma);
        break;
      }

      case ts.SyntaxKind.SourceFile: {
        let statements = (node as ts.SourceFile).statements;
        for (let statement of statements) {
          emitSemicolonIfNeeded();
          emit(statement, Level.Lowest);
        }
        break;
      }

      ////////////////////////////////////////////////////////////////////////////////
      // Statements

      case ts.SyntaxKind.Block: {
        out += indent;
        emitBlock(node as ts.Block);
        out += newline;
        break;
      }

      case ts.SyntaxKind.BreakStatement: {
        let label = (node as ts.BreakStatement).label;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'break';
        if (label) emit(label, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.DebuggerStatement: {
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'debugger';
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.ContinueStatement: {
        let label = (node as ts.ContinueStatement).label;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'continue';
        if (label) emit(label, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.DoStatement: {
        let statement = (node as ts.DoStatement).statement;
        let expression = (node as ts.DoStatement).expression;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'do';
        emitBlockInsideStatement(statement);
        emitSemicolonIfNeeded();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'while' + space + '(';
        emit(expression, Level.Lowest);
        out += ')';
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.EmptyStatement: {
        out += indent + ';' + newline;
        break;
      }

      case ts.SyntaxKind.ExpressionStatement: {
        let expression = (node as ts.ExpressionStatement).expression;
        out += indent;
        emit(expression, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.ForStatement: {
        let initializer = (node as ts.ForStatement).initializer;
        let condition = (node as ts.ForStatement).condition;
        let incrementor = (node as ts.ForStatement).incrementor;
        let statement = (node as ts.ForStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (initializer) {
          if (initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
            emitVariableDeclarations((initializer as ts.VariableDeclarationList).declarations);
          } else {
            emit(initializer, Level.Lowest);
          }
        }
        out += ';';
        if (condition) {
          out += space;
          emit(condition, Level.Lowest);
        }
        out += ';';
        if (incrementor) {
          out += space;
          emit(incrementor, Level.Lowest);
        }
        out += ')';
        emitBlockInsideStatement(statement);
        break;
      }

      case ts.SyntaxKind.ForInStatement: {
        let initializer = (node as ts.ForInStatement).initializer;
        let expression = (node as ts.ForInStatement).expression;
        let statement = (node as ts.ForInStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
          emitVariableDeclarations((initializer as ts.VariableDeclarationList).declarations);
        } else {
          emit(initializer, Level.Lowest);
        }
        emitSpaceBeforeIdentifier();
        out += 'in' + space;
        emit(expression, Level.Lowest);
        out += ')';
        emitBlockInsideStatement(statement);
        break;
      }

      case ts.SyntaxKind.ForOfStatement: {
        let initializer = (node as ts.ForOfStatement).initializer;
        let expression = (node as ts.ForOfStatement).expression;
        let statement = (node as ts.ForOfStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (initializer.kind == ts.SyntaxKind.VariableDeclarationList) {
          emitVariableDeclarations((initializer as ts.VariableDeclarationList).declarations);
        } else {
          emit(initializer, Level.Lowest);
        }
        emitSpaceBeforeIdentifier();
        out += 'of' + space;
        emit(expression, Level.Lowest);
        out += ')';
        emitBlockInsideStatement(statement);
        break;
      }

      case ts.SyntaxKind.FunctionDeclaration: {
        if (node.modifiers && node.modifiers.flags & ts.NodeFlags.Ambient) {
          return;
        }

        let name = (node as ts.FunctionDeclaration).name;
        let parameters = (node as ts.FunctionDeclaration).parameters;
        let body = (node as ts.FunctionDeclaration).body;
        let isFirst = true;
        if (body) {
          out += indent;
          emitSpaceBeforeIdentifier();
          out += 'function ';
          emit(name, Level.Lowest);
          out += '(';
          for (let parameter of parameters) {
            if (isFirst) isFirst = false;
            else out += ',' + space;
            emit(parameter.name, Level.Lowest);
          }
          out += ')' + space;
          emitBlock(body);
          out += newline;
        }
        break;
      }

      case ts.SyntaxKind.IfStatement: {
        out += indent;

        while (true) {
          let expression = (node as ts.IfStatement).expression;
          let thenStatement = (node as ts.IfStatement).thenStatement;
          let elseStatement = (node as ts.IfStatement).elseStatement;

          emitSpaceBeforeIdentifier();
          out += 'if' + space + '(';
          emit(expression, Level.Lowest);
          out += ')';

          if (!elseStatement) {
            emitBlockInsideStatement(thenStatement);
            break;
          }

          if (wrapToAvoidAmbiguousElse(thenStatement)) {
            out += space + '{' + newline;
            increaseIndent();
            emit(thenStatement, Level.Lowest);
            decreaseIndent();
            out += indent + '}' + newline;
            needsSemicolon = false;
          }

          else {
            emitBlockInsideStatement(thenStatement);
            emitSemicolonIfNeeded();
          }

          out += indent;
          emitSpaceBeforeIdentifier();
          out += 'else';

          if (elseStatement.kind != ts.SyntaxKind.IfStatement) {
            emitBlockInsideStatement(elseStatement);
            break;
          }

          node = elseStatement;
        }
        break;
      }

      case ts.SyntaxKind.InterfaceDeclaration: {
        break;
      }

      case ts.SyntaxKind.LabeledStatement: {
        let label = (node as ts.LabeledStatement).label;
        let statement = (node as ts.LabeledStatement).statement;
        if (indent) {
          decreaseIndent();
          out += indent;
          increaseIndent();
        }
        emit(label, Level.Lowest);
        out += ':' + newline;
        emit(statement, Level.Lowest);
        break;
      }

      case ts.SyntaxKind.ReturnStatement: {
        let expression = (node as ts.ReturnStatement).expression;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'return';
        if (expression) {
          out += space;
          emit(expression, Level.Lowest);
        }
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.ThrowStatement: {
        let expression = (node as ts.ThrowStatement).expression;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'throw' + space;
        emit(expression, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.TypeAliasDeclaration: {
        break;
      }

      case ts.SyntaxKind.VariableStatement: {
        if (node.modifiers && node.modifiers.flags & ts.NodeFlags.Ambient) {
          return;
        }

        let declarations = (node as ts.VariableStatement).declarationList.declarations;
        out += indent;
        emitVariableDeclarations(declarations);
        emitSemicolonAfterStatement();
        break;
      }

      case ts.SyntaxKind.WhileStatement: {
        let expression = (node as ts.WhileStatement).expression;
        let statement = (node as ts.WhileStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'while' + space + '(';
        emit(expression, Level.Lowest);
        out += ')';
        emitBlockInsideStatement(statement);
        break;
      }

      case ts.SyntaxKind.WithStatement: {
        let expression = (node as ts.WithStatement).expression;
        let statement = (node as ts.WithStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'with' + space + '(';
        emit(expression, Level.Lowest);
        out += ')';
        emitBlockInsideStatement(statement);
        break;
      }

      ////////////////////////////////////////////////////////////////////////////////
      // Expressions

      case ts.SyntaxKind.ArrayLiteralExpression: {
        let elements = (node as ts.ArrayLiteralExpression).elements;
        out += '[';
        emitCommaSeparated(elements);
        out += ']';
        break;
      }

      case ts.SyntaxKind.AsExpression: {
        emit((node as ts.AsExpression).expression, level);
        break;
      }

      case ts.SyntaxKind.BinaryExpression: {
        let operatorToken = (node as ts.BinaryExpression).operatorToken;
        let left = (node as ts.BinaryExpression).left;
        let right = (node as ts.BinaryExpression).right;
        let operatorLevel = binaryOperatorLevel[operatorToken.kind];
        if (operatorLevel === undefined) {
          throw new Error(`Unexpected binary expression kind '${ts.SyntaxKind[operatorToken.kind]}'`);
        }
        let biasRight = operatorToken.kind in isRightAssociative;
        let wrap = level >= operatorLevel;
        if (wrap) out += '(';
        emit(left, operatorLevel - +!biasRight);
        if (operatorLevel !== Level.Comma) out += space;
        out += ts.tokenToString(operatorToken.kind);
        out += space;
        emit(right, operatorLevel - +biasRight);
        if (wrap) out += ')';
        break;
      }

      case ts.SyntaxKind.CallExpression: {
        let expression = (node as ts.CallExpression).expression;
        let args = (node as ts.CallExpression).arguments;
        emit(expression, Level.Postfix);
        out += '(';
        emitCommaSeparated(args);
        out += ')';
        break;
      }

      case ts.SyntaxKind.ConditionalExpression: {
        let condition = (node as ts.ConditionalExpression).condition;
        let whenTrue = (node as ts.ConditionalExpression).whenTrue;
        let whenFalse = (node as ts.ConditionalExpression).whenFalse;
        let wrap = level >= Level.Conditional;
        if (wrap) out += '(';
        emit(condition, Level.Conditional);
        out += space + '?' + space;
        emit(whenTrue, Level.Conditional - 1);
        out += space + ':' + space;
        emit(whenFalse, Level.Conditional - 1);
        if (wrap) out += ')';
        break;
      }

      case ts.SyntaxKind.DeleteExpression: {
        let expression = (node as ts.DeleteExpression).expression;
        emitSpaceBeforeIdentifier();
        out += 'delete';
        emit(expression, Level.Prefix);
        break;
      }

      case ts.SyntaxKind.ElementAccessExpression: {
        let expression = (node as ts.ElementAccessExpression).expression;
        let argumentExpression = (node as ts.ElementAccessExpression).argumentExpression;
        emit(expression, Level.Member);
        out += '[';
        emit(argumentExpression, Level.Lowest);
        out += ']';
        break;
      }

      case ts.SyntaxKind.FalseKeyword: {
        emitSpaceBeforeIdentifier();
        out += 'false';
        break;
      }

      case ts.SyntaxKind.Identifier: {
        let text = (node as ts.Identifier).text;
        emitSpaceBeforeIdentifier();
        out += text;
        break;
      }

      case ts.SyntaxKind.NewExpression: {
        let expression = (node as ts.NewExpression).expression;
        let args = (node as ts.NewExpression).arguments;
        let wrap = expression.kind == ts.SyntaxKind.CallExpression;
        emitSpaceBeforeIdentifier();
        out += 'new' + space;
        if (wrap) out += '(';
        emit(expression, Level.Postfix);
        if (wrap) out += ')';
        out += '(';
        emitCommaSeparated(args);
        out += ')';
        break;
      }

      case ts.SyntaxKind.NullKeyword: {
        emitSpaceBeforeIdentifier();
        out += 'null';
        break;
      }

      case ts.SyntaxKind.NumericLiteral: {
        let text = (node as ts.LiteralExpression).text;
        out += text;
        break;
      }

      case ts.SyntaxKind.ObjectLiteralExpression: {
        let properties = (node as ts.ObjectLiteralExpression).properties;
        out += '{';
        emitCommaSeparated(properties);
        out += '}';
        break;
      }

      case ts.SyntaxKind.OmittedExpression: {
        break;
      }

      case ts.SyntaxKind.ParenthesizedExpression: {
        emit((node as ts.ParenthesizedExpression).expression, level);
        break;
      }

      case ts.SyntaxKind.PrefixUnaryExpression: {
        let operator = (node as ts.PrefixUnaryExpression).operator;
        let operand = (node as ts.PrefixUnaryExpression).operand;
        out += ts.tokenToString(operator);
        emit(operand, Level.Prefix);
        break;
      }

      case ts.SyntaxKind.PropertyAccessExpression: {
        let expression = (node as ts.PropertyAccessExpression).expression;
        let name = (node as ts.PropertyAccessExpression).name;
        emit(expression, Level.Member);
        out += '.';
        emit(name, Level.Lowest);
        break;
      }

      case ts.SyntaxKind.PostfixUnaryExpression: {
        let operand = (node as ts.PostfixUnaryExpression).operand;
        let operator = (node as ts.PostfixUnaryExpression).operator;
        emit(operand, Level.Postfix);
        out += ts.tokenToString(operator);
        break;
      }

      case ts.SyntaxKind.StringLiteral: {
        let text = (node as ts.StringLiteral).text;
        out += JSON.stringify(text);
        break;
      }

      case ts.SyntaxKind.ThisKeyword: {
        emitSpaceBeforeIdentifier();
        out += 'this';
        break;
      }

      case ts.SyntaxKind.TrueKeyword: {
        emitSpaceBeforeIdentifier();
        out += 'true';
        break;
      }

      case ts.SyntaxKind.TypeOfExpression: {
        let expression = (node as ts.TypeOfExpression).expression;
        emitSpaceBeforeIdentifier();
        out += 'typeof';
        emit(expression, Level.Prefix);
        break;
      }

      case ts.SyntaxKind.VoidExpression: {
        let expression = (node as ts.VoidExpression).expression;
        emitSpaceBeforeIdentifier();
        out += 'void';
        emit(expression, Level.Prefix);
        break;
      }

      default: {
        console.warn(`Unexpected node kind '${ts.SyntaxKind[node.kind]}'`);
        break;
      }
    }
  }

  for (let sourceFile of program.getSourceFiles()) {
    emit(sourceFile, Level.Lowest);
  }

  if (out) {
    emitSemicolonIfNeeded();
    out += '\n';
  }

  return out;
}
