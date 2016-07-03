import {Kind, Node} from './ast';

function isAddWithStringLiteral(node: Node): boolean {
  return node.isString() || node.kind() === Kind.Add && (
    isAddWithStringLiteral(node.binaryLeft()) || isAddWithStringLiteral(node.binaryRight()));
}

export function mangle(node: Node): void {
  let kind = node.kind();

  for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
    mangle(child);
  }

  switch (kind) {
    case Kind.Void: {
      let value = node.unaryValue();
      if (!value.hasSideEffects()) node.becomeUndefined();
      break;
    }

    case Kind.LogicalAnd: {
      let left = node.binaryLeft();
      if (left.isFalse()) node.becomeBoolean(false);
      break;
    }

    case Kind.LogicalOr: {
      let left = node.binaryLeft();
      if (left.isTrue()) node.becomeBoolean(true);
      break;
    }

    case Kind.Conditional: {
      let test = node.conditionalTest();
      if (test.isTrue()) node.become(node.conditionalTrue().remove());
      else if (test.isFalse()) node.become(node.conditionalFalse().remove());
      break;
    }

    case Kind.Add: {
      let left = node.binaryLeft();
      let right = node.binaryRight();

      if (left.isLiteral() && right.isLiteral()) {
        if (left.isString() || right.isString()) {
          node.becomeString(left.asString() + right.asString());
        } else {
          node.becomeNumber(left.asNumber() + right.asNumber());
        }
      }

      // ("a" + x) + "" => "a" + x
      // (x + "a") + "" => x + "a"
      else if (right.isString() && right.stringValue() === '' && isAddWithStringLiteral(left)) {
        node.become(left.remove());
      }

      // "" + ("a" + x) => "a" + x
      // "" + (x + "a") => x + "a"
      else if (left.isString() && left.stringValue() === '' && isAddWithStringLiteral(right)) {
        node.become(right.remove());
      }

      // (x + "a") + 0 => x + "a0"
      else if (left.kind() === Kind.Add && right.isLiteral() && left.binaryRight().isString()) {
        left.binaryRight().becomeString(left.binaryRight().stringValue() + right.asString());
        node.become(left.remove());
      }

      // 0 + ("a" + x) => "0a" + x
      else if (right.kind() === Kind.Add && left.isLiteral() && right.binaryLeft().isString()) {
        right.binaryLeft().becomeString(left.asString() + right.binaryLeft().stringValue());
        node.become(right.remove());
      }

      // ("" + x) + 0 => x + "0"
      else if (left.kind() === Kind.Add && right.isLiteral() && left.binaryLeft().isString() && left.binaryLeft().stringValue() === '') {
        left.become(left.binaryRight().remove());
        right.becomeString(right.asString());
      }

      // 0 + (x + "") => "0" + x
      else if (right.kind() === Kind.Add && left.isLiteral() && right.binaryRight().isString() && right.binaryRight().stringValue() === '') {
        right.become(right.binaryLeft().remove());
        left.becomeString(left.asString());
      }

      break;
    }

    default: {
      if (Kind.isUnary(kind)) {
        let value = node.unaryValue();

        if (value.isLiteral()) {
          switch (kind) {
            case Kind.Positive: node.becomeNumber(value.asNumber()); break;
            case Kind.Negative: node.becomeNumber(-value.asNumber()); break;
            case Kind.Not: node.becomeBoolean(!value.asBoolean()); break;
            case Kind.Complement: node.becomeNumber(~value.asNumber()); break;
          }
        }
      }

      else if (Kind.isBinary(kind)) {
        let left = node.binaryLeft();
        let right = node.binaryRight();

        if (left.isLiteral() && right.isLiteral()) {
          switch (kind) {
            case Kind.Subtract: node.becomeNumber(left.asNumber() - right.asNumber()); break;
            case Kind.Multiply: node.becomeNumber(left.asNumber() * right.asNumber()); break;
            case Kind.Divide: node.becomeNumber(left.asNumber() / right.asNumber()); break;
            case Kind.Remainder: node.becomeNumber(left.asNumber() % right.asNumber()); break;

            case Kind.BitwiseAnd: node.becomeNumber(left.asNumber() & right.asNumber()); break;
            case Kind.BitwiseOr: node.becomeNumber(left.asNumber() | right.asNumber()); break;
            case Kind.BitwiseXor: node.becomeNumber(left.asNumber() ^ right.asNumber()); break;

            case Kind.ShiftLeft: node.becomeNumber(left.asNumber() << right.asNumber()); break;
            case Kind.ShiftRight: node.becomeNumber(left.asNumber() >> right.asNumber()); break;
            case Kind.ShiftRightUnsigned: node.becomeNumber(left.asNumber() >>> right.asNumber()); break;
          }
        }
      }
      break;
    }
  }
}
