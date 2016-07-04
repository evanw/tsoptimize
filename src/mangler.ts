import {Kind, Node} from './ast';

function isAddWithStringLiteral(node: Node): boolean {
  return node.isString() || node.kind() === Kind.Add && (
    isAddWithStringLiteral(node.binaryLeft()) || isAddWithStringLiteral(node.binaryRight()));
}

function mangleStatements(node: Node): void {
  let previous: Node = null;
  let child = node.firstChild();

  while (child !== null) {
    switch (child.kind()) {
      // "a; ; b;" => "a; b;"
      case Kind.Empty: {
        child.remove();
        child = null;
        break;
      }

      // "a; { b; c; } d;" => "a; b; c; d;"
      case Kind.Block: {
        child.replaceWithChildren();
        child = null;
        break;
      }

      // "a; b;" => "a, b;"
      case Kind.Expression: {
        if (previous !== null && previous.kind() === Kind.Expression) {
          previous.appendChild(Node.joinExpressions(previous.expressionValue().remove(), child.expressionValue().remove()));
          child.remove();
          child = null;
        }
        break;
      }

      // "a; return b;" => "return a, b;"
      case Kind.Return: {
        if (previous !== null && previous.kind() === Kind.Expression) {
          child.appendChild(Node.joinExpressions(previous.expressionValue().remove(), child.returnValue().remove()));
          previous.become(child.remove());
          child = null;
        }
        break;
      }

      // "a; throw b;" => "throw a, b;"
      case Kind.Throw: {
        if (previous !== null && previous.kind() === Kind.Expression) {
          child.appendChild(Node.joinExpressions(previous.expressionValue().remove(), child.throwValue().remove()));
          previous.become(child.remove());
          child = null;
        }
        break;
      }

      case Kind.For: {
        if (previous !== null && previous.kind() === Kind.Expression) {
          let setup = child.forSetup();

          // "a; for (;;) {}" => "for (a;;) {}"
          if (setup.isEmpty()) {
            setup.become(previous.expressionValue().remove());
            previous.become(child.remove());
            child = null;
          }

          // "a; for (b;;) {}" => "for (a, b;;) {}"
          else if (Kind.isExpression(setup.kind())) {
            let test = child.forTest();
            child.insertBefore(test, Node.joinExpressions(previous.expressionValue().remove(), setup.remove()));
            previous.become(child.remove());
            child = null;
          }
        }
        break;
      }
    }

    if (child !== null) {
      previous = child;
      child = child.nextSibling();
    }

    else if (previous !== null) {
      child = previous.nextSibling();
    }

    else {
      child = node.firstChild();
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
    case Kind.Equal:
    case Kind.EqualStrict:
    case Kind.GreaterThan:
    case Kind.GreaterThanEqual:
    case Kind.In:
    case Kind.InstanceOf:
    case Kind.LessThan:
    case Kind.LessThanEqual:
    case Kind.Multiply:
    case Kind.NotEqual:
    case Kind.NotEqualStrict:
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

    case Kind.LogicalAnd:
    case Kind.LogicalOr: {
      // "x() || y" => "x()"
      // "x() && y" => "x()"
      if (!node.binaryRight().hasSideEffects()) {
        node.become(node.binaryLeft().remove());
      }
      break;
    }
  }
}

function mangleBlockStatement(node: Node): void {
  if (node.kind() === Kind.Block) {
    // "{}" => ";"
    if (!node.hasChildren()) {
      node.becomeEmpty();
    }

    // "{ a; }" => "a;"
    else if (node.hasOneChild()) {
      node.become(node.firstChild().remove());
    }
  }
}

function mangleConditional(node: Node): void {
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
      node.become(Node.joinExpressions(test, left));
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
}

export function mangle(node: Node): void {
  let kind = node.kind();

  for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
    mangle(child);
  }

  switch (kind) {
    case Kind.Module: {
      mangleStatements(node);
      break;
    }

    case Kind.Block: {
      mangleStatements(node);
      break;
    }

    case Kind.If: {
      let test = node.ifTest();

      mangleBlockStatement(node.ifTrue());
      mangleBlockStatement(node.ifFalse());

      // "if (1) a; else b;" => "a;"
      if (test.isTruthy()) {
        node.become(node.ifTrue().remove());
      }

      // "if (0) a; else b;" => "b;"
      else if (test.isFalsy()) {
        node.become(node.ifFalse().remove());
      }

      else if (!node.ifFalse().isEmpty()) {
        // "if (!a) b; else c;" => "if (a) c; else b;"
        if (test.kind() === Kind.Not) {
          test.become(test.unaryValue().remove());
          node.appendChild(node.ifTrue().remove());
        }

        let whenTrue = node.ifTrue();
        let whenFalse = node.ifFalse();

        // "if (a) b; else c;" => "a ? b : c;"
        if (whenTrue.kind() === Kind.Expression && whenFalse.kind() === Kind.Expression) {
          let value = Node.createConditional(test.remove(), whenTrue.expressionValue().remove(), whenFalse.expressionValue().remove());
          mangleConditional(value);
          node.become(Node.createExpression(value));
        }

        // "if (a) return b; else return c;" => "return a ? b : c;"
        else if (whenTrue.kind() === Kind.Return && whenFalse.kind() === Kind.Return) {
          let value = Node.createConditional(test.remove(), whenTrue.returnValue().remove(), whenFalse.returnValue().remove());
          mangleConditional(value);
          node.become(Node.createReturn(value));
        }

        // "if (a) throw b; else throw c;" => "throw a ? b : c;"
        else if (whenTrue.kind() === Kind.Throw && whenFalse.kind() === Kind.Throw) {
          let value = Node.createConditional(test.remove(), whenTrue.throwValue().remove(), whenFalse.throwValue().remove());
          mangleConditional(value);
          node.become(Node.createThrow(value));
        }
      }

      else if (node.ifTrue().kind() === Kind.Expression) {
        let whenTrue = node.ifTrue().expressionValue().remove();

        // "if (!a) b;" => "a || b;"
        if (test.kind() === Kind.Not) {
          node.become(Node.createExpression(Node.createBinary(Kind.LogicalOr, test.unaryValue().remove(), whenTrue)));
        }

        // "if (a) b;" => "a && b;"
        else {
          node.become(Node.createExpression(Node.createBinary(Kind.LogicalAnd, test.remove(), whenTrue)));
        }

        mangle(node);
      }

      break;
    }

    case Kind.For: {
      let setup = node.forSetup();
      let test = node.forTest();
      let update = node.forUpdate();
      let body = node.forBody();

      mangleBlockStatement(body);

      // "for (x;;) {}" => "for (;;) {}"
      if (!setup.hasSideEffects()) {
        setup.becomeEmpty();
      }

      // "for (;; x) {}" => "for (;;) {}"
      if (!update.hasSideEffects()) {
        update.becomeEmpty();
      }

      // "for (; 0; ) {}" => ";"
      // "for (x = 0; 0; ) {}" => "x = 0;"
      // "for (var x; 0; ) {}" => "var x;"
      if (test.isFalsy()) {
        setup.remove();
        if (Kind.isExpression(setup.kind())) setup = Node.createExpression(setup);
        node.become(setup);
      }
      break;
    }

    case Kind.ForIn: {
      mangleBlockStatement(node.forInBody());
      break;
    }

    case Kind.DoWhile: {
      mangleBlockStatement(node.doWhileBody());
      break;
    }

    // "while (a) b;" => "for (; a; ) b;"
    case Kind.While: {
      let test = node.whileTest();
      let body = node.whileBody();
      node.become(Node.createFor(Node.createEmpty(), test.remove(), Node.createEmpty(), body.remove()));
      mangle(node);
      break;
    }

    // "a: ;" => ";"
    case Kind.Label: {
      let body = node.labelBody();
      mangleBlockStatement(body);
      if (body.isEmpty()) node.becomeEmpty();
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
          previous.replaceWithChildren();
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
      mangleConditional(node);
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
