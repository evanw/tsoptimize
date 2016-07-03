function assert(truth: boolean): void {
  if (!truth) {
    throw new Error('Assertion failed');
  }
}

export enum Kind {
  Module,
  Property,
  Variable,

  // Statements
  Block,
  Break,
  Continue,
  Debugger,
  DoWhile,
  Empty,
  Expression,
  For,
  ForIn,
  Function,
  If,
  Label,
  Namespace,
  Return,
  Throw,
  Variables,
  While,

  // Expressions
  Array,
  Boolean,
  Call,
  Conditional,
  Identifier,
  Index,
  Member,
  New,
  Null,
  Number,
  Object,
  RegExp,
  Sequence,
  String,
  This,
  Undefined,

  // Unary expressions
  Complement,
  Delete,
  Negative,
  Not,
  Positive,
  PostfixDecrement,
  PostfixIncrement,
  PrefixDecrement,
  PrefixIncrement,
  TypeOf,
  Void,

  // Binary expressions
  Add,
  BitwiseAnd,
  BitwiseOr,
  BitwiseXor,
  Divide,
  Equal,
  EqualStrict,
  GreaterThan,
  GreaterThanEqual,
  In,
  InstanceOf,
  LessThan,
  LessThanEqual,
  LogicalAnd,
  LogicalOr,
  Multiply,
  NotEqual,
  NotEqualStrict,
  Remainder,
  ShiftLeft,
  ShiftRight,
  ShiftRightUnsigned,
  Subtract,

  // Binary assignment expressions
  Assign,
  AssignAdd,
  AssignBitwiseAnd,
  AssignBitwiseOr,
  AssignBitwiseXor,
  AssignDivide,
  AssignMultiply,
  AssignRemainder,
  AssignShiftLeft,
  AssignShiftRight,
  AssignShiftRightUnsigned,
  AssignSubtract,
}

export namespace Kind {
  export function isPostfix(kind: Kind): boolean {
    return kind === Kind.PostfixDecrement || kind === Kind.PostfixIncrement;
  }

  export function isStatement(kind: Kind): boolean {
    return kind >= Kind.Block && kind <= Kind.While;
  }

  export function isExpression(kind: Kind): boolean {
    return kind >= Kind.Array;
  }

  export function isUnary(kind: Kind): boolean {
    return kind >= Kind.Complement && kind <= Kind.Void;
  }

  export function isBinary(kind: Kind): boolean {
    return kind >= Kind.Add;
  }

  export function isBinaryAssign(kind: Kind): boolean {
    return kind >= Kind.Assign;
  }
}

export class Symbol {
  constructor(
    private _name: string
  ) {
  }

  name(): string {
    return this._name;
  }
}

export class Node {
  private _parent: Node = null;
  private _firstChild: Node = null;
  private _lastChild: Node = null;
  private _previousSibling: Node = null;
  private _nextSibling: Node = null;
  private _symbolValue: Symbol = null;
  private _stringValue: string = null;
  private _numberValue = 0;

  constructor(
    private _kind: Kind
  ) {
  }

  kind(): Kind {
    return this._kind;
  }

  parent(): Node {
    return this._parent;
  }

  firstChild(): Node {
    return this._firstChild;
  }

  lastChild(): Node {
    return this._lastChild;
  }

  previousSibling(): Node {
    return this._previousSibling;
  }

  nextSibling(): Node {
    return this._nextSibling;
  }

  hasChildren(): boolean {
    return this._firstChild !== null;
  }

  hasOneChild(): boolean {
    return this._firstChild !== null && this._firstChild === this._lastChild;
  }

  childCount(): number {
    let count = 0;
    for (let child = this._firstChild; child !== null; child = child._nextSibling) {
      count++;
    }
    return count;
  }

  become(node: Node): void {
    assert(node !== this && node._parent === null);

    this._kind = node._kind;
    this._symbolValue = node._symbolValue;
    this._stringValue = node._stringValue;
    this._numberValue = node._numberValue;
    this.removeChildren();
    this.appendChildrenFrom(node);
  }

  becomeEmpty(): void {
    this.removeChildren();
    this._kind = Kind.Empty;
    this._symbolValue = null;
    this._stringValue = null;
    this._numberValue = 0;
  }

  becomeUndefined(): void {
    this.removeChildren();
    this._kind = Kind.Undefined;
    this._symbolValue = null;
    this._stringValue = null;
    this._numberValue = 0;
  }

  becomeBoolean(value: boolean): void {
    assert(value !== null);
    this.removeChildren();
    this._kind = Kind.Boolean;
    this._symbolValue = null;
    this._stringValue = null;
    this._numberValue = +value;
  }

  becomeNumber(value: number): void {
    assert(value !== null);
    this.removeChildren();
    this._kind = Kind.Number;
    this._symbolValue = null;
    this._stringValue = null;
    this._numberValue = value;
  }

  becomeString(value: string): void {
    assert(value !== null);
    this.removeChildren();
    this._kind = Kind.String;
    this._symbolValue = null;
    this._stringValue = value;
    this._numberValue = 0;
  }

  appendChild(child: Node): Node {
    if (child !== null) {
      assert(child !== this);
      assert(child._parent === null);

      if (this._firstChild === null) {
        this._firstChild = child;
      }

      else {
        child._previousSibling = this._lastChild;
        this._lastChild._nextSibling = child;
      }

      child._parent = this;
      this._lastChild = child;
    }

    return this;
  }

  insertBefore(after: Node, before: Node): Node {
    if (before !== null) {
      assert(before !== this);
      assert(after !== this);
      assert(before !== after);
      assert(before._parent === null);
      assert(before._previousSibling === null);
      assert(before._nextSibling === null);
      assert(after === null || after._parent === this);

      if (after === null) {
        return this.appendChild(before);
      }

      before._parent = this;
      before._previousSibling = after._previousSibling;
      before._nextSibling = after;

      if (after._previousSibling !== null) {
        assert(after === after._previousSibling._nextSibling);
        after._previousSibling._nextSibling = before
      }

      else {
        assert(after === this._firstChild);
        this._firstChild = before;
      }

      after._previousSibling = before;
    }

    return this;
  }

  remove(): Node {
    assert(this._parent !== null);

    if (this._previousSibling !== null) {
      assert(this._previousSibling._nextSibling === this);
      this._previousSibling._nextSibling = this._nextSibling;
    } else {
      assert(this._parent._firstChild === this);
      this._parent._firstChild = this._nextSibling;
    }

    if (this._nextSibling !== null) {
      assert(this._nextSibling._previousSibling === this);
      this._nextSibling._previousSibling = this._previousSibling;
    } else {
      assert(this._parent._lastChild === this);
      this._parent._lastChild = this._previousSibling;
    }

    this._parent = null;
    this._previousSibling = null;
    this._nextSibling = null;
    return this;
  }

  removeChildren(): void {
    while (this.hasChildren()) {
      this._firstChild.remove();
    }
  }

  appendChildrenFrom(node: Node): void {
    assert(node !== this);

    while (node.hasChildren()) {
      this.appendChild(node.firstChild().remove());
    }
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Constructors

  static createVariable(symbol: Symbol, value: Node): Node {
    assert(symbol !== null);
    assert(Kind.isExpression(value._kind));
    var node = new Node(Kind.Variable);
    node._symbolValue = symbol;
    return node.appendChild(value);
  }

  static createModule(): Node {
    return new Node(Kind.Module);
  }

  static createBlock(): Node {
    return new Node(Kind.Block);
  }

  static createBreak(label: Symbol): Node {
    let node = new Node(Kind.Break);
    node._symbolValue = label;
    return node;
  }

  static createContinue(label: Symbol): Node {
    let node = new Node(Kind.Continue);
    node._symbolValue = label;
    return node;
  }

  static createDebugger(): Node {
    return new Node(Kind.Debugger);
  }

  static createFunction(symbol: Symbol, body: Node): Node {
    assert(symbol !== null);
    assert(body._kind === Kind.Block);
    let node = new Node(Kind.Function);
    node._symbolValue = symbol;
    return node.appendChild(body);
  }

  static createFor(setup: Node, test: Node, update: Node, body: Node): Node {
    assert(Kind.isExpression(setup._kind) || setup._kind === Kind.Empty || setup._kind === Kind.Variables);
    assert(Kind.isExpression(test._kind) || test._kind === Kind.Empty);
    assert(Kind.isExpression(update._kind) || update._kind === Kind.Empty);
    assert(Kind.isStatement(body._kind));
    return new Node(Kind.For).appendChild(setup).appendChild(test).appendChild(update).appendChild(body);
  }

  static createForIn(setup: Node, value: Node, body: Node): Node {
    assert(Kind.isExpression(setup._kind) || setup._kind === Kind.Variable);
    assert(Kind.isExpression(value._kind));
    assert(Kind.isStatement(body._kind));
    return new Node(Kind.ForIn).appendChild(setup).appendChild(value).appendChild(body);
  }

  static createProperty(key: Symbol, value: Node): Node {
    assert(key !== null);
    assert(Kind.isExpression(value._kind));
    let node = new Node(Kind.Property);
    node._symbolValue = key;
    return node.appendChild(value);
  }

  static createReturn(value: Node): Node {
    assert(Kind.isExpression(value._kind));
    return new Node(Kind.Return).appendChild(value);
  }

  static createThrow(value: Node): Node {
    assert(Kind.isExpression(value._kind));
    return new Node(Kind.Throw).appendChild(value);
  }

  static createVariables(): Node {
    return new Node(Kind.Variables);
  }

  static createIf(test: Node, whenTrue: Node, whenFalse: Node): Node {
    assert(Kind.isExpression(test._kind));
    assert(Kind.isStatement(whenTrue._kind));
    assert(Kind.isStatement(whenFalse._kind));
    return new Node(Kind.If).appendChild(test).appendChild(whenTrue).appendChild(whenFalse);
  }

  static createEmpty(): Node {
    return new Node(Kind.Empty);
  }

  static createExpression(value: Node): Node {
    assert(Kind.isExpression(value._kind));
    return new Node(Kind.Expression).appendChild(value);
  }

  static createDoWhile(body: Node, test: Node): Node {
    assert(Kind.isStatement(body._kind));
    assert(Kind.isExpression(test._kind));
    return new Node(Kind.DoWhile).appendChild(body).appendChild(test);
  }

  static createLabel(symbol: Symbol, body: Node): Node {
    assert(symbol !== null);
    assert(Kind.isStatement(body._kind));
    let node = new Node(Kind.Label);
    node._symbolValue = symbol;
    return node.appendChild(body);
  }

  static createWhile(test: Node, body: Node): Node {
    assert(Kind.isExpression(test._kind));
    assert(Kind.isStatement(body._kind));
    return new Node(Kind.While).appendChild(test).appendChild(body);
  }

  static createCall(target: Node): Node {
    assert(Kind.isExpression(target._kind));
    return new Node(Kind.Call).appendChild(target);
  }

  static createNew(target: Node): Node {
    assert(Kind.isExpression(target._kind));
    return new Node(Kind.New).appendChild(target);
  }

  static createIdentifier(symbol: Symbol): Node {
    assert(symbol !== null);
    let node = new Node(Kind.Identifier);
    node._symbolValue = symbol;
    return node;
  }

  static createArray(): Node {
    return new Node(Kind.Array);
  }

  static createObject(): Node {
    return new Node(Kind.Object);
  }

  static createBoolean(value: boolean): Node {
    assert(value !== null);
    let node = new Node(Kind.Boolean);
    node._numberValue = +value;
    return node;
  }

  static createNumber(value: number): Node {
    assert(value !== null);
    let node = new Node(Kind.Number);
    node._numberValue = value;
    return node;
  }

  static createString(value: string): Node {
    assert(value !== null);
    let node = new Node(Kind.String);
    node._stringValue = value;
    return node;
  }

  static createRegExp(value: string): Node {
    assert(value !== null);
    let node = new Node(Kind.RegExp);
    node._stringValue = value;
    return node;
  }

  static createConditional(test: Node, whenTrue: Node, whenFalse: Node): Node {
    assert(Kind.isExpression(test._kind));
    assert(Kind.isExpression(whenTrue._kind));
    assert(Kind.isExpression(whenFalse._kind));
    return new Node(Kind.Conditional).appendChild(test).appendChild(whenTrue).appendChild(whenFalse);
  }

  static createIndex(target: Node, property: Node): Node {
    assert(Kind.isExpression(target._kind));
    assert(Kind.isExpression(property._kind));
    return new Node(Kind.Index).appendChild(target).appendChild(property);
  }

  static createMember(value: Node, symbol: Symbol): Node {
    assert(Kind.isExpression(value._kind));
    let node = new Node(Kind.Member);
    node._symbolValue = symbol;
    return node.appendChild(value);
  }

  static createNull(): Node {
    return new Node(Kind.Null);
  }

  static createSequence(): Node {
    return new Node(Kind.Sequence);
  }

  static createThis(): Node {
    return new Node(Kind.This);
  }

  static createUndefined(): Node {
    return new Node(Kind.Undefined);
  }

  static createUnary(kind: Kind, value: Node): Node {
    assert(Kind.isUnary(kind));
    assert(Kind.isExpression(value._kind));
    return new Node(kind).appendChild(value);
  }

  static createBinary(kind: Kind, left: Node, right: Node): Node {
    assert(Kind.isBinary(kind));
    assert(Kind.isExpression(left._kind));
    assert(Kind.isExpression(right._kind));
    return new Node(kind).appendChild(left).appendChild(right);
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Getters

  propertyKey(): Symbol {
    assert(this._kind === Kind.Property);
    assert(this.childCount() === 1);
    assert(this._symbolValue !== null);
    return this._symbolValue;
  }

  propertyValue(): Node {
    assert(this._kind === Kind.Property);
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  variableSymbol(): Symbol {
    assert(this._kind === Kind.Variable);
    assert(this.childCount() === 1);
    assert(this._symbolValue !== null);
    return this._symbolValue;
  }

  variableValue(): Node {
    assert(this._kind === Kind.Variable);
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  breakLabel(): Symbol {
    assert(this._kind === Kind.Break);
    assert(this.childCount() === 0);
    return this._symbolValue;
  }

  continueLabel(): Symbol {
    assert(this._kind === Kind.Continue);
    assert(this.childCount() === 0);
    return this._symbolValue;
  }

  throwValue(): Node {
    assert(this._kind === Kind.Throw);
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  returnValue(): Node {
    assert(this._kind === Kind.Return);
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  functionSymbol(): Symbol {
    assert(this._kind === Kind.Function);
    assert(this.childCount() >= 1);
    assert(this._symbolValue !== null);
    return this._symbolValue;
  }

  functionBody(): Node {
    assert(this._kind === Kind.Function);
    assert(this.childCount() >= 1);
    assert(this._firstChild._kind === Kind.Block);
    return this._firstChild;
  }

  forSetup(): Node {
    assert(this._kind === Kind.For);
    assert(this.childCount() === 4);
    assert(Kind.isExpression(this._firstChild._kind) || this._firstChild._kind === Kind.Empty || this._firstChild._kind === Kind.Variables);
    return this._firstChild;
  }

  forTest(): Node {
    assert(this._kind === Kind.For);
    assert(this.childCount() === 4);
    assert(Kind.isExpression(this._firstChild._nextSibling._kind) || this._firstChild._nextSibling._kind === Kind.Empty);
    return this._firstChild._nextSibling;
  }

  forUpdate(): Node {
    assert(this._kind === Kind.For);
    assert(this.childCount() === 4);
    assert(Kind.isExpression(this._lastChild._previousSibling._kind) || this._lastChild._previousSibling._kind === Kind.Empty);
    return this._lastChild._previousSibling;
  }

  forBody(): Node {
    assert(this._kind === Kind.For);
    assert(this.childCount() === 4);
    assert(Kind.isStatement(this._lastChild._kind));
    return this._lastChild;
  }

  forInSetup(): Node {
    assert(this._kind === Kind.ForIn);
    assert(this.childCount() === 3);
    assert(Kind.isExpression(this._firstChild._kind) || this._firstChild._kind === Kind.Variable);
    return this._firstChild;
  }

  forInValue(): Node {
    assert(this._kind === Kind.ForIn);
    assert(this.childCount() === 3);
    assert(Kind.isExpression(this._firstChild._nextSibling._kind));
    return this._firstChild._nextSibling;
  }

  forInBody(): Node {
    assert(this._kind === Kind.ForIn);
    assert(this.childCount() === 3);
    assert(Kind.isStatement(this._lastChild._kind));
    return this._lastChild;
  }

  ifTest(): Node {
    assert(this._kind === Kind.If);
    assert(this.childCount() === 3);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  ifTrue(): Node {
    assert(this._kind === Kind.If);
    assert(this.childCount() === 3);
    assert(Kind.isStatement(this._firstChild._nextSibling._kind));
    return this._firstChild._nextSibling;
  }

  ifFalse(): Node {
    assert(this._kind === Kind.If);
    assert(this.childCount() === 3);
    assert(Kind.isStatement(this._lastChild._kind));
    return this._lastChild;
  }

  expressionValue(): Node {
    assert(this._kind === Kind.Expression);
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  labelSymbol(): Symbol {
    assert(this._kind === Kind.Label);
    assert(this.childCount() === 1);
    assert(this._symbolValue !== null);
    return this._symbolValue;
  }

  labelBody(): Node {
    assert(this._kind === Kind.Label);
    assert(this.childCount() === 1);
    assert(Kind.isStatement(this._firstChild._kind));
    return this._firstChild;
  }

  doWhileBody(): Node {
    assert(this._kind === Kind.DoWhile);
    assert(this.childCount() === 2);
    assert(Kind.isStatement(this._firstChild._kind));
    return this._firstChild;
  }

  doWhileTest(): Node {
    assert(this._kind === Kind.DoWhile);
    assert(this.childCount() === 2);
    assert(Kind.isExpression(this._lastChild._kind));
    return this._lastChild;
  }

  whileTest(): Node {
    assert(this._kind === Kind.While);
    assert(this.childCount() === 2);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  whileBody(): Node {
    assert(this._kind === Kind.While);
    assert(this.childCount() === 2);
    assert(Kind.isStatement(this._lastChild._kind));
    return this._lastChild;
  }

  callTarget(): Node {
    assert(this._kind === Kind.Call);
    assert(this.childCount() >= 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  newTarget(): Node {
    assert(this._kind === Kind.New);
    assert(this.childCount() >= 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  conditionalTest(): Node {
    assert(this._kind === Kind.Conditional);
    assert(this.childCount() === 3);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  conditionalTrue(): Node {
    assert(this._kind === Kind.Conditional);
    assert(this.childCount() === 3);
    assert(Kind.isExpression(this._firstChild._nextSibling._kind));
    return this._firstChild._nextSibling;
  }

  conditionalFalse(): Node {
    assert(this._kind === Kind.Conditional);
    assert(this.childCount() === 3);
    assert(Kind.isExpression(this._lastChild._kind));
    return this._lastChild;
  }

  indexTarget(): Node {
    assert(this._kind === Kind.Index);
    assert(this.childCount() === 2);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  indexProperty(): Node {
    assert(this._kind === Kind.Index);
    assert(this.childCount() === 2);
    assert(Kind.isExpression(this._lastChild._kind));
    return this._lastChild;
  }

  memberValue(): Node {
    assert(this._kind === Kind.Member);
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  memberSymbol(): Symbol {
    assert(this._kind === Kind.Member);
    assert(this.childCount() === 1);
    assert(this._symbolValue !== null);
    return this._symbolValue;
  }

  identifierSymbol(): Symbol {
    assert(this._kind === Kind.Identifier);
    assert(this.childCount() === 0);
    assert(this._symbolValue !== null);
    return this._symbolValue;
  }

  booleanValue(): boolean {
    assert(this._kind === Kind.Boolean);
    assert(this.childCount() === 0);
    assert(this._numberValue !== null);
    return !!this._numberValue;
  }

  numberValue(): number {
    assert(this._kind === Kind.Number);
    assert(this.childCount() === 0);
    assert(this._numberValue !== null);
    return this._numberValue;
  }

  stringValue(): string {
    assert(this._kind === Kind.String);
    assert(this.childCount() === 0);
    assert(this._stringValue !== null);
    return this._stringValue;
  }

  regExpValue(): string {
    assert(this._kind === Kind.RegExp);
    assert(this.childCount() === 0);
    assert(this._stringValue !== null);
    return this._stringValue;
  }

  unaryValue(): Node {
    assert(Kind.isUnary(this._kind));
    assert(this.childCount() === 1);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  binaryLeft(): Node {
    assert(Kind.isBinary(this._kind));
    assert(this.childCount() === 2);
    assert(Kind.isExpression(this._firstChild._kind));
    return this._firstChild;
  }

  binaryRight(): Node {
    assert(Kind.isBinary(this._kind));
    assert(this.childCount() === 2);
    assert(Kind.isExpression(this._lastChild._kind));
    return this._lastChild;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Helpers

  isBoolean(): boolean {
    return this._kind === Kind.Boolean;
  }

  isNumber(): boolean {
    return this._kind === Kind.Number;
  }

  isString(): boolean {
    return this._kind === Kind.String;
  }

  isUndefined(): boolean {
    return this._kind === Kind.Undefined;
  }

  isEmpty(): boolean {
    return this._kind === Kind.Empty;
  }

  isTruthy(): boolean {
    return this.isLiteral() && this.asBoolean();
  }

  isFalsy(): boolean {
    return this.isLiteral() && !this.asBoolean();
  }

  hasSideEffects(): boolean {
    switch (this._kind) {
      case Kind.Boolean:
      case Kind.Identifier:
      case Kind.Null:
      case Kind.Number:
      case Kind.String:
      case Kind.This:
      case Kind.Undefined: {
        return false;
      }

      case Kind.Complement:
      case Kind.Negative:
      case Kind.Not:
      case Kind.Positive:
      case Kind.TypeOf:
      case Kind.Void: {
        return this.unaryValue().hasSideEffects();
      }

      case Kind.Array: {
        for (let child = this._firstChild; child !== null; child = child._nextSibling) {
          if (child.hasSideEffects()) {
            return false;
          }
        }
        return true;
      }

      case Kind.Object: {
        for (let child = this._firstChild; child !== null; child = child._nextSibling) {
          if (child.propertyValue().hasSideEffects()) {
            return false;
          }
        }
        return true;
      }

      default: {
        return true;
      }
    }
  }

  isLiteral(): boolean {
    switch (this._kind) {
      case Kind.Boolean:
      case Kind.Null:
      case Kind.Number:
      case Kind.String:
      case Kind.Undefined: {
        return true;
      }

      default: {
        return false;
      }
    }
  }

  asBoolean(): boolean {
    switch (this._kind) {
      case Kind.Boolean: return !!this._numberValue;
      case Kind.Null: return false;
      case Kind.Number: return !!this._numberValue;
      case Kind.String: return !!this._stringValue;
      case Kind.Undefined: return false;
      default: throw new Error('Internal error');
    }
  }

  asNumber(): number {
    switch (this._kind) {
      case Kind.Boolean: return this._numberValue;
      case Kind.Null: return 0;
      case Kind.Number: return this._numberValue;
      case Kind.String: return +this._stringValue;
      case Kind.Undefined: return NaN;
      default: throw new Error('Internal error');
    }
  }

  asString(): string {
    switch (this._kind) {
      case Kind.Boolean: return this._numberValue ? 'true' : 'false';
      case Kind.Null: return 'null';
      case Kind.Number: return this._numberValue.toString();
      case Kind.String: return this._stringValue;
      case Kind.Undefined: return 'undefined';
      default: throw new Error('Internal error');
    }
  }
}
