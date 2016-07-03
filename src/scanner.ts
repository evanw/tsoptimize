import {Kind, Node, Symbol} from './ast';

class ScanContext {
  private _symbols: {[id: number]: Symbol} = {};

  forEachSymbol(callback: (symbol: Symbol) => void): void {
    let symbols = this._symbols;
    for (var id in symbols) {
      callback(symbols[id]);
    }
  }

  scan(node: Node): void {
    if (Kind.isUnaryAssign(node.kind())) {
      this._recordWrite(node, node.unaryValue());
      return;
    }

    if (Kind.isBinaryAssign(node.kind())) {
      this._recordWrite(node, node.binaryLeft());
      this.scan(node.binaryRight());
      return;
    }

    for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
      this.scan(child);
    }

    switch (node.kind()) {
      case Kind.Identifier: {
        let symbol = node.identifierSymbol();
        symbol.recordRead(node);
        this._recordSymbol(symbol);
        break;
      }

      case Kind.Function: {
        let symbol = node.functionSymbol();
        symbol.recordWrite(node);
        this._recordSymbol(symbol);
        break;
      }

      case Kind.Property: {
        let symbol = node.propertyKey();
        symbol.recordWrite(node);
        this._recordSymbol(symbol);
        break;
      }

      case Kind.Variable: {
        let symbol = node.propertyKey();
        symbol.recordWrite(node);
        this._recordSymbol(symbol);
        break;
      }
    }
  }

  private _recordSymbol(symbol: Symbol): void {
    let id = symbol.id();
    if (this._symbols[id] !== symbol) {
      this._symbols[id] = symbol;
    }
  }

  private _recordWrite(parent: Node, target: Node): void {
    switch (target.kind()) {
      case Kind.Identifier: {
        target.identifierSymbol().recordWrite(parent);
        break;
      }

      case Kind.Member: {
        this.scan(target.memberValue());
        target.memberSymbol().recordWrite(parent);
        break;
      }

      default: {
        this.scan(target);
        break;
      }
    }
  }
}
