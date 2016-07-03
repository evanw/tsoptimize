import {Kind, Node} from './ast';

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
            case Kind.Add: {
              if (left.kind() == Kind.String || right.kind() == Kind.String) {
                node.becomeString(left.asString() + right.asString());
              } else {
                node.becomeNumber(left.asNumber() + right.asNumber());
              }
              break;
            }

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
