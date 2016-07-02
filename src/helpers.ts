import * as fs from 'fs';
import * as ts from 'typescript';

let SyntaxKind = ts.SyntaxKind;

// Avoid the extremely inefficient behavior of the TypeScript AST where numbers
// are encoded as strings in LiteralExpression instead of just using numbers
export interface NumericLiteral extends ts.LiteralExpression {
  value: number;
}

var lib_d_ts: string = null;

export function createProgram(files: {[path: string]: string}, options: ts.CompilerOptions): ts.Program {
  var fileNames = Object.keys(files);
  var clone: {[path: string]: string} = Object.create(null);
  fileNames.forEach(fileName => clone[fileName] = files[fileName]);
  clone['lib.d.ts'] = lib_d_ts || (lib_d_ts = fs.readFileSync(__dirname + '/../node_modules/typescript/lib/lib.d.ts', 'utf8'));
  files = clone;

  var fileExists = (fileName: string) => fileName in files;
  var readFile = (fileName: string) => files[fileName];
  var host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (fileName in files) return ts.createSourceFile(fileName, files[fileName], languageVersion);
    },
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: (fileName, contents) => files[fileName] = contents,
    getCurrentDirectory: () => '.',
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => '\n',
    useCaseSensitiveFileNames: () => true,
    fileExists,
    readFile,
    resolveModuleNames: (moduleNames, containingFile) => {
      return moduleNames.map(moduleName => {
        var result = ts.resolveModuleName(moduleName, containingFile, options, {fileExists, readFile});
        if (result.resolvedModule) return result.resolvedModule;
      });
    },
  };

  return ts.createProgram(fileNames, options, host);
}

function mapReplaceChildren(nodes: ts.NodeArray<ts.Node>, cb: (node: ts.Node) => ts.Node): ts.Node[] {
  if (!nodes) return null;
  var result: ts.Node[] = [];
  for (var node of nodes) {
    result.push(cb(node));
  }
  return result as ts.NodeArray<ts.Node>;
}

export function replaceChildren(node: ts.Node, cb: (node: ts.Node) => ts.Node): void {
  switch (node.kind) {
    case SyntaxKind.QualifiedName: {
      (node as ts.QualifiedName).left = cb((node as ts.QualifiedName).left) as any;
      (node as ts.QualifiedName).right = cb((node as ts.QualifiedName).right) as any;
      break;
    }

    case SyntaxKind.TypeParameter: {
      (node as ts.TypeParameterDeclaration).name = cb((node as ts.TypeParameterDeclaration).name) as any;
      (node as ts.TypeParameterDeclaration).constraint = cb((node as ts.TypeParameterDeclaration).constraint) as any;
      (node as ts.TypeParameterDeclaration).expression = cb((node as ts.TypeParameterDeclaration).expression) as any;
      break;
    }

    case SyntaxKind.ShorthandPropertyAssignment: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ShorthandPropertyAssignment).name = cb((node as ts.ShorthandPropertyAssignment).name) as any;
      (node as ts.ShorthandPropertyAssignment).questionToken = cb((node as ts.ShorthandPropertyAssignment).questionToken);
      (node as ts.ShorthandPropertyAssignment).equalsToken = cb((node as ts.ShorthandPropertyAssignment).equalsToken);
      (node as ts.ShorthandPropertyAssignment).objectAssignmentInitializer = cb((node as ts.ShorthandPropertyAssignment).objectAssignmentInitializer) as any;
      break;
    }

    case SyntaxKind.Parameter:
    case SyntaxKind.PropertyDeclaration:
    case SyntaxKind.PropertySignature:
    case SyntaxKind.PropertyAssignment:
    case SyntaxKind.VariableDeclaration:
    case SyntaxKind.BindingElement: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.VariableLikeDeclaration).propertyName = cb((node as ts.VariableLikeDeclaration).propertyName) as any;
      (node as ts.VariableLikeDeclaration).dotDotDotToken = cb((node as ts.VariableLikeDeclaration).dotDotDotToken);
      (node as ts.VariableLikeDeclaration).name = cb((node as ts.VariableLikeDeclaration).name) as any;
      (node as ts.VariableLikeDeclaration).questionToken = cb((node as ts.VariableLikeDeclaration).questionToken);
      (node as ts.VariableLikeDeclaration).type = cb((node as ts.VariableLikeDeclaration).type) as any;
      (node as ts.VariableLikeDeclaration).initializer = cb((node as ts.VariableLikeDeclaration).initializer) as any;
      break;
    }

    case SyntaxKind.FunctionType:
    case SyntaxKind.ConstructorType:
    case SyntaxKind.CallSignature:
    case SyntaxKind.ConstructSignature:
    case SyntaxKind.IndexSignature: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.SignatureDeclaration).typeParameters = mapReplaceChildren((node as ts.SignatureDeclaration).typeParameters, cb) as any;
      (node as ts.SignatureDeclaration).parameters = mapReplaceChildren((node as ts.SignatureDeclaration).parameters, cb) as any;
      (node as ts.SignatureDeclaration).type = cb((node as ts.SignatureDeclaration).type) as any;
      break;
    }

    case SyntaxKind.MethodDeclaration:
    case SyntaxKind.MethodSignature:
    case SyntaxKind.Constructor:
    case SyntaxKind.GetAccessor:
    case SyntaxKind.SetAccessor:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.ArrowFunction: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.FunctionLikeDeclaration).asteriskToken = cb((node as ts.FunctionLikeDeclaration).asteriskToken);
      (node as ts.FunctionLikeDeclaration).name = cb((node as ts.FunctionLikeDeclaration).name) as any;
      (node as ts.FunctionLikeDeclaration).questionToken = cb((node as ts.FunctionLikeDeclaration).questionToken);
      (node as ts.FunctionLikeDeclaration).typeParameters = mapReplaceChildren((node as ts.FunctionLikeDeclaration).typeParameters, cb) as any;
      (node as ts.FunctionLikeDeclaration).parameters = mapReplaceChildren((node as ts.FunctionLikeDeclaration).parameters, cb) as any;
      (node as ts.FunctionLikeDeclaration).type = cb((node as ts.FunctionLikeDeclaration).type) as any;
      (node as ts.ArrowFunction).equalsGreaterThanToken = cb((node as ts.ArrowFunction).equalsGreaterThanToken);
      (node as ts.FunctionLikeDeclaration).body = cb((node as ts.FunctionLikeDeclaration).body) as any;
      break;
    }

    case SyntaxKind.TypeReference: {
      (node as ts.TypeReferenceNode).typeName = cb((node as ts.TypeReferenceNode).typeName) as any;
      (node as ts.TypeReferenceNode).typeArguments = mapReplaceChildren((node as ts.TypeReferenceNode).typeArguments, cb) as any;
      break;
    }

    case SyntaxKind.TypePredicate: {
      (node as ts.TypePredicateNode).parameterName = cb((node as ts.TypePredicateNode).parameterName) as any;
      (node as ts.TypePredicateNode).type = cb((node as ts.TypePredicateNode).type) as any;
      break;
    }

    case SyntaxKind.TypeQuery: {
      (node as ts.TypeQueryNode).exprName = cb((node as ts.TypeQueryNode).exprName) as any;
      break;
    }

    case SyntaxKind.TypeLiteral: {
      (node as ts.TypeLiteralNode).members = mapReplaceChildren((node as ts.TypeLiteralNode).members, cb) as any;
      break;
    }

    case SyntaxKind.ArrayType: {
      (node as ts.ArrayTypeNode).elementType = cb((node as ts.ArrayTypeNode).elementType) as any;
      break;
    }

    case SyntaxKind.TupleType: {
      (node as ts.TupleTypeNode).elementTypes = mapReplaceChildren((node as ts.TupleTypeNode).elementTypes, cb) as any;
      break;
    }

    case SyntaxKind.UnionType:
    case SyntaxKind.IntersectionType: {
      (node as ts.UnionOrIntersectionTypeNode).types = mapReplaceChildren((node as ts.UnionOrIntersectionTypeNode).types, cb) as any;
      break;
    }

    case SyntaxKind.ParenthesizedType: {
      (node as ts.ParenthesizedTypeNode).type = cb((node as ts.ParenthesizedTypeNode).type) as any;
      break;
    }

    case SyntaxKind.ObjectBindingPattern:
    case SyntaxKind.ArrayBindingPattern: {
      (node as ts.BindingPattern).elements = mapReplaceChildren((node as ts.BindingPattern).elements, cb) as any;
      break;
    }

    case SyntaxKind.ArrayLiteralExpression: {
      (node as ts.ArrayLiteralExpression).elements = mapReplaceChildren((node as ts.ArrayLiteralExpression).elements, cb) as any;
      break;
    }

    case SyntaxKind.ObjectLiteralExpression: {
      (node as ts.ObjectLiteralExpression).properties = mapReplaceChildren((node as ts.ObjectLiteralExpression).properties, cb) as any;
      break;
    }

    case SyntaxKind.PropertyAccessExpression: {
      (node as ts.PropertyAccessExpression).expression = cb((node as ts.PropertyAccessExpression).expression) as any;
      (node as ts.PropertyAccessExpression).name = cb((node as ts.PropertyAccessExpression).name) as any;
      break;
    }

    case SyntaxKind.ElementAccessExpression: {
      (node as ts.ElementAccessExpression).expression = cb((node as ts.ElementAccessExpression).expression) as any;
      (node as ts.ElementAccessExpression).argumentExpression = cb((node as ts.ElementAccessExpression).argumentExpression) as any;
      break;
    }

    case SyntaxKind.CallExpression:
    case SyntaxKind.NewExpression: {
      (node as ts.CallExpression).expression = cb((node as ts.CallExpression).expression) as any;
      (node as ts.CallExpression).typeArguments = mapReplaceChildren((node as ts.CallExpression).typeArguments, cb) as any;
      (node as ts.CallExpression).arguments = mapReplaceChildren((node as ts.CallExpression).arguments, cb) as any;
      break;
    }

    case SyntaxKind.TaggedTemplateExpression: {
      (node as ts.TaggedTemplateExpression).tag = cb((node as ts.TaggedTemplateExpression).tag) as any;
      (node as ts.TaggedTemplateExpression).template = cb((node as ts.TaggedTemplateExpression).template) as any;
      break;
    }

    case SyntaxKind.TypeAssertionExpression: {
      (node as ts.TypeAssertion).type = cb((node as ts.TypeAssertion).type) as any;
      (node as ts.TypeAssertion).expression = cb((node as ts.TypeAssertion).expression) as any;
      break;
    }

    case SyntaxKind.ParenthesizedExpression: {
      (node as ts.ParenthesizedExpression).expression = cb((node as ts.ParenthesizedExpression).expression) as any;
      break;
    }

    case SyntaxKind.DeleteExpression: {
      (node as ts.DeleteExpression).expression = cb((node as ts.DeleteExpression).expression) as any;
      break;
    }

    case SyntaxKind.TypeOfExpression: {
      (node as ts.TypeOfExpression).expression = cb((node as ts.TypeOfExpression).expression) as any;
      break;
    }

    case SyntaxKind.VoidExpression: {
      (node as ts.VoidExpression).expression = cb((node as ts.VoidExpression).expression) as any;
      break;
    }

    case SyntaxKind.PrefixUnaryExpression: {
      (node as ts.PrefixUnaryExpression).operand = cb((node as ts.PrefixUnaryExpression).operand) as any;
      break;
    }

    case SyntaxKind.YieldExpression: {
      (node as ts.YieldExpression).asteriskToken = cb((node as ts.YieldExpression).asteriskToken);
      (node as ts.YieldExpression).expression = cb((node as ts.YieldExpression).expression) as any;
      break;
    }

    case SyntaxKind.AwaitExpression: {
      (node as ts.AwaitExpression).expression = cb((node as ts.AwaitExpression).expression) as any;
      break;
    }

    case SyntaxKind.PostfixUnaryExpression: {
      (node as ts.PostfixUnaryExpression).operand = cb((node as ts.PostfixUnaryExpression).operand) as any;
      break;
    }

    case SyntaxKind.BinaryExpression: {
      (node as ts.BinaryExpression).left = cb((node as ts.BinaryExpression).left) as any;
      (node as ts.BinaryExpression).operatorToken = cb((node as ts.BinaryExpression).operatorToken);
      (node as ts.BinaryExpression).right = cb((node as ts.BinaryExpression).right) as any;
      break;
    }

    case SyntaxKind.AsExpression: {
      (node as ts.AsExpression).expression = cb((node as ts.AsExpression).expression) as any;
      (node as ts.AsExpression).type = cb((node as ts.AsExpression).type) as any;
      break;
    }

    case SyntaxKind.ConditionalExpression: {
      (node as ts.ConditionalExpression).condition = cb((node as ts.ConditionalExpression).condition) as any;
      (node as ts.ConditionalExpression).questionToken = cb((node as ts.ConditionalExpression).questionToken);
      (node as ts.ConditionalExpression).whenTrue = cb((node as ts.ConditionalExpression).whenTrue) as any;
      (node as ts.ConditionalExpression).colonToken = cb((node as ts.ConditionalExpression).colonToken);
      (node as ts.ConditionalExpression).whenFalse = cb((node as ts.ConditionalExpression).whenFalse) as any;
      break;
    }

    case SyntaxKind.SpreadElementExpression: {
      (node as ts.SpreadElementExpression).expression = cb((node as ts.SpreadElementExpression).expression) as any;
      break;
    }

    case SyntaxKind.Block:
    case SyntaxKind.ModuleBlock: {
      (node as ts.Block).statements = mapReplaceChildren((node as ts.Block).statements, cb) as any;
      break;
    }

    case SyntaxKind.SourceFile: {
      (node as ts.SourceFile).statements = mapReplaceChildren((node as ts.SourceFile).statements, cb) as any;
      (node as ts.SourceFile).endOfFileToken = cb((node as ts.SourceFile).endOfFileToken);
      break;
    }

    case SyntaxKind.VariableStatement: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.VariableStatement).declarationList = cb((node as ts.VariableStatement).declarationList) as any;
      break;
    }

    case SyntaxKind.VariableDeclarationList: {
      (node as ts.VariableDeclarationList).declarations = mapReplaceChildren((node as ts.VariableDeclarationList).declarations, cb) as any;
      break;
    }

    case SyntaxKind.ExpressionStatement: {
      (node as ts.ExpressionStatement).expression = cb((node as ts.ExpressionStatement).expression) as any;
      break;
    }

    case SyntaxKind.IfStatement: {
      (node as ts.IfStatement).expression = cb((node as ts.IfStatement).expression) as any;
      (node as ts.IfStatement).thenStatement = cb((node as ts.IfStatement).thenStatement) as any;
      (node as ts.IfStatement).elseStatement = cb((node as ts.IfStatement).elseStatement) as any;
      break;
    }

    case SyntaxKind.DoStatement: {
      (node as ts.DoStatement).statement = cb((node as ts.DoStatement).statement) as any;
      (node as ts.DoStatement).expression = cb((node as ts.DoStatement).expression) as any;
      break;
    }

    case SyntaxKind.WhileStatement: {
      (node as ts.WhileStatement).expression = cb((node as ts.WhileStatement).expression) as any;
      (node as ts.WhileStatement).statement = cb((node as ts.WhileStatement).statement) as any;
      break;
    }

    case SyntaxKind.ForStatement: {
      (node as ts.ForStatement).initializer = cb((node as ts.ForStatement).initializer) as any;
      (node as ts.ForStatement).condition = cb((node as ts.ForStatement).condition) as any;
      (node as ts.ForStatement).incrementor = cb((node as ts.ForStatement).incrementor) as any;
      (node as ts.ForStatement).statement = cb((node as ts.ForStatement).statement) as any;
      break;
    }

    case SyntaxKind.ForInStatement: {
      (node as ts.ForInStatement).initializer = cb((node as ts.ForInStatement).initializer) as any;
      (node as ts.ForInStatement).expression = cb((node as ts.ForInStatement).expression) as any;
      (node as ts.ForInStatement).statement = cb((node as ts.ForInStatement).statement) as any;
      break;
    }

    case SyntaxKind.ForOfStatement: {
      (node as ts.ForOfStatement).initializer = cb((node as ts.ForOfStatement).initializer) as any;
      (node as ts.ForOfStatement).expression = cb((node as ts.ForOfStatement).expression) as any;
      (node as ts.ForOfStatement).statement = cb((node as ts.ForOfStatement).statement) as any;
      break;
    }

    case SyntaxKind.ContinueStatement:
    case SyntaxKind.BreakStatement: {
      (node as ts.BreakOrContinueStatement).label = cb((node as ts.BreakOrContinueStatement).label) as any;
      break;
    }

    case SyntaxKind.ReturnStatement: {
      (node as ts.ReturnStatement).expression = cb((node as ts.ReturnStatement).expression) as any;
      break;
    }

    case SyntaxKind.WithStatement: {
      (node as ts.WithStatement).expression = cb((node as ts.WithStatement).expression) as any;
      (node as ts.WithStatement).statement = cb((node as ts.WithStatement).statement) as any;
      break;
    }

    case SyntaxKind.SwitchStatement: {
      (node as ts.SwitchStatement).expression = cb((node as ts.SwitchStatement).expression) as any;
      (node as ts.SwitchStatement).caseBlock = cb((node as ts.SwitchStatement).caseBlock) as any;
      break;
    }

    case SyntaxKind.CaseBlock: {
      (node as ts.CaseBlock).clauses = mapReplaceChildren((node as ts.CaseBlock).clauses, cb) as any;
      break;
    }

    case SyntaxKind.CaseClause: {
      (node as ts.CaseClause).expression = cb((node as ts.CaseClause).expression) as any;
      (node as ts.CaseClause).statements = mapReplaceChildren((node as ts.CaseClause).statements, cb) as any;
      break;
    }

    case SyntaxKind.DefaultClause: {
      (node as ts.DefaultClause).statements = mapReplaceChildren((node as ts.DefaultClause).statements, cb) as any;
      break;
    }

    case SyntaxKind.LabeledStatement: {
      (node as ts.LabeledStatement).label = cb((node as ts.LabeledStatement).label) as any;
      (node as ts.LabeledStatement).statement = cb((node as ts.LabeledStatement).statement) as any;
      break;
    }

    case SyntaxKind.ThrowStatement: {
      (node as ts.ThrowStatement).expression = cb((node as ts.ThrowStatement).expression) as any;
      break;
    }

    case SyntaxKind.TryStatement: {
      (node as ts.TryStatement).tryBlock = cb((node as ts.TryStatement).tryBlock) as any;
      (node as ts.TryStatement).catchClause = cb((node as ts.TryStatement).catchClause) as any;
      (node as ts.TryStatement).finallyBlock = cb((node as ts.TryStatement).finallyBlock) as any;
      break;
    }

    case SyntaxKind.CatchClause: {
      (node as ts.CatchClause).variableDeclaration = cb((node as ts.CatchClause).variableDeclaration) as any;
      (node as ts.CatchClause).block = cb((node as ts.CatchClause).block) as any;
      break;
    }

    case SyntaxKind.Decorator: {
      (node as ts.Decorator).expression = cb((node as ts.Decorator).expression) as any;
      break;
    }

    case SyntaxKind.ClassDeclaration:
    case SyntaxKind.ClassExpression: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ClassLikeDeclaration).name = cb((node as ts.ClassLikeDeclaration).name) as any;
      (node as ts.ClassLikeDeclaration).typeParameters = mapReplaceChildren((node as ts.ClassLikeDeclaration).typeParameters, cb) as any;
      (node as ts.ClassLikeDeclaration).heritageClauses = mapReplaceChildren((node as ts.ClassLikeDeclaration).heritageClauses, cb) as any;
      (node as ts.ClassLikeDeclaration).members = mapReplaceChildren((node as ts.ClassLikeDeclaration).members, cb) as any;
      break;
    }

    case SyntaxKind.InterfaceDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.InterfaceDeclaration).name = cb((node as ts.InterfaceDeclaration).name) as any;
      (node as ts.InterfaceDeclaration).typeParameters = mapReplaceChildren((node as ts.InterfaceDeclaration).typeParameters, cb) as any;
      (node as ts.ClassDeclaration).heritageClauses = mapReplaceChildren((node as ts.ClassDeclaration).heritageClauses, cb) as any;
      (node as ts.InterfaceDeclaration).members = mapReplaceChildren((node as ts.InterfaceDeclaration).members, cb) as any;
      break;
    }

    case SyntaxKind.TypeAliasDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.TypeAliasDeclaration).name = cb((node as ts.TypeAliasDeclaration).name) as any;
      (node as ts.TypeAliasDeclaration).typeParameters = mapReplaceChildren((node as ts.TypeAliasDeclaration).typeParameters, cb) as any;
      (node as ts.TypeAliasDeclaration).type = cb((node as ts.TypeAliasDeclaration).type) as any;
      break;
    }

    case SyntaxKind.EnumDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.EnumDeclaration).name = cb((node as ts.EnumDeclaration).name) as any;
      (node as ts.EnumDeclaration).members = mapReplaceChildren((node as ts.EnumDeclaration).members, cb) as any;
      break;
    }

    case SyntaxKind.EnumMember: {
      (node as ts.EnumMember).name = cb((node as ts.EnumMember).name) as any;
      (node as ts.EnumMember).initializer = cb((node as ts.EnumMember).initializer) as any;
      break;
    }

    case SyntaxKind.ModuleDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ModuleDeclaration).name = cb((node as ts.ModuleDeclaration).name) as any;
      (node as ts.ModuleDeclaration).body = cb((node as ts.ModuleDeclaration).body) as any;
      break;
    }

    case SyntaxKind.ImportEqualsDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ImportEqualsDeclaration).name = cb((node as ts.ImportEqualsDeclaration).name) as any;
      (node as ts.ImportEqualsDeclaration).moduleReference = cb((node as ts.ImportEqualsDeclaration).moduleReference) as any;
      break;
    }

    case SyntaxKind.ImportDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ImportDeclaration).importClause = cb((node as ts.ImportDeclaration).importClause) as any;
      (node as ts.ImportDeclaration).moduleSpecifier = cb((node as ts.ImportDeclaration).moduleSpecifier) as any;
      break;
    }

    case SyntaxKind.ImportClause: {
      (node as ts.ImportClause).name = cb((node as ts.ImportClause).name) as any;
      (node as ts.ImportClause).namedBindings = cb((node as ts.ImportClause).namedBindings) as any;
      break;
    }

    case SyntaxKind.NamespaceImport: {
      (node as ts.NamespaceImport).name = cb((node as ts.NamespaceImport).name) as any;
      break;
    }

    case SyntaxKind.NamedImports:
    case SyntaxKind.NamedExports: {
      (node as ts.NamedImportsOrExports).elements = mapReplaceChildren((node as ts.NamedImportsOrExports).elements, cb) as any;
      break;
    }

    case SyntaxKind.ExportDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ExportDeclaration).exportClause = cb((node as ts.ExportDeclaration).exportClause) as any;
      (node as ts.ExportDeclaration).moduleSpecifier = cb((node as ts.ExportDeclaration).moduleSpecifier) as any;
      break;
    }

    case SyntaxKind.ImportSpecifier:
    case SyntaxKind.ExportSpecifier: {
      (node as ts.ImportOrExportSpecifier).propertyName = cb((node as ts.ImportOrExportSpecifier).propertyName) as any;
      (node as ts.ImportOrExportSpecifier).name = cb((node as ts.ImportOrExportSpecifier).name) as any;
      break;
    }

    case SyntaxKind.ExportAssignment: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      node.modifiers = mapReplaceChildren(node.modifiers, cb) as any;
      (node as ts.ExportAssignment).expression = cb((node as ts.ExportAssignment).expression) as any;
      break;
    }

    case SyntaxKind.TemplateExpression: {
      (node as ts.TemplateExpression).head = cb((node as ts.TemplateExpression).head) as any;
      (node as ts.TemplateExpression).templateSpans = mapReplaceChildren((node as ts.TemplateExpression).templateSpans, cb) as any;
      break;
    }

    case SyntaxKind.TemplateSpan: {
      (node as ts.TemplateSpan).expression = cb((node as ts.TemplateSpan).expression) as any;
      (node as ts.TemplateSpan).literal = cb((node as ts.TemplateSpan).literal) as any;
      break;
    }

    case SyntaxKind.ComputedPropertyName: {
      (node as ts.ComputedPropertyName).expression = cb((node as ts.ComputedPropertyName).expression) as any;
      break;
    }

    case SyntaxKind.HeritageClause: {
      (node as ts.HeritageClause).types = mapReplaceChildren((node as ts.HeritageClause).types, cb) as any;
      break;
    }

    case SyntaxKind.ExpressionWithTypeArguments: {
      (node as ts.ExpressionWithTypeArguments).expression = cb((node as ts.ExpressionWithTypeArguments).expression) as any;
      (node as ts.ExpressionWithTypeArguments).typeArguments = mapReplaceChildren((node as ts.ExpressionWithTypeArguments).typeArguments, cb) as any;
      break;
    }

    case SyntaxKind.ExternalModuleReference: {
      (node as ts.ExternalModuleReference).expression = cb((node as ts.ExternalModuleReference).expression) as any;
      break;
    }

    case SyntaxKind.MissingDeclaration: {
      node.decorators = mapReplaceChildren(node.decorators, cb) as any;
      break;
    }

    case SyntaxKind.JsxElement: {
      (node as ts.JsxElement).openingElement = cb((node as ts.JsxElement).openingElement) as any;
      (node as ts.JsxElement).children = mapReplaceChildren((node as ts.JsxElement).children, cb) as any;
      (node as ts.JsxElement).closingElement = cb((node as ts.JsxElement).closingElement) as any;
      break;
    }

    case SyntaxKind.JsxSelfClosingElement:
    case SyntaxKind.JsxOpeningElement: {
      (node as ts.JsxOpeningLikeElement).tagName = cb((node as ts.JsxOpeningLikeElement).tagName) as any;
      (node as ts.JsxOpeningLikeElement).attributes = mapReplaceChildren((node as ts.JsxOpeningLikeElement).attributes, cb) as any;
      break;
    }

    case SyntaxKind.JsxAttribute: {
      (node as ts.JsxAttribute).name = cb((node as ts.JsxAttribute).name) as any;
      (node as ts.JsxAttribute).initializer = cb((node as ts.JsxAttribute).initializer) as any;
      break;
    }

    case SyntaxKind.JsxSpreadAttribute: {
      (node as ts.JsxSpreadAttribute).expression = cb((node as ts.JsxSpreadAttribute).expression) as any;
      break;
    }

    case SyntaxKind.JsxExpression: {
      (node as ts.JsxExpression).expression = cb((node as ts.JsxExpression).expression) as any;
      break;
    }

    case SyntaxKind.JsxClosingElement: {
      (node as ts.JsxClosingElement).tagName = cb((node as ts.JsxClosingElement).tagName) as any;
      break;
    }

    case SyntaxKind.JSDocTypeExpression: {
      (node as ts.JSDocTypeExpression).type = cb((node as ts.JSDocTypeExpression).type) as any;
      break;
    }

    case SyntaxKind.JSDocUnionType: {
      (node as ts.JSDocUnionType).types = mapReplaceChildren((node as ts.JSDocUnionType).types, cb) as any;
      break;
    }

    case SyntaxKind.JSDocTupleType: {
      (node as ts.JSDocTupleType).types = mapReplaceChildren((node as ts.JSDocTupleType).types, cb) as any;
      break;
    }

    case SyntaxKind.JSDocArrayType: {
      (node as ts.JSDocArrayType).elementType = cb((node as ts.JSDocArrayType).elementType) as any;
      break;
    }

    case SyntaxKind.JSDocNonNullableType: {
      (node as ts.JSDocNonNullableType).type = cb((node as ts.JSDocNonNullableType).type) as any;
      break;
    }

    case SyntaxKind.JSDocNullableType: {
      (node as ts.JSDocNullableType).type = cb((node as ts.JSDocNullableType).type) as any;
      break;
    }

    case SyntaxKind.JSDocRecordType: {
      (node as ts.JSDocRecordType).members = mapReplaceChildren((node as ts.JSDocRecordType).members, cb) as any;
      break;
    }

    case SyntaxKind.JSDocTypeReference: {
      (node as ts.JSDocTypeReference).name = cb((node as ts.JSDocTypeReference).name) as any;
      (node as ts.JSDocTypeReference).typeArguments = mapReplaceChildren((node as ts.JSDocTypeReference).typeArguments, cb) as any;
      break;
    }

    case SyntaxKind.JSDocOptionalType: {
      (node as ts.JSDocOptionalType).type = cb((node as ts.JSDocOptionalType).type) as any;
      break;
    }

    case SyntaxKind.JSDocFunctionType: {
      (node as ts.JSDocFunctionType).parameters = mapReplaceChildren((node as ts.JSDocFunctionType).parameters, cb) as any;
      (node as ts.JSDocFunctionType).type = cb((node as ts.JSDocFunctionType).type) as any;
      break;
    }

    case SyntaxKind.JSDocVariadicType: {
      (node as ts.JSDocVariadicType).type = cb((node as ts.JSDocVariadicType).type) as any;
      break;
    }

    case SyntaxKind.JSDocConstructorType: {
      (node as ts.JSDocConstructorType).type = cb((node as ts.JSDocConstructorType).type) as any;
      break;
    }

    case SyntaxKind.JSDocThisType: {
      (node as ts.JSDocThisType).type = cb((node as ts.JSDocThisType).type) as any;
      break;
    }

    case SyntaxKind.JSDocRecordMember: {
      (node as ts.JSDocRecordMember).name = cb((node as ts.JSDocRecordMember).name) as any;
      (node as ts.JSDocRecordMember).type = cb((node as ts.JSDocRecordMember).type) as any;
      break;
    }

    case SyntaxKind.JSDocComment: {
      (node as ts.JSDocComment).tags = mapReplaceChildren((node as ts.JSDocComment).tags, cb) as any;
      break;
    }

    case SyntaxKind.JSDocParameterTag: {
      (node as ts.JSDocParameterTag).preParameterName = cb((node as ts.JSDocParameterTag).preParameterName) as any;
      (node as ts.JSDocParameterTag).typeExpression = cb((node as ts.JSDocParameterTag).typeExpression) as any;
      (node as ts.JSDocParameterTag).postParameterName = cb((node as ts.JSDocParameterTag).postParameterName) as any;
      break;
    }

    case SyntaxKind.JSDocReturnTag: {
      (node as ts.JSDocReturnTag).typeExpression = cb((node as ts.JSDocReturnTag).typeExpression) as any;
      break;
    }

    case SyntaxKind.JSDocTypeTag: {
      (node as ts.JSDocTypeTag).typeExpression = cb((node as ts.JSDocTypeTag).typeExpression) as any;
      break;
    }

    case SyntaxKind.JSDocTemplateTag: {
      (node as ts.JSDocTemplateTag).typeParameters = mapReplaceChildren((node as ts.JSDocTemplateTag).typeParameters, cb) as any;
      break;
    }

    case SyntaxKind.AmpersandAmpersandToken:
    case SyntaxKind.AmpersandEqualsToken:
    case SyntaxKind.AmpersandToken:
    case SyntaxKind.AsteriskAsteriskEqualsToken:
    case SyntaxKind.AsteriskAsteriskToken:
    case SyntaxKind.AsteriskEqualsToken:
    case SyntaxKind.AsteriskToken:
    case SyntaxKind.AtToken:
    case SyntaxKind.BarBarToken:
    case SyntaxKind.BarEqualsToken:
    case SyntaxKind.BarToken:
    case SyntaxKind.CaretEqualsToken:
    case SyntaxKind.CaretToken:
    case SyntaxKind.CloseBraceToken:
    case SyntaxKind.CloseBracketToken:
    case SyntaxKind.CloseParenToken:
    case SyntaxKind.ColonToken:
    case SyntaxKind.CommaToken:
    case SyntaxKind.DotDotDotToken:
    case SyntaxKind.DotToken:
    case SyntaxKind.EqualsEqualsEqualsToken:
    case SyntaxKind.EqualsEqualsToken:
    case SyntaxKind.EqualsGreaterThanToken:
    case SyntaxKind.EqualsToken:
    case SyntaxKind.ExclamationEqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsToken:
    case SyntaxKind.ExclamationToken:
    case SyntaxKind.GreaterThanEqualsToken:
    case SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanToken:
    case SyntaxKind.LessThanEqualsToken:
    case SyntaxKind.LessThanLessThanEqualsToken:
    case SyntaxKind.LessThanLessThanToken:
    case SyntaxKind.LessThanSlashToken:
    case SyntaxKind.LessThanToken:
    case SyntaxKind.MinusEqualsToken:
    case SyntaxKind.MinusMinusToken:
    case SyntaxKind.MinusToken:
    case SyntaxKind.OpenBraceToken:
    case SyntaxKind.OpenBracketToken:
    case SyntaxKind.OpenParenToken:
    case SyntaxKind.PercentEqualsToken:
    case SyntaxKind.PercentToken:
    case SyntaxKind.PlusEqualsToken:
    case SyntaxKind.PlusPlusToken:
    case SyntaxKind.PlusToken:
    case SyntaxKind.QuestionToken:
    case SyntaxKind.SemicolonToken:
    case SyntaxKind.SlashEqualsToken:
    case SyntaxKind.SlashToken:
    case SyntaxKind.TildeToken:

    case SyntaxKind.AbstractKeyword:
    case SyntaxKind.AnyKeyword:
    case SyntaxKind.AsKeyword:
    case SyntaxKind.AsyncKeyword:
    case SyntaxKind.AwaitKeyword:
    case SyntaxKind.BooleanKeyword:
    case SyntaxKind.BreakKeyword:
    case SyntaxKind.CaseKeyword:
    case SyntaxKind.CatchKeyword:
    case SyntaxKind.ClassKeyword:
    case SyntaxKind.ConstKeyword:
    case SyntaxKind.ConstructorKeyword:
    case SyntaxKind.ContinueKeyword:
    case SyntaxKind.DebuggerKeyword:
    case SyntaxKind.DeclareKeyword:
    case SyntaxKind.DefaultKeyword:
    case SyntaxKind.DeleteKeyword:
    case SyntaxKind.DoKeyword:
    case SyntaxKind.ElseKeyword:
    case SyntaxKind.EnumKeyword:
    case SyntaxKind.ExportKeyword:
    case SyntaxKind.ExtendsKeyword:
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.FinallyKeyword:
    case SyntaxKind.ForKeyword:
    case SyntaxKind.FromKeyword:
    case SyntaxKind.FunctionKeyword:
    case SyntaxKind.GetKeyword:
    case SyntaxKind.GlobalKeyword:
    case SyntaxKind.IfKeyword:
    case SyntaxKind.ImplementsKeyword:
    case SyntaxKind.ImportKeyword:
    case SyntaxKind.InKeyword:
    case SyntaxKind.InstanceOfKeyword:
    case SyntaxKind.InterfaceKeyword:
    case SyntaxKind.IsKeyword:
    case SyntaxKind.LetKeyword:
    case SyntaxKind.ModuleKeyword:
    case SyntaxKind.NamespaceKeyword:
    case SyntaxKind.NewKeyword:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.NumberKeyword:
    case SyntaxKind.OfKeyword:
    case SyntaxKind.PackageKeyword:
    case SyntaxKind.PrivateKeyword:
    case SyntaxKind.ProtectedKeyword:
    case SyntaxKind.PublicKeyword:
    case SyntaxKind.RequireKeyword:
    case SyntaxKind.ReturnKeyword:
    case SyntaxKind.SetKeyword:
    case SyntaxKind.StaticKeyword:
    case SyntaxKind.StringKeyword:
    case SyntaxKind.SuperKeyword:
    case SyntaxKind.SwitchKeyword:
    case SyntaxKind.SymbolKeyword:
    case SyntaxKind.ThisKeyword:
    case SyntaxKind.ThrowKeyword:
    case SyntaxKind.TrueKeyword:
    case SyntaxKind.TryKeyword:
    case SyntaxKind.TypeKeyword:
    case SyntaxKind.TypeOfKeyword:
    case SyntaxKind.VarKeyword:
    case SyntaxKind.VoidKeyword:
    case SyntaxKind.WhileKeyword:
    case SyntaxKind.WithKeyword:
    case SyntaxKind.YieldKeyword:

    case SyntaxKind.EndOfFileToken:
    case SyntaxKind.FirstLiteralToken:
    case SyntaxKind.Identifier:
    case SyntaxKind.NoSubstitutionTemplateLiteral:
    case SyntaxKind.StringLiteralType:
    case SyntaxKind.ThisType: {
      break;
    }

    default: {
      throw new Error(`Unexpected node kind ${SyntaxKind[node.kind]}`);
    }
  }
}

export function isLiteral(node: ts.Expression): boolean {
  switch (node.kind) {
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword:
    case SyntaxKind.NumericLiteral:
    case SyntaxKind.StringLiteral:
    case SyntaxKind.TrueKeyword: {
      return true;
    }

    default: {
      return false;
    }
  }
}

export function toBoolean(node: ts.Expression): boolean {
  switch (node.kind) {
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword: {
      return false;
    }

    case SyntaxKind.TrueKeyword: {
      return true;
    }

    case SyntaxKind.NumericLiteral: {
      let value = (node as NumericLiteral).value;
      return value != null ? !!value : !!(node as ts.LiteralExpression).text;
    }

    case SyntaxKind.StringLiteral: {
      return !!(node as ts.LiteralExpression).text;
    }

    default: {
      throw new Error(`Unsupported node kind ${node.kind} for toNumber`);
    }
  }
}

export function toNumber(node: ts.Expression): number {
  switch (node.kind) {
    case SyntaxKind.FalseKeyword:
    case SyntaxKind.NullKeyword: {
      return 0;
    }

    case SyntaxKind.TrueKeyword: {
      return 1;
    }

    case SyntaxKind.NumericLiteral: {
      let value = (node as NumericLiteral).value;
      return value != null ? value : +(node as ts.LiteralExpression).text;
    }

    case SyntaxKind.StringLiteral: {
      return +(node as ts.LiteralExpression).text;
    }

    default: {
      throw new Error(`Unsupported node kind ${node.kind} for toNumber`);
    }
  }
}

export function toString(node: ts.Expression): string {
  switch (node.kind) {
    case SyntaxKind.FalseKeyword: {
      return 'false';
    }

    case SyntaxKind.TrueKeyword: {
      return 'true';
    }

    case SyntaxKind.NullKeyword: {
      return 'null';
    }

    case SyntaxKind.NumericLiteral: {
      let value = (node as NumericLiteral).value;
      return value != null ? value.toString() : (node as ts.LiteralExpression).text;
    }

    case SyntaxKind.StringLiteral: {
      return (node as ts.LiteralExpression).text;
    }

    default: {
      throw new Error(`Unsupported node kind ${node.kind} for toString`);
    }
  }
}

export function createBoolean(value: boolean, pos?: number, end?: number): ts.Expression {
  return ts.createNode(value ? SyntaxKind.TrueKeyword : SyntaxKind.FalseKeyword, pos, end) as ts.Expression;
}

export function createNumber(value: number, pos?: number, end?: number): NumericLiteral {
  let node = ts.createNode(SyntaxKind.NumericLiteral, pos, end) as NumericLiteral;
  node.value = value;
  return node;
}

export function createString(value: string, pos?: number, end?: number): ts.StringLiteral {
  let node = ts.createNode(SyntaxKind.NumericLiteral, pos, end) as ts.StringLiteral;
  node.text = value;
  return node;
}
