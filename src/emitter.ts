import * as helpers from './helpers';
import {Kind, Node} from './ast';

export enum Emit {
  Normal,
  Minified,
}

enum Operator {
  Symbolic,
  Identifier,
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
enum Level {
  Lowest,
  Comma,
  Spread,
  Yield,
  Assign,
  Conditional,
  LogicalOr,
  LogicalAnd,
  BitwiseOr,
  BitwiseXor,
  BitwiseAnd,
  Equal,
  Compare,
  Shift,
  Add,
  Multiply,
  Prefix,
  Postfix,
  Call,
  Member,
}

function wrapToAvoidAmbiguousElse(node: Node): boolean {
  while (true) {
    switch (node.kind()) {
      case Kind.If: {
        let child = node.ifFalse();
        if (child.isEmpty()) return true;
        node = child;
        break;
      }

      case Kind.For: node = node.forBody(); break;
      case Kind.ForIn: node = node.forInBody(); break;
      case Kind.While: node = node.whileBody(); break;

      default: return false;
    }
  }
}

function reduceNumber(text: string): string {
  return text.replace(/^(-?)0\./, '$1.').replace('+', '');
}

export function emit(root: Node, mode: Emit): string {
  let previousOperator = Kind.Null;
  let previousOperatorLength = 0;
  let minify = mode === Emit.Minified;
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
  function emitSpaceBeforeOperator(operator: Kind): void {
    if (out.length === previousOperatorLength && (
      (previousOperator === Kind.Positive || previousOperator === Kind.Add) && (operator === Kind.Positive || operator === Kind.PrefixIncrement) ||
      (previousOperator === Kind.Negative || previousOperator === Kind.Subtract) && (operator === Kind.Negative || operator === Kind.PrefixDecrement) ||
      previousOperator === Kind.Not && operator === Kind.PrefixDecrement && out.slice(-2) === '<!'
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

  function emitBlockInsideStatement(node: Node): void {
    if (node.kind() === Kind.Block) {
      out += space;
      emitBlock(node);
      out += newline;
    }

    else {
      out += newline;
      increaseIndent();
      emit(node, Level.Lowest);
      decreaseIndent();
    }
  }

  function emitBlock(node: Node): void {
    out += '{' + newline;
    increaseIndent();

    for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
      emitSemicolonIfNeeded();
      emit(child, Level.Lowest);
    }

    decreaseIndent();
    out += indent + '}';
    needsSemicolon = false;
  }

  function emitCommaSeparated(firstChild: Node): void {
    for (let child = firstChild; child !== null; child = child.nextSibling()) {
      if (child !== firstChild) out += ',' + space;
      emit(child, Level.Comma);
    }
  }

  function emitUnaryPrefix(node: Node, operator: string, level: Level, mode: Operator): void {
    let value = node.unaryValue();
    let wrap = level >= Level.Prefix;
    if (wrap) out += '(';

    if (mode === Operator.Identifier) {
      emitSpaceBeforeIdentifier();
      out += operator + space;
    }

    else {
      let kind = node.kind();
      emitSpaceBeforeOperator(kind);
      out += operator;
      previousOperator = kind;
      previousOperatorLength = out.length;
    }

    emit(value, Level.Prefix - 1);
    if (wrap) out += ')';
  }

  function emitUnaryPostfix(node: Node, operator: string, level: Level): void {
    let value = node.unaryValue();
    let wrap = level >= Level.Postfix;
    if (wrap) out += '(';
    emit(value, Level.Postfix - 1);
    out += operator;
    if (wrap) out += ')';
  }

  function emitBinary(node: Node, operator: string, parentLevel: Level, operatorLevel: Level, mode: Operator): void {
    let kind = node.kind();
    let wrap = parentLevel >= operatorLevel;
    if (wrap) out += '(';
    emit(node.binaryLeft(), operatorLevel - +(operatorLevel !== Level.Assign));
    out += space;
    if (mode === Operator.Identifier) emitSpaceBeforeIdentifier();
    else emitSpaceBeforeOperator(kind);
    out += operator;
    previousOperator = kind;
    previousOperatorLength = out.length;
    out += space;
    emit(node.binaryRight(), operatorLevel - +(operatorLevel === Level.Assign));
    if (wrap) out += ')';
  }

  function emitVariables(node: Node): void {
    out += 'var ';
    for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
      if (child.previousSibling() !== null) out += ',' + space;
      out += child.variableSymbol().name();
      let value = child.variableValue();
      if (!value.isUndefined()) {
        out += space + '=' + space;
        emit(value, Level.Comma);
      }
    }
  }

  function emit(node: Node, level: Level): void {
    switch (node.kind()) {
      case Kind.Module: {
        for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
          emitSemicolonIfNeeded();
          emit(child, Level.Lowest);
        }
        if (minify && out !== '') {
          emitSemicolonIfNeeded();
          out += '\n';
        }
        break;
      }

      case Kind.Property: {
        let key = node.propertyKey().name();
        out += /^\w[\w\d]*$/.test(key) ? key : JSON.stringify(key);
        out += ':' + space;
        emit(node.propertyValue(), Level.Comma);
        break;
      }

      case Kind.Variable: {
        let value = node.variableValue();
        emitSpaceBeforeIdentifier();
        out += node.variableSymbol().name();
        if (!value.isUndefined()) {
          out += space + '=' + space;
          emit(value, Level.Comma);
        }
        break;
      }

      ////////////////////////////////////////////////////////////////////////////////
      // Statements

      case Kind.Block: {
        out += indent;
        emitBlock(node);
        out += newline;
        break;
      }

      case Kind.Break: {
        let label = node.breakLabel();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'break';
        if (label !== null) out += ' ' + label.name();
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.Continue: {
        let label = node.continueLabel();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'continue';
        if (label !== null) out += ' ' + label.name();
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.Debugger: {
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'debugger';
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.DoWhile: {
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'do';
        emitBlockInsideStatement(node.doWhileBody());
        emitSemicolonIfNeeded();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'while' + space + '(';
        emit(node.doWhileTest(), Level.Lowest);
        out += ')';
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.Empty: {
        out += indent + ';' + newline;
        break;
      }

      case Kind.Expression: {
        out += indent;
        emit(node.expressionValue(), Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.For: {
        let setup = node.forSetup();
        let test = node.forTest();
        let update = node.forUpdate();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (!setup.isEmpty()) {
          if (setup.kind() == Kind.Variables) {
            emitVariables(setup);
          } else {
            emit(setup, Level.Lowest);
          }
        }
        out += ';';
        if (!test.isEmpty()) {
          out += space;
          emit(test, Level.Lowest);
        }
        out += ';';
        if (!update.isEmpty()) {
          out += space;
          emit(update, Level.Lowest);
        }
        out += ')';
        emitBlockInsideStatement(node.forBody());
        break;
      }

      case Kind.ForIn: {
        let setup = node.forInSetup();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'for' + space + '(';
        if (setup.kind() == Kind.Variable) {
          out += 'var';
        }
        emit(setup, Level.Lowest);
        emitSpaceBeforeIdentifier();
        out += 'in' + space;
        emit(node.forInValue(), Level.Lowest);
        out += ')';
        emitBlockInsideStatement(node.forInBody());
        break;
      }

      case Kind.Function: {
        let body = node.functionBody();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'function ' + node.functionSymbol().name();
        out += '(';
        emitCommaSeparated(body.nextSibling());
        out += ')' + space;
        emitBlock(body);
        out += newline;
        break;
      }

      case Kind.If: {
        out += indent;

        while (true) {
          let test = node.ifTest();
          let whenTrue = node.ifTrue();
          let whenFalse = node.ifFalse();

          emitSpaceBeforeIdentifier();
          out += 'if' + space + '(';
          emit(test, Level.Lowest);
          out += ')';

          if (whenFalse.isEmpty()) {
            emitBlockInsideStatement(whenTrue);
            break;
          }

          if (wrapToAvoidAmbiguousElse(whenTrue)) {
            out += space + '{' + newline;
            increaseIndent();
            emit(whenTrue, Level.Lowest);
            decreaseIndent();
            out += indent + '}' + newline;
            needsSemicolon = false;
          }

          else {
            emitBlockInsideStatement(whenTrue);
            emitSemicolonIfNeeded();
          }

          out += indent;
          emitSpaceBeforeIdentifier();
          out += 'else';

          if (whenFalse.kind() !== Kind.If) {
            emitBlockInsideStatement(whenFalse);
            break;
          }

          node = whenFalse;
        }
        break;
      }

      case Kind.Label: {
        if (indent) {
          decreaseIndent();
          out += indent;
          increaseIndent();
        }
        out += node.labelSymbol().name() + ':' + newline;
        emit(node.labelBody(), Level.Lowest);
        break;
      }

      case Kind.Return: {
        let value = node.returnValue();
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'return';
        if (!value.isUndefined()) {
          out += space;
          emit(value, Level.Lowest);
        }
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.Throw: {
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'throw' + space;
        emit(node.throwValue(), Level.Lowest);
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.Variables: {
        out += indent;
        emitSpaceBeforeIdentifier();
        emitVariables(node);
        emitSemicolonAfterStatement();
        break;
      }

      case Kind.While: {
        out += indent;
        emitSpaceBeforeIdentifier();
        out += 'while' + space + '(';
        emit(node.whileTest(), Level.Lowest);
        out += ')';
        emitBlockInsideStatement(node.whileBody());
        break;
      }

      ////////////////////////////////////////////////////////////////////////////////
      // Expressions

      case Kind.Array: {
        out += '[';
        for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
          if (child.isUndefined()) {
            if (child.previousSibling() !== null) out += ',';
            if (child.nextSibling() === null) out += ',';
          } else {
            if (child.previousSibling() !== null) out += ',' + space;
            emit(child, Level.Comma);
          }
        }
        out += ']';
        break;
      }

      case Kind.Call: {
        let target = node.callTarget();
        emit(target, Level.Postfix);
        out += '(';
        emitCommaSeparated(target.nextSibling());
        out += ')';
        break;
      }

      case Kind.Conditional: {
        let wrap = level >= Level.Conditional;
        if (wrap) out += '(';
        emit(node.conditionalTest(), Level.Conditional);
        out += space + '?' + space;
        emit(node.conditionalTrue(), Level.Conditional - 1);
        out += space + ':' + space;
        emit(node.conditionalFalse(), Level.Conditional - 1);
        if (wrap) out += ')';
        break;
      }

      case Kind.Boolean: {
        let value = node.booleanValue();
        if (minify) {
          out += level >= Level.Prefix ? value ? '(!0)' : '(!1)' : value ? '!0' : '!1';
        } else {
          emitSpaceBeforeIdentifier();
          out += value ? 'true' : 'false';
        }
        break;
      }

      case Kind.Identifier: {
        emitSpaceBeforeIdentifier();
        out += node.identifierSymbol().name();
        break;
      }

      case Kind.Index: {
        emit(node.indexTarget(), Level.Member);
        out += '[';
        emit(node.indexProperty(), Level.Lowest);
        out += ']';
        break;
      }

      case Kind.Member: {
        emit(node.memberValue(), Level.Member);
        out += '.' + node.memberSymbol().name();
        break;
      }

      case Kind.New: {
        let target = node.newTarget();
        let wrap = target.kind() === Kind.Call;
        emitSpaceBeforeIdentifier();
        out += 'new' + space;
        if (wrap) out += '(';
        emit(target, Level.Postfix);
        if (wrap) out += ')';
        out += '(';
        emitCommaSeparated(target.nextSibling());
        out += ')';
        break;
      }

      case Kind.Null: {
        emitSpaceBeforeIdentifier();
        out += 'null';
        break;
      }

      case Kind.Number: {
        let value = node.numberValue();
        let text: string;

        if (minify) {
          let normal = reduceNumber(value.toString());
          let exponent = reduceNumber(value.toExponential());
          text = normal.length <= exponent.length ? normal : exponent;
        }

        else {
          text = value.toString();
        }

        let isNegative = text[0] === '-';
        let wrap = isNegative && level >= Level.Prefix;
        if (wrap) out += '(';
        else if (isNegative) emitSpaceBeforeOperator(Kind.Negative);
        else emitSpaceBeforeIdentifier();
        out += text;
        if (wrap) out += ')';
        else if (level >= Level.Member && !/[.eE]/.test(text)) out += ' ';
        break;
      }

      case Kind.Object: {
        out += '{';
        emitCommaSeparated(node.firstChild());
        out += '}';
        break;
      }

      case Kind.RegExp: {
        out += node.regExpValue();
        break;
      }

      case Kind.Sequence: {
        let wrap = level >= Level.Comma;
        if (wrap) out += '(';
        emitCommaSeparated(node.firstChild());
        if (wrap) out += ')';
        break;
      }

      case Kind.String: {
        out += JSON.stringify(node.stringValue());
        break;
      }

      case Kind.This: {
        emitSpaceBeforeIdentifier();
        out += 'this';
        break;
      }

      case Kind.Undefined: {
        let wrap = level >= Level.Prefix;
        if (wrap) out += '(void 0)';
        else out += 'void 0';
        break;
      }

      case Kind.Complement: emitUnaryPrefix(node, '~', level, Operator.Symbolic); break;
      case Kind.Delete: emitUnaryPrefix(node, 'delete', level, Operator.Identifier); break;
      case Kind.Negative: emitUnaryPrefix(node, '-', level, Operator.Symbolic); break;
      case Kind.Not: emitUnaryPrefix(node, '!', level, Operator.Symbolic); break;
      case Kind.Positive: emitUnaryPrefix(node, '+', level, Operator.Symbolic); break;
      case Kind.PostfixDecrement: emitUnaryPostfix(node, '--', level); break;
      case Kind.PostfixIncrement: emitUnaryPostfix(node, '++', level); break;
      case Kind.PrefixDecrement: emitUnaryPrefix(node, '--', level, Operator.Symbolic); break;
      case Kind.PrefixIncrement: emitUnaryPrefix(node, '++', level, Operator.Symbolic); break;
      case Kind.TypeOf: emitUnaryPrefix(node, 'typeof', level, Operator.Identifier); break;
      case Kind.Void: emitUnaryPrefix(node, 'void', level, Operator.Identifier); break;

      case Kind.Add: emitBinary(node, '+', level, Level.Add, Operator.Symbolic); break;
      case Kind.BitwiseAnd: emitBinary(node, '&', level, Level.BitwiseAnd, Operator.Symbolic); break;
      case Kind.BitwiseOr: emitBinary(node, '|', level, Level.BitwiseOr, Operator.Symbolic); break;
      case Kind.BitwiseXor: emitBinary(node, '^', level, Level.BitwiseXor, Operator.Symbolic); break;
      case Kind.Divide: emitBinary(node, '/', level, Level.Multiply, Operator.Symbolic); break;
      case Kind.Equal: emitBinary(node, '==', level, Level.Equal, Operator.Symbolic); break;
      case Kind.EqualStrict: emitBinary(node, '===', level, Level.Equal, Operator.Symbolic); break;
      case Kind.GreaterThan: emitBinary(node, '>', level, Level.Compare, Operator.Symbolic); break;
      case Kind.GreaterThanEqual: emitBinary(node, '>=', level, Level.Compare, Operator.Symbolic); break;
      case Kind.In: emitBinary(node, 'in', level, Level.Compare, Operator.Identifier); break;
      case Kind.InstanceOf: emitBinary(node, 'instanceof', level, Level.Compare, Operator.Identifier); break;
      case Kind.LessThan: emitBinary(node, '<', level, Level.Compare, Operator.Symbolic); break;
      case Kind.LessThanEqual: emitBinary(node, '<=', level, Level.Compare, Operator.Symbolic); break;
      case Kind.LogicalAnd: emitBinary(node, '&&', level, Level.LogicalAnd, Operator.Symbolic); break;
      case Kind.LogicalOr: emitBinary(node, '||', level, Level.LogicalOr, Operator.Symbolic); break;
      case Kind.Multiply: emitBinary(node, '*', level, Level.Multiply, Operator.Symbolic); break;
      case Kind.NotEqual: emitBinary(node, '!=', level, Level.Equal, Operator.Symbolic); break;
      case Kind.NotEqualStrict: emitBinary(node, '!==', level, Level.Equal, Operator.Symbolic); break;
      case Kind.Remainder: emitBinary(node, '%', level, Level.Multiply, Operator.Symbolic); break;
      case Kind.ShiftLeft: emitBinary(node, '<<', level, Level.Shift, Operator.Symbolic); break;
      case Kind.ShiftRight: emitBinary(node, '>>', level, Level.Shift, Operator.Symbolic); break;
      case Kind.ShiftRightUnsigned: emitBinary(node, '>>>', level, Level.Shift, Operator.Symbolic); break;
      case Kind.Subtract: emitBinary(node, '-', level, Level.Add, Operator.Symbolic); break;

      case Kind.Assign: emitBinary(node, '=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignAdd: emitBinary(node, '+=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignBitwiseAnd: emitBinary(node, '&=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignBitwiseOr: emitBinary(node, '|=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignBitwiseXor: emitBinary(node, '^=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignDivide: emitBinary(node, '/=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignMultiply: emitBinary(node, '*=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignRemainder: emitBinary(node, '%=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignShiftLeft: emitBinary(node, '<<=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignShiftRight: emitBinary(node, '>>=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignShiftRightUnsigned: emitBinary(node, '>>>=', level, Level.Assign, Operator.Symbolic); break;
      case Kind.AssignSubtract: emitBinary(node, '-=', level, Level.Assign, Operator.Symbolic); break;

      default: {
        throw new Error(`Unexpected node kind '${Kind[node.kind()]}'`);
      }
    }
  }

  emit(root, Level.Lowest);
  return out;
}
