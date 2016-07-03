import {Kind, Node} from './ast';

function isAddWithStringLiteral(node: Node): boolean {
  return node.isString() || node.kind() === Kind.Add && (
    isAddWithStringLiteral(node.binaryLeft()) || isAddWithStringLiteral(node.binaryRight()));
}

function mangleStatements(firstChild: Node): void {
  let child = firstChild;

  while (child !== null) {
    if (child.isEmpty()) {
      let old = child;
      child = child.nextSibling();
      old.remove();
    }

    else {
      child = child.nextSibling();
    }
  }
}

function mangleUnusedExpression(node: Node): void {
  switch (node.kind()) {
    // Unary operators
    case Kind.Complement:
    case Kind.Negative:
    case Kind.Not:
    case Kind.Positive:
    case Kind.TypeOf:
    case Kind.Void:

    // Binary operators
    case Kind.Add:
    case Kind.BitwiseAnd:
    case Kind.BitwiseOr:
    case Kind.BitwiseXor:
    case Kind.Divide:
    case Kind.Multiply:
    case Kind.Remainder:
    case Kind.ShiftLeft:
    case Kind.ShiftRight:
    case Kind.ShiftRightUnsigned:
    case Kind.Subtract:

    case Kind.Array:
    case Kind.Index:
    case Kind.Member:
    case Kind.Object:
    case Kind.Sequence: {
      let result = Node.createSequence();

      while (node.firstChild() !== null) {
        let child = node.firstChild().remove();
        if (child.kind() === Kind.Property) child = child.propertyValue().remove();
        mangleUnusedExpression(child);

        if (child.hasSideEffects()) {
          if (child.kind() === Kind.Sequence) result.appendChildrenFrom(child);
          else result.appendChild(child);
        }
      }

      if (!result.hasChildren()) node.becomeUndefined();
      else if (result.hasOneChild()) node.become(result.firstChild().remove());
      else node.become(result);
      break;
    }
  }
}

export function mangle(node: Node): void {
  let kind = node.kind();

  for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
    mangle(child);
  }

  switch (kind) {
    case Kind.Module: {
      mangleStatements(node.firstChild());
      break;
    }

    case Kind.Block: {
      mangleStatements(node.firstChild());
      break;
    }

    case Kind.Expression: {
      let value = node.expressionValue();

      // "0;" => ";"
      if (!value.hasSideEffects()) node.becomeEmpty();

      // "(x(), 0);" => "x();"
      else mangleUnusedExpression(value);
      break;
    }

    case Kind.Sequence: {
      let next = node.firstChild();

      while (next !== null) {
        let previous = next;
        next = next.nextSibling();

        // "(a, (b, c), d)" => "(a, b, c, d)"
        if (previous.kind() === Kind.Sequence) {
          while (previous.hasChildren()) {
            node.insertBefore(previous, previous.firstChild().remove());
          }
          previous.remove();
        }

        // "(a, b(), c, d(), e)" => "(b(), d(), e)"
        else if (next !== null && !previous.hasSideEffects()) {
          previous.remove();
        }
      }

      // "(a, b())" => "b()"
      if (node.hasOneChild()) {
        node.become(node.firstChild().remove());
      }
      break;
    }

    case Kind.Void: {
      let value = node.unaryValue();

      // "void 123" => "undefined"
      if (!value.hasSideEffects()) node.becomeUndefined();
      break;
    }

    case Kind.LogicalAnd: {
      let left = node.binaryLeft();

      // "0 && a" => "0"
      if (left.isFalsy()) node.become(left.remove());
      break;
    }

    case Kind.LogicalOr: {
      let left = node.binaryLeft();

      // "1 || a" => "1"
      if (left.isTruthy()) node.become(left.remove());
      break;
    }

    case Kind.Conditional: {
      let test = node.conditionalTest();

      // "1 ? a : b" => "a"
      if (test.isTruthy()) {
        node.become(node.conditionalTrue().remove());
      }

      // "0 ? a : b" => "b"
      else if (test.isFalsy()) {
        node.become(node.conditionalFalse().remove());
      }

      else if (node.conditionalTrue().looksTheSameAs(node.conditionalFalse())) {
        let left = node.conditionalTrue().remove();

        // "a ? b : b" => "b"
        if (!test.hasSideEffects()) {
          node.become(left);
        }

        // "a() ? b : b" => "a(), b"
        else {
          mangleUnusedExpression(test.remove());
          if (test.kind() !== Kind.Sequence) {
            test = Node.createSequence().appendChild(test);
          }
          test.appendChild(left);
          node.become(test);
        }
      }

      else {
        // "!a ? b : c" => "a ? c : b"
        if (test.kind() === Kind.Not) {
          test.become(test.unaryValue().remove());
          node.appendChild(node.conditionalTrue().remove());
        }

        if (!test.hasSideEffects()) {
          // "a ? a : b" => "a || b"
          if (test.looksTheSameAs(node.conditionalTrue())) {
            let right = node.conditionalFalse().remove();
            node.become(Node.createBinary(Kind.LogicalOr, test.remove(), right));
          }

          // "a ? b : a" => "a && b"
          else if (test.looksTheSameAs(node.conditionalFalse())) {
            let right = node.conditionalTrue().remove();
            node.become(Node.createBinary(Kind.LogicalAnd, test.remove(), right));
          }
        }
      }
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
