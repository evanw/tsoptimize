import * as helpers from './helpers';
import * as ts from 'typescript';

let SyntaxKind = ts.SyntaxKind;

export function mangle(program: ts.Program): void {
  let checker = program.getTypeChecker();

  function mangle(node: ts.Node): ts.Node {
    if (!node || node.modifiers && node.modifiers.flags & ts.NodeFlags.Ambient) {
      return node;
    }

    helpers.replaceChildren(node, mangle);

    switch (node.kind) {
      case SyntaxKind.PrefixUnaryExpression: {
        let operand = (node as ts.PrefixUnaryExpression).operand;

        if (helpers.isLiteral(operand)) {
          switch ((node as ts.PrefixUnaryExpression).operator) {
            case SyntaxKind.ExclamationToken: return helpers.createBoolean(!helpers.toBoolean(operand), node.pos, node.end);
            case SyntaxKind.MinusToken: return helpers.createNumber(-helpers.toNumber(operand), node.pos, node.end);
            case SyntaxKind.PlusToken: return helpers.createNumber(helpers.toNumber(operand), node.pos, node.end);
            case SyntaxKind.TildeToken: return helpers.createNumber(~helpers.toNumber(operand), node.pos, node.end);
          }
        }
        break;
      }

      case SyntaxKind.BinaryExpression: {
        let left = (node as ts.BinaryExpression).left;
        let right = (node as ts.BinaryExpression).right;

        if (helpers.isLiteral(left) && helpers.isLiteral(right)) {
          switch ((node as ts.BinaryExpression).operatorToken.kind) {
            case SyntaxKind.PlusToken: {
              if (left.kind == SyntaxKind.StringLiteral || right.kind == SyntaxKind.StringLiteral) {
                return helpers.createString(helpers.toString(left) + helpers.toString(right), node.pos, node.end);
              }
              return helpers.createNumber(helpers.toNumber(left) + helpers.toNumber(right), node.pos, node.end);
            }

            case SyntaxKind.MinusToken: return helpers.createNumber(helpers.toNumber(left) - helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.AsteriskToken: return helpers.createNumber(helpers.toNumber(left) * helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.SlashToken: return helpers.createNumber(helpers.toNumber(left) / helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.PercentToken: return helpers.createNumber(helpers.toNumber(left) % helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.AsteriskAsteriskToken: return helpers.createNumber(helpers.toNumber(left) ** helpers.toNumber(right), node.pos, node.end);

            case SyntaxKind.AmpersandToken: return helpers.createNumber(helpers.toNumber(left) & helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.BarToken: return helpers.createNumber(helpers.toNumber(left) | helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.CaretToken: return helpers.createNumber(helpers.toNumber(left) ^ helpers.toNumber(right), node.pos, node.end);

            case SyntaxKind.LessThanLessThanToken: return helpers.createNumber(helpers.toNumber(left) << helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.GreaterThanGreaterThanToken: return helpers.createNumber(helpers.toNumber(left) >> helpers.toNumber(right), node.pos, node.end);
            case SyntaxKind.GreaterThanGreaterThanGreaterThanToken: return helpers.createNumber(helpers.toNumber(left) >>> helpers.toNumber(right), node.pos, node.end);
          }
        }
        break;
      }
    }

    return node;
  }

  for (let sourceFile of program.getSourceFiles()) {
    mangle(sourceFile);
  }
}
