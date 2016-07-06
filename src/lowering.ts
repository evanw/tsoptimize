import * as ts from 'typescript';
import {Kind, Node, Symbol} from './ast';

let NodeFlags = ts.NodeFlags;
let SyntaxKind = ts.SyntaxKind;

export interface KnownSymbols {
  Math: Symbol;
  Math_pow: Symbol;
}

export interface LoweringResult {
  knownSymbols: KnownSymbols;
  modules: Node[];
}

export function lower(program: ts.Program): LoweringResult {
  let checker = program.getTypeChecker();

  function symbolForSymbol(symbol: ts.Symbol): Symbol {
    return (symbol as any).__symbol || ((symbol as any).__symbol = new Symbol(symbol.name));
  }

  function symbolForIdentifier(node: ts.Node): Symbol {
    if (node.kind !== SyntaxKind.Identifier) {
      throw new Error(`Unsupported declaration kind ${SyntaxKind[node.kind]}`);
    }
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol == null) return new Symbol((node as ts.Identifier).text);
    return symbolForSymbol(symbol);
  }

  function visit(node: ts.Node): Node {
    if (node.flags & NodeFlags.Ambient) {
      return Node.createEmpty();
    }

    switch (node.kind) {
      case SyntaxKind.TypeAliasDeclaration: {
        return Node.createEmpty();
      }

      case SyntaxKind.SourceFile: {
        let result = Node.createModule();
        for (let statement of (node as ts.SourceFile).statements) {
          result.appendChild(visit(statement));
        }
        return result;
      }

      case SyntaxKind.Block: {
        let result = Node.createBlock();
        for (let statement of (node as ts.Block).statements) {
          result.appendChild(visit(statement));
        }
        return result;
      }

      case SyntaxKind.BreakStatement: {
        let label = (node as ts.BreakStatement).label;
        return Node.createBreak(label != null ? symbolForIdentifier(label) : null);
      }

      case SyntaxKind.ContinueStatement: {
        let label = (node as ts.ContinueStatement).label;
        return Node.createContinue(label != null ? symbolForIdentifier(label) : null);
      }

      case SyntaxKind.DebuggerStatement: {
        return Node.createDebugger();
      }

      case SyntaxKind.EmptyStatement: {
        return Node.createEmpty();
      }

      case SyntaxKind.ForStatement: {
        let initializer = (node as ts.ForStatement).initializer;
        let condition = (node as ts.ForStatement).condition;
        let incrementor = (node as ts.ForStatement).incrementor;
        let setup = initializer != null ? visit(initializer) : Node.createEmpty();
        let test = condition != null ? visit(condition) : Node.createEmpty();
        let update = incrementor != null ? visit(incrementor) : Node.createEmpty();
        let body = visit((node as ts.ForStatement).statement);
        return Node.createFor(setup, test, update, body);
      }

      case SyntaxKind.ForInStatement: {
        let setup = visit((node as ts.ForInStatement).initializer);
        let value = visit((node as ts.ForInStatement).expression);
        let body = visit((node as ts.ForInStatement).statement);
        if (setup.kind() === Kind.Variables) setup = setup.firstChild().remove();
        return Node.createForIn(setup, value, body);
      }

      case SyntaxKind.FunctionDeclaration: {
        let symbol = symbolForIdentifier((node as ts.FunctionDeclaration).name);
        let body = visit((node as ts.FunctionDeclaration).body);
        let result = Node.createFunction(symbol, body);
        for (let parameter of (node as ts.FunctionDeclaration).parameters) {
          result.appendChild(Node.createVariable(symbolForIdentifier(parameter.name), Node.createUndefined()));
        }
        return result;
      }

      case SyntaxKind.ExpressionStatement: {
        return Node.createExpression(visit((node as ts.ExpressionStatement).expression));
      }

      case SyntaxKind.ThrowStatement: {
        return Node.createThrow(visit((node as ts.ThrowStatement).expression));
      }

      case SyntaxKind.ReturnStatement: {
        let expression = (node as ts.ReturnStatement).expression;
        return Node.createReturn(expression != null ? visit(expression) : Node.createUndefined());
      }

      case SyntaxKind.TryStatement: {
        let tryBlock = (node as ts.TryStatement).tryBlock;
        let catchClause = (node as ts.TryStatement).catchClause;
        let finallyBlock = (node as ts.TryStatement).finallyBlock;
        return Node.createTry(
          visit(tryBlock),
          catchClause != null ? visit(catchClause) : Node.createEmpty(),
          finallyBlock != null ? visit(finallyBlock) : Node.createEmpty()
        );
      }

      case SyntaxKind.CatchClause: {
        let variableDeclaration = (node as ts.CatchClause).variableDeclaration;
        let block = (node as ts.CatchClause).block;
        return Node.createCatch(symbolForIdentifier(variableDeclaration.name), visit(block));
      }

      case SyntaxKind.DoStatement: {
        return Node.createDoWhile(visit((node as ts.DoStatement).statement), visit((node as ts.DoStatement).expression));
      }

      case SyntaxKind.WhileStatement: {
        return Node.createWhile(visit((node as ts.WhileStatement).expression), visit((node as ts.WhileStatement).statement));
      }

      case SyntaxKind.LabeledStatement: {
        return Node.createLabel(symbolForIdentifier((node as ts.LabeledStatement).label), visit((node as ts.LabeledStatement).statement));
      }

      case SyntaxKind.IfStatement: {
        let test = visit((node as ts.IfStatement).expression);
        let whenTrue = visit((node as ts.IfStatement).thenStatement);
        let whenFalse = (node as ts.IfStatement).elseStatement;
        return Node.createIf(test, whenTrue, whenFalse != null ? visit(whenFalse) : Node.createEmpty());
      }

      case SyntaxKind.VariableDeclarationList: {
        let result = Node.createVariables();
        for (let declaration of (node as ts.VariableDeclarationList).declarations) {
          let value = declaration.initializer != null ? visit(declaration.initializer) : Node.createUndefined();
          result.appendChild(Node.createVariable(symbolForIdentifier(declaration.name), value));
        }
        return result;
      }

      case SyntaxKind.VariableStatement: {
        return visit((node as ts.VariableStatement).declarationList);
      }

      case SyntaxKind.Identifier: {
        return Node.createIdentifier(symbolForIdentifier(node));
      }

      case SyntaxKind.ParenthesizedExpression: {
        return visit((node as ts.ParenthesizedExpression).expression);
      }

      case SyntaxKind.ArrayLiteralExpression: {
        let result = Node.createArray();
        for (let element of (node as ts.ArrayLiteralExpression).elements) {
          result.appendChild(visit(element));
        }
        return result;
      }

      case SyntaxKind.ConditionalExpression: {
        return Node.createConditional(
          visit((node as ts.ConditionalExpression).condition),
          visit((node as ts.ConditionalExpression).whenTrue),
          visit((node as ts.ConditionalExpression).whenFalse)
        );
      }

      case SyntaxKind.OmittedExpression: {
        return Node.createUndefined();
      }

      case SyntaxKind.ObjectLiteralExpression: {
        let result = Node.createObject();
        for (let property of (node as ts.ObjectLiteralExpression).properties) {
          let name = property.name;
          let key: Symbol;

          switch (name.kind) {
            case SyntaxKind.Identifier: {
              key = symbolForIdentifier(name);
              break;
            }

            case SyntaxKind.StringLiteral: {
              key = new Symbol((name as ts.StringLiteral).text);
              break;
            }

            default: {
              throw new Error(`Unsupported property name node kind ${SyntaxKind[name.kind]}`);
            }
          }

          switch (property.kind) {
            case SyntaxKind.PropertyAssignment: {
              result.appendChild(Node.createProperty(key, visit((property as ts.PropertyAssignment).initializer)));
              break;
            }

            case SyntaxKind.ShorthandPropertyAssignment: {
              result.appendChild(Node.createProperty(key, visit((property as ts.ShorthandPropertyAssignment).name)));
              break;
            }

            default: {
              throw new Error(`Unsupported property node kind ${SyntaxKind[property.kind]}`);
            }
          }
        }
        return result;
      }

      case SyntaxKind.NullKeyword: {
        return Node.createNull();
      }

      case SyntaxKind.ThisKeyword: {
        return Node.createThis();
      }

      case SyntaxKind.StringLiteral: {
        return Node.createString((node as ts.StringLiteral).text);
      }

      case SyntaxKind.NumericLiteral: {
        return Node.createNumber(+(node as ts.LiteralExpression).text);
      }

      case SyntaxKind.FalseKeyword: {
        return Node.createBoolean(false);
      }

      case SyntaxKind.TrueKeyword: {
        return Node.createBoolean(true);
      }

      case SyntaxKind.ElementAccessExpression: {
        return Node.createIndex(
          visit((node as ts.ElementAccessExpression).expression),
          visit((node as ts.ElementAccessExpression).argumentExpression)
        );
      }

      case SyntaxKind.PropertyAccessExpression: {
        return Node.createMember(
          visit((node as ts.PropertyAccessExpression).expression),
          symbolForIdentifier((node as ts.PropertyAccessExpression).name)
        );
      }

      case SyntaxKind.NewExpression: {
        let result = Node.createNew(visit((node as ts.NewExpression).expression));
        for (let argument of (node as ts.NewExpression).arguments) {
          result.appendChild(visit(argument));
        }
        return result;
      }

      case SyntaxKind.AsExpression: {
        return visit((node as ts.AsExpression).expression);
      }

      case SyntaxKind.CallExpression: {
        let result = Node.createCall(visit((node as ts.CallExpression).expression));
        for (let argument of (node as ts.CallExpression).arguments) {
          result.appendChild(visit(argument));
        }
        return result;
      }

      case SyntaxKind.DeleteExpression: {
        return Node.createUnary(Kind.Delete, visit((node as ts.DeleteExpression).expression));
      }

      case SyntaxKind.VoidExpression: {
        return Node.createUnary(Kind.Void, visit((node as ts.VoidExpression).expression));
      }

      case SyntaxKind.TypeOfExpression: {
        return Node.createUnary(Kind.TypeOf, visit((node as ts.TypeOfExpression).expression));
      }

      case SyntaxKind.NoSubstitutionTemplateLiteral: {
        return Node.createString((node as ts.LiteralExpression).text);
      }

      case SyntaxKind.TemplateExpression: {
        let chain = Node.createString((node as ts.TemplateExpression).head.text);
        for (let span of (node as ts.TemplateExpression).templateSpans) {
          chain = Node.createBinary(Kind.Add, chain, visit(span.expression));
          chain = Node.createBinary(Kind.Add, chain, Node.createString(span.literal.text));
        }
        return chain;
      }

      case SyntaxKind.RegularExpressionLiteral: {
        return Node.createRegExp((node as ts.LiteralExpression).text);
      }

      case SyntaxKind.PrefixUnaryExpression: {
        switch ((node as ts.PrefixUnaryExpression).operator) {
          case SyntaxKind.ExclamationToken: {
            return Node.createUnary(Kind.Not, visit((node as ts.PrefixUnaryExpression).operand));
          }

          case SyntaxKind.MinusMinusToken: {
            return Node.createUnary(Kind.PrefixDecrement, visit((node as ts.PrefixUnaryExpression).operand));
          }

          case SyntaxKind.MinusToken: {
            return Node.createUnary(Kind.Negative, visit((node as ts.PrefixUnaryExpression).operand));
          }

          case SyntaxKind.PlusPlusToken: {
            return Node.createUnary(Kind.PrefixIncrement, visit((node as ts.PrefixUnaryExpression).operand));
          }

          case SyntaxKind.PlusToken: {
            return Node.createUnary(Kind.Positive, visit((node as ts.PrefixUnaryExpression).operand));
          }

          case SyntaxKind.TildeToken: {
            return Node.createUnary(Kind.Complement, visit((node as ts.PrefixUnaryExpression).operand));
          }

          default: {
            throw new Error(`Unsupported prefix unary expression kind ${SyntaxKind[(node as ts.PrefixUnaryExpression).operator]}`);
          }
        }
      }

      case SyntaxKind.PostfixUnaryExpression: {
        switch ((node as ts.PostfixUnaryExpression).operator) {
          case SyntaxKind.MinusMinusToken: {
            return Node.createUnary(Kind.PostfixDecrement, visit((node as ts.PostfixUnaryExpression).operand));
          }

          case SyntaxKind.PlusPlusToken: {
            return Node.createUnary(Kind.PostfixIncrement, visit((node as ts.PostfixUnaryExpression).operand));
          }

          default: {
            throw new Error(`Unsupported postfix unary expression kind ${SyntaxKind[(node as ts.PostfixUnaryExpression).operator]}`);
          }
        }
      }

      case SyntaxKind.BinaryExpression: {
        switch ((node as ts.BinaryExpression).operatorToken.kind) {
          case SyntaxKind.AsteriskAsteriskToken: {
            let mathPow = Node.createMember(Node.createIdentifier(knownSymbols.Math), knownSymbols.Math_pow);
            return Node.createCall(mathPow).appendChild(visit((node as ts.BinaryExpression).left)).appendChild(visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.CommaToken: {
            let left = visit((node as ts.BinaryExpression).left);
            if (left.kind() !== Kind.Sequence) left = Node.createSequence().appendChild(left);
            return left.appendChild(visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.PlusToken: {
            return Node.createBinary(Kind.Add, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.MinusToken: {
            return Node.createBinary(Kind.Subtract, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.AsteriskToken: {
            return Node.createBinary(Kind.Multiply, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.SlashToken: {
            return Node.createBinary(Kind.Divide, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.PercentToken: {
            return Node.createBinary(Kind.Remainder, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.AmpersandToken: {
            return Node.createBinary(Kind.BitwiseAnd, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.BarToken: {
            return Node.createBinary(Kind.BitwiseOr, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.CaretToken: {
            return Node.createBinary(Kind.BitwiseXor, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.AmpersandAmpersandToken: {
            return Node.createBinary(Kind.LogicalAnd, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.BarBarToken: {
            return Node.createBinary(Kind.LogicalOr, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.LessThanLessThanToken: {
            return Node.createBinary(Kind.ShiftLeft, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.GreaterThanGreaterThanToken: {
            return Node.createBinary(Kind.ShiftRight, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.GreaterThanGreaterThanGreaterThanToken: {
            return Node.createBinary(Kind.ShiftRightUnsigned, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.EqualsEqualsToken: {
            return Node.createBinary(Kind.Equal, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.EqualsEqualsEqualsToken: {
            return Node.createBinary(Kind.EqualStrict, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.ExclamationEqualsToken: {
            return Node.createBinary(Kind.NotEqual, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.ExclamationEqualsEqualsToken: {
            return Node.createBinary(Kind.NotEqualStrict, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.LessThanToken: {
            return Node.createBinary(Kind.LessThan, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.LessThanEqualsToken: {
            return Node.createBinary(Kind.LessThanEqual, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.GreaterThanToken: {
            return Node.createBinary(Kind.GreaterThan, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.GreaterThanEqualsToken: {
            return Node.createBinary(Kind.GreaterThanEqual, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.EqualsToken: {
            return Node.createBinary(Kind.Assign, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.PlusEqualsToken: {
            return Node.createBinary(Kind.AssignAdd, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.MinusEqualsToken: {
            return Node.createBinary(Kind.AssignSubtract, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.AsteriskEqualsToken: {
            return Node.createBinary(Kind.AssignMultiply, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.SlashEqualsToken: {
            return Node.createBinary(Kind.AssignDivide, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.PercentEqualsToken: {
            return Node.createBinary(Kind.AssignRemainder, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.AmpersandEqualsToken: {
            return Node.createBinary(Kind.AssignBitwiseAnd, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.BarEqualsToken: {
            return Node.createBinary(Kind.AssignBitwiseOr, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.CaretEqualsToken: {
            return Node.createBinary(Kind.AssignBitwiseXor, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.LessThanLessThanEqualsToken: {
            return Node.createBinary(Kind.AssignShiftLeft, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.GreaterThanGreaterThanEqualsToken: {
            return Node.createBinary(Kind.AssignShiftRight, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken: {
            return Node.createBinary(Kind.AssignShiftRightUnsigned, visit((node as ts.BinaryExpression).left), visit((node as ts.BinaryExpression).right));
          }

          default: {
            throw new Error(`Unsupported binary expression kind ${SyntaxKind[(node as ts.BinaryExpression).operatorToken.kind]}`);
          }
        }
      }

      default: {
        throw new Error(`Unsupported node kind ${SyntaxKind[node.kind]}`);
      }
    }
  }

  let sourceFiles = program.getSourceFiles();
  let modules: Node[] = [];
  let knownSymbols: KnownSymbols = {
    Math: null,
    Math_pow: null,
  };

  if (!sourceFiles.length) {
    return {knownSymbols, modules};
  }

  // Scan interfaces
  for (let symbol of checker.getSymbolsInScope(sourceFiles[0], ts.SymbolFlags.Interface)) {
    if (symbol.name === 'Math') {
      knownSymbols.Math = symbolForSymbol(symbol);
      knownSymbols.Math_pow = symbolForSymbol(symbol.members['pow']);
      break;
    }
  }

  // Then lower non-declarations
  for (let sourceFile of sourceFiles) {
    if (!(sourceFile.flags & NodeFlags.DeclarationFile)) {
      modules.push(visit(sourceFile));
    }
  }

  return {knownSymbols, modules};
}
