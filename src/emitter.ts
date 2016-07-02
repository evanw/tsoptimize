import * as ts from 'typescript';
import * as mangler from './mangler';

let NodeFlags = ts.NodeFlags;
let SyntaxKind = ts.SyntaxKind;
type SyntaxKind = ts.SyntaxKind;

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
  [SyntaxKind.CommaToken]: Level.Comma,

  [SyntaxKind.AmpersandEqualsToken]: Level.Assignment,
  [SyntaxKind.AsteriskAsteriskEqualsToken]: Level.Assignment,
  [SyntaxKind.AsteriskEqualsToken]: Level.Assignment,
  [SyntaxKind.BarEqualsToken]: Level.Assignment,
  [SyntaxKind.CaretEqualsToken]: Level.Assignment,
  [SyntaxKind.EqualsToken]: Level.Assignment,
  [SyntaxKind.GreaterThanGreaterThanEqualsToken]: Level.Assignment,
  [SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: Level.Assignment,
  [SyntaxKind.LessThanLessThanEqualsToken]: Level.Assignment,
  [SyntaxKind.MinusEqualsToken]: Level.Assignment,
  [SyntaxKind.PercentEqualsToken]: Level.Assignment,
  [SyntaxKind.PlusEqualsToken]: Level.Assignment,
  [SyntaxKind.SlashEqualsToken]: Level.Assignment,

  [SyntaxKind.BarBarToken]: Level.LogicalOr,
  [SyntaxKind.AmpersandAmpersandToken]: Level.LogicalAnd,
  [SyntaxKind.BarToken]: Level.BitwiseOr,
  [SyntaxKind.CaretToken]: Level.BitwiseXor,
  [SyntaxKind.AmpersandToken]: Level.BitwiseAnd,

  [SyntaxKind.EqualsEqualsToken]: Level.Equality,
  [SyntaxKind.ExclamationEqualsToken]: Level.Equality,
  [SyntaxKind.EqualsEqualsEqualsToken]: Level.Equality,
  [SyntaxKind.ExclamationEqualsEqualsToken]: Level.Equality,

  [SyntaxKind.LessThanToken]: Level.Compare,
  [SyntaxKind.GreaterThanToken]: Level.Compare,
  [SyntaxKind.LessThanEqualsToken]: Level.Compare,
  [SyntaxKind.GreaterThanEqualsToken]: Level.Compare,

  [SyntaxKind.LessThanLessThanToken]: Level.Shift,
  [SyntaxKind.GreaterThanGreaterThanToken]: Level.Shift,
  [SyntaxKind.GreaterThanGreaterThanGreaterThanToken]: Level.Shift,

  [SyntaxKind.PlusToken]: Level.Add,
  [SyntaxKind.MinusToken]: Level.Add,

  [SyntaxKind.SlashToken]: Level.Multiply,
  [SyntaxKind.PercentToken]: Level.Multiply,
  [SyntaxKind.AsteriskToken]: Level.Multiply,
  [SyntaxKind.AsteriskAsteriskToken]: Level.Multiply,
};

let isRightAssociative: {[kind: number]: boolean} = {
  [SyntaxKind.AsteriskAsteriskToken]: true,

  [SyntaxKind.AmpersandEqualsToken]: true,
  [SyntaxKind.AsteriskAsteriskEqualsToken]: true,
  [SyntaxKind.AsteriskEqualsToken]: true,
  [SyntaxKind.BarEqualsToken]: true,
  [SyntaxKind.CaretEqualsToken]: true,
  [SyntaxKind.EqualsToken]: true,
  [SyntaxKind.GreaterThanGreaterThanEqualsToken]: true,
  [SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken]: true,
  [SyntaxKind.LessThanLessThanEqualsToken]: true,
  [SyntaxKind.MinusEqualsToken]: true,
  [SyntaxKind.PercentEqualsToken]: true,
  [SyntaxKind.PlusEqualsToken]: true,
  [SyntaxKind.SlashEqualsToken]: true,
};

function wrapToAvoidAmbiguousElse(node: ts.Statement): boolean {
  while (true) {
    switch (node.kind) {
      case SyntaxKind.IfStatement: {
        let elseStatement = (node as ts.IfStatement).elseStatement;
        if (!elseStatement) return true;
        node = elseStatement;
        break;
      }

      case SyntaxKind.ForStatement: node = (node as ts.ForStatement).statement; break;
      case SyntaxKind.ForInStatement: node = (node as ts.ForInStatement).statement; break;
      case SyntaxKind.ForOfStatement: node = (node as ts.ForOfStatement).statement; break;
      case SyntaxKind.WhileStatement: node = (node as ts.WhileStatement).statement; break;
      case SyntaxKind.WithStatement: node = (node as ts.WithStatement).statement; break;

      default: return false;
    }
  }
}

let templateEscapes: {[c: string]: string} = {
  '\\': '\\\\',
  '\0': '\\0',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
  '\v': '\\v',
  '`': '\\`',
  '$': '\\$',
};

function escapeTemplateText(text: string): string {
  return text.replace(/[\0\\`$\f\v\r\n\u2028\u2029]/g, c => templateEscapes[c]);
}

function reduceNumber(text: string): string {
  return text.replace(/^(-?)0\./, '$1.').replace('+', '');
}

export function emit(program: ts.Program, mode: Emit): string {
  let previousOperator = SyntaxKind.NullKeyword;
  let previousOperatorLength = 0;
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

  // "+ + y" => "+ +y"
  // "+ ++ y" => "+ ++y"
  // "x + + y" => "x+ +y"
  // "x ++ + y" => "x+++y"
  // "x + ++ y" => "x+ ++y"
  // "< ! --" => "<! --"
  function emitSpaceBeforeOperator(operator: SyntaxKind): void {
    if (out.length === previousOperatorLength && (
      previousOperator == SyntaxKind.PlusToken && (operator == SyntaxKind.PlusToken || operator == SyntaxKind.PlusPlusToken) ||
      previousOperator == SyntaxKind.MinusToken && (operator == SyntaxKind.MinusToken || operator == SyntaxKind.MinusMinusToken) ||
      previousOperator == SyntaxKind.ExclamationToken && operator == SyntaxKind.MinusMinusToken && out.slice(-2) === '<!'
    )) {
      out += ' ';
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
    if (node.kind == SyntaxKind.Block) {
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

  function emitVariableDeclarations(declarationList: ts.VariableDeclarationList): void {
    let isFirst = true;
    emitSpaceBeforeIdentifier();

    out += (
      declarationList.flags & NodeFlags.Const ? 'const' :
      declarationList.flags & NodeFlags.Let ? 'let' :
      'var') + space;

    for (let declaration of declarationList.declarations) {
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
    if (node.modifiers && node.modifiers.flags & NodeFlags.Ambient) {
      return;
    }

    switch (node.kind) {
      case SyntaxKind.ArrayBindingPattern: {
        let elements = (node as ts.ArrayBindingPattern).elements;
        out += '[';
        emitCommaSeparated(elements);
        out += ']';
        break;
      }

      case SyntaxKind.BindingElement: {
        let name = (node as ts.BindingElement).name;
        let initializer = (node as ts.BindingElement).initializer;
        let dotDotDotToken = (node as ts.BindingElement).dotDotDotToken;
        let propertyName = (node as ts.BindingElement).propertyName;
        if (dotDotDotToken) out += '...';
        emit(name, Level.Lowest);
        if (propertyName) {
          out += ':' + space;
          emit(propertyName, Level.Lowest);
        }
        if (initializer) {
          out += space + '=' + space;
          emit(initializer, Level.Lowest);
        }
        break;
      }

      case SyntaxKind.ComputedPropertyName: {
        let expression = (node as ts.ComputedPropertyName).expression;
        out += '[';
        emit(expression, Level.Lowest);
        out += ']';
        break;
      }

      case SyntaxKind.ObjectBindingPattern: {
        let elements = (node as ts.ObjectBindingPattern).elements;
        out += '{';
        emitCommaSeparated(elements);
        out += '}';
        break;
      }

      case SyntaxKind.Parameter: {
        emit((node as ts.ParameterDeclaration).name, Level.Lowest);
        break;
      }

      case SyntaxKind.PropertyAssignment: {
        let name = (node as ts.PropertyAssignment).name;
        let initializer = (node as ts.PropertyAssignment).initializer;
        emit(name, Level.Comma);
        out += ':' + space;
        emit(initializer, Level.Comma);
        break;
      }

      case SyntaxKind.SourceFile: {
        let statements = (node as ts.SourceFile).statements;
        for (let statement of statements) {
          emitSemicolonIfNeeded();
          emit(statement, Level.Lowest);
        }
        break;
      }

      ////////////////////////////////////////////////////////////////////////////////
      // Statements

      case SyntaxKind.Block: {
        out += indent;
        emitBlock(node as ts.Block);
        out += newline;
        break;
      }

      case SyntaxKind.BreakStatement: {
        let label = (node as ts.BreakStatement).label;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'break';
        if (label) emit(label, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case SyntaxKind.DebuggerStatement: {
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'debugger';
        emitSemicolonAfterStatement();
        break;
      }

      case SyntaxKind.ContinueStatement: {
        let label = (node as ts.ContinueStatement).label;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'continue';
        if (label) emit(label, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case SyntaxKind.DoStatement: {
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

      case SyntaxKind.EmptyStatement: {
        out += indent + ';' + newline;
        break;
      }

      case SyntaxKind.ExpressionStatement: {
        let expression = (node as ts.ExpressionStatement).expression;
        out += indent;
        emit(expression, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case SyntaxKind.ForStatement: {
        let initializer = (node as ts.ForStatement).initializer;
        let condition = (node as ts.ForStatement).condition;
        let incrementor = (node as ts.ForStatement).incrementor;
        let statement = (node as ts.ForStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (initializer) {
          if (initializer.kind == SyntaxKind.VariableDeclarationList) {
            emitVariableDeclarations(initializer as ts.VariableDeclarationList);
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

      case SyntaxKind.ForInStatement: {
        let initializer = (node as ts.ForInStatement).initializer;
        let expression = (node as ts.ForInStatement).expression;
        let statement = (node as ts.ForInStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (initializer.kind == SyntaxKind.VariableDeclarationList) {
          emitVariableDeclarations(initializer as ts.VariableDeclarationList);
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

      case SyntaxKind.ForOfStatement: {
        let initializer = (node as ts.ForOfStatement).initializer;
        let expression = (node as ts.ForOfStatement).expression;
        let statement = (node as ts.ForOfStatement).statement;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (initializer.kind == SyntaxKind.VariableDeclarationList) {
          emitVariableDeclarations(initializer as ts.VariableDeclarationList);
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

      case SyntaxKind.FunctionDeclaration: {
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
          emitCommaSeparated(parameters);
          out += ')' + space;
          emitBlock(body);
          out += newline;
        }
        break;
      }

      case SyntaxKind.IfStatement: {
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

          if (elseStatement.kind != SyntaxKind.IfStatement) {
            emitBlockInsideStatement(elseStatement);
            break;
          }

          node = elseStatement;
        }
        break;
      }

      case SyntaxKind.InterfaceDeclaration: {
        break;
      }

      case SyntaxKind.LabeledStatement: {
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

      case SyntaxKind.ReturnStatement: {
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

      case SyntaxKind.ThrowStatement: {
        let expression = (node as ts.ThrowStatement).expression;
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'throw' + space;
        emit(expression, Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case SyntaxKind.TypeAliasDeclaration: {
        break;
      }

      case SyntaxKind.VariableStatement: {
        out += indent;
        emitVariableDeclarations((node as ts.VariableStatement).declarationList);
        emitSemicolonAfterStatement();
        break;
      }

      case SyntaxKind.WhileStatement: {
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

      case SyntaxKind.WithStatement: {
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

      case SyntaxKind.ArrayLiteralExpression: {
        let elements = (node as ts.ArrayLiteralExpression).elements;
        out += '[';
        emitCommaSeparated(elements);
        out += ']';
        break;
      }

      case SyntaxKind.ArrowFunction: {
        let parameters = (node as ts.ArrowFunction).parameters;
        let body = (node as ts.ArrowFunction).body;
        let wrap = parameters.length !== 1;
        if (wrap) out += '(';
        emitCommaSeparated(parameters);
        if (wrap) out += ')';
        out += space + '=>' + space;
        if (body.kind === SyntaxKind.Block) {
          emitBlock(body as ts.Block);
        } else {
          emit(body, Level.Comma);
        }
        break;
      }

      case SyntaxKind.AsExpression: {
        emit((node as ts.AsExpression).expression, level);
        break;
      }

      case SyntaxKind.BinaryExpression: {
        let operatorToken = (node as ts.BinaryExpression).operatorToken;
        let left = (node as ts.BinaryExpression).left;
        let right = (node as ts.BinaryExpression).right;
        let operatorLevel = binaryOperatorLevel[operatorToken.kind];
        if (operatorLevel === undefined) {
          throw new Error(`Unexpected binary expression kind '${SyntaxKind[operatorToken.kind]}'`);
        }
        let biasRight = operatorToken.kind in isRightAssociative;
        let wrap = level >= operatorLevel;
        if (wrap) out += '(';
        emit(left, operatorLevel - +!biasRight);
        if (operatorLevel !== Level.Comma) out += space;
        emitSpaceBeforeOperator(operatorToken.kind);
        out += ts.tokenToString(operatorToken.kind);
        previousOperator = operatorToken.kind;
        previousOperatorLength = out.length;
        out += space;
        emit(right, operatorLevel - +biasRight);
        if (wrap) out += ')';
        break;
      }

      case SyntaxKind.CallExpression: {
        let expression = (node as ts.CallExpression).expression;
        let args = (node as ts.CallExpression).arguments;
        emit(expression, Level.Postfix);
        out += '(';
        emitCommaSeparated(args);
        out += ')';
        break;
      }

      case SyntaxKind.ConditionalExpression: {
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

      case SyntaxKind.DeleteExpression: {
        let expression = (node as ts.DeleteExpression).expression;
        emitSpaceBeforeIdentifier();
        out += 'delete';
        emit(expression, Level.Prefix);
        break;
      }

      case SyntaxKind.ElementAccessExpression: {
        let expression = (node as ts.ElementAccessExpression).expression;
        let argumentExpression = (node as ts.ElementAccessExpression).argumentExpression;
        emit(expression, Level.Member);
        out += '[';
        emit(argumentExpression, Level.Lowest);
        out += ']';
        break;
      }

      case SyntaxKind.FalseKeyword: {
        if (minify) {
          out += level >= Level.Prefix ? '(!1)' : '!1';
        } else {
          emitSpaceBeforeIdentifier();
          out += 'false';
        }
        break;
      }

      case SyntaxKind.Identifier: {
        let text = (node as ts.Identifier).text;
        emitSpaceBeforeIdentifier();
        out += text;
        break;
      }

      case SyntaxKind.NewExpression: {
        let expression = (node as ts.NewExpression).expression;
        let args = (node as ts.NewExpression).arguments;
        let wrap = expression.kind == SyntaxKind.CallExpression;
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

      case SyntaxKind.NoSubstitutionTemplateLiteral: {
        let text = (node as ts.TemplateLiteralFragment).text;
        out += '`' + escapeTemplateText(text) + '`';
        break;
      }

      case SyntaxKind.NullKeyword: {
        emitSpaceBeforeIdentifier();
        out += 'null';
        break;
      }

      case SyntaxKind.NumericLiteral: {
        let value = (node as mangler.NumericLiteral).value;
        let text = (node as ts.LiteralExpression).text;

        if (minify) {
          if (value == null) value = +text;
          let normal = reduceNumber(value.toString());
          let exponent = reduceNumber(value.toExponential());
          text = normal.length <= exponent.length ? normal : exponent;
        }

        else if (text == null) {
          text = value.toString();
        }

        let wrap = text[0] === '-' && level >= Level.Prefix;
        if (wrap) out += '(';
        out += text;
        if (wrap) out += ')';
        else if (level >= Level.Member && !/[.eE]/.test(text)) out += ' ';
        break;
      }

      case SyntaxKind.ObjectLiteralExpression: {
        let properties = (node as ts.ObjectLiteralExpression).properties;
        out += '{';
        emitCommaSeparated(properties);
        out += '}';
        break;
      }

      case SyntaxKind.OmittedExpression: {
        break;
      }

      case SyntaxKind.ParenthesizedExpression: {
        emit((node as ts.ParenthesizedExpression).expression, level);
        break;
      }

      case SyntaxKind.PrefixUnaryExpression: {
        let operator = (node as ts.PrefixUnaryExpression).operator;
        let operand = (node as ts.PrefixUnaryExpression).operand;
        let wrap = level >= Level.Prefix;
        if (wrap) out += '(';
        emitSpaceBeforeOperator(operator);
        out += ts.tokenToString(operator);
        previousOperator = operator;
        previousOperatorLength = out.length;
        emit(operand, Level.Prefix - 1);
        if (wrap) out += ')';
        break;
      }

      case SyntaxKind.PropertyAccessExpression: {
        let expression = (node as ts.PropertyAccessExpression).expression;
        let name = (node as ts.PropertyAccessExpression).name;
        emit(expression, Level.Member);
        out += '.';
        emit(name, Level.Lowest);
        break;
      }

      case SyntaxKind.PostfixUnaryExpression: {
        let operand = (node as ts.PostfixUnaryExpression).operand;
        let operator = (node as ts.PostfixUnaryExpression).operator;
        let wrap = level >= Level.Postfix;
        if (wrap) out += '(';
        emit(operand, Level.Postfix - 1);
        out += ts.tokenToString(operator);
        if (wrap) out += ')';
        break;
      }

      case SyntaxKind.RegularExpressionLiteral: {
        let text = (node as ts.LiteralExpression).text;
        out += text;
        break;
      }

      case SyntaxKind.SpreadElementExpression: {
        let expression = (node as ts.SpreadElementExpression).expression;
        out += '...';
        emit(expression, Level.Spread);
        break;
      }

      case SyntaxKind.StringLiteral: {
        let text = (node as ts.StringLiteral).text;
        out += JSON.stringify(text);
        break;
      }

      case SyntaxKind.TaggedTemplateExpression: {
        let tag = (node as ts.TaggedTemplateExpression).tag;
        let template = (node as ts.TaggedTemplateExpression).template;
        emit(tag, Level.Prefix);
        emit(template, Level.Lowest);
        break;
      }

      case SyntaxKind.TemplateExpression: {
        let head = (node as ts.TemplateExpression).head;
        let spans = (node as ts.TemplateExpression).templateSpans;
        emit(head, Level.Lowest);
        for (let span of spans) {
          emit(span.expression, Level.Lowest);
          emit(span.literal, Level.Lowest);
        }
        break;
      }

      case SyntaxKind.TemplateHead: {
        let text = (node as ts.TemplateLiteralFragment).text;
        out += '`' + escapeTemplateText(text) + '${';
        break;
      }

      case SyntaxKind.TemplateMiddle: {
        let text = (node as ts.TemplateLiteralFragment).text;
        out += '}' + escapeTemplateText(text) + '${';
        break;
      }

      case SyntaxKind.TemplateTail: {
        let text = (node as ts.TemplateLiteralFragment).text;
        out += '}' + escapeTemplateText(text) + '`';
        break;
      }

      case SyntaxKind.ThisKeyword: {
        emitSpaceBeforeIdentifier();
        out += 'this';
        break;
      }

      case SyntaxKind.TrueKeyword: {
        if (minify) {
          out += level >= Level.Prefix ? '(!0)' : '!0';
        } else {
          emitSpaceBeforeIdentifier();
          out += 'true';
        }
        break;
      }

      case SyntaxKind.TypeOfExpression: {
        let expression = (node as ts.TypeOfExpression).expression;
        emitSpaceBeforeIdentifier();
        out += 'typeof';
        emit(expression, Level.Prefix);
        break;
      }

      case SyntaxKind.VoidExpression: {
        let expression = (node as ts.VoidExpression).expression;
        emitSpaceBeforeIdentifier();
        out += 'void';
        emit(expression, Level.Prefix);
        break;
      }

      default: {
        console.warn(`Unexpected node kind '${SyntaxKind[node.kind]}'`);
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
