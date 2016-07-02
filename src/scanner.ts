import * as ts from 'typescript';

let SyntaxKind = ts.SyntaxKind;

export class SymbolInfo {
  reads: ts.Node[] = [];
  writes: ts.Node[] = [];

  constructor(
    public symbol: ts.Symbol
  ) {
  }
}

export class ScanContext {
  private _idForNextSymbol = 0;
  private _info: {[id: number]: SymbolInfo} = [];

  infoForSymbol(symbol: ts.Symbol): SymbolInfo {
    var id = (symbol as any).id;
    if (id == null) (symbol as any).id = id = this._idForNextSymbol++;
    return this._info[id] || (this._info[id] = new SymbolInfo(symbol));
  }

  recordSymbolRead(symbol: ts.Symbol, node: ts.Node): void {
    this.infoForSymbol(symbol).reads.push(node);
  }

  recordSymbolWrite(symbol: ts.Symbol, node: ts.Node): void {
    this.infoForSymbol(symbol).writes.push(node);
  }

  forEachInfo(callback: (info: SymbolInfo) => void): void {
    var info = this._info;
    for (var id in info) {
      callback(info[id]);
    }
  }
}

export function scan(program: ts.Program): ScanContext {
  let context = new ScanContext;
  let checker = program.getTypeChecker();
  let isBinding = false;

  function scan(node: ts.Node): void {
    switch (node.kind) {
      case SyntaxKind.BindingElement: {
        let initializer = (node as ts.BindingElement).initializer;
        scan(initializer);
        return;
      }

      case SyntaxKind.Identifier: {
        let symbol = checker.getSymbolAtLocation(node);
        if (symbol) context.recordSymbolRead(symbol, node);
        break;
      }

      case SyntaxKind.PropertyAccessExpression: {
        let symbol = checker.getSymbolAtLocation(node);
        if (symbol) context.recordSymbolWrite(symbol, node);
        break;
      }
    }

    ts.forEachChild(node, scan);
  }

  for (let sourceFile of program.getSourceFiles()) {
    scan(sourceFile);
  }

  return context;
}
