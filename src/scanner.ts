import {Kind, Node, Symbol} from './ast';

interface ScanInfo {
  symbol: Symbol;
  reads: Node[];
  writes: Node[];
}

const IDENTIFIER_HEAD = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
const IDENTIFIER_TAIL = IDENTIFIER_HEAD + '0123456789';

export function nameFromIndex(index: number): string {
  let name = IDENTIFIER_HEAD[index % IDENTIFIER_HEAD.length];
  index = index / IDENTIFIER_HEAD.length | 0;

  while (index > 0) {
    name += IDENTIFIER_TAIL[--index % IDENTIFIER_TAIL.length];
    index = index / IDENTIFIER_TAIL.length | 0;
  }

  return name
}

function compareByUsage(left: ScanInfo, right: ScanInfo): number {
  return right.reads.length + right.writes.length - left.reads.length - left.writes.length || left.symbol.id() - right.symbol.id();
}

export class Scanner {
  private _info: {[id: number]: ScanInfo} = {};

  renameSymbols(): void {
    let map = this._info;
    let list: ScanInfo[] = [];

    for (let id in map) {
      list.push(map[id]);
    }

    list.sort(compareByUsage);

    for (let i = 0, n = list.length; i < n; i++) {
      list[i].symbol.setName(nameFromIndex(i));
    }
  }

  inlineConstantVariables(): boolean {
    let map = this._info;
    let wasChanged = false;

    for (let id in map) {
      let info = map[id];

      // This symbol must have a single definition
      if (info.writes.length !== 1) {
        continue;
      }

      // This symbol must be a variable
      let write = info.writes[0];
      if (write.kind() !== Kind.Variable || write.parent().kind() !== Kind.Variables) {
        continue;
      }

      // This symbol must be initialized to a constant
      let value = write.variableValue();
      if (!value.isLiteral()) {
        continue;
      }
      value = value.clone();

      // Inline all reads
      let count = 0;
      for (let read of info.reads) {
        if (read.kind() === Kind.Identifier) {
          read.become(value);
          wasChanged = true;
          count++;
        }
      }

      // Remove the variable if it's now unused
      if (count === info.reads.length) {
        let parent = write.parent();
        wasChanged = true;
        write.remove();

        // Make sure not to leave a "var" without any variables
        if (!parent.hasChildren()) {
          parent.becomeEmpty();
        }
      }
    }

    return wasChanged;
  }

  scan(node: Node): void {
    if (Kind.isUnaryAssign(node.kind())) {
      this._scanAndRecordWrite(node, node.unaryValue());
      return;
    }

    if (Kind.isBinaryAssign(node.kind())) {
      this._scanAndRecordWrite(node, node.binaryLeft());
      this.scan(node.binaryRight());
      return;
    }

    for (let child = node.firstChild(); child !== null; child = child.nextSibling()) {
      this.scan(child);
    }

    switch (node.kind()) {
      ////////////////////////////////////////////////////////////////////////////////
      // Reads

      case Kind.Break: {
        let symbol = node.breakLabel();
        if (symbol !== null) this._infoForSymbol(symbol).reads.push(node);
        break;
      }

      case Kind.Continue: {
        let symbol = node.continueLabel();
        if (symbol !== null) this._infoForSymbol(symbol).reads.push(node);
        break;
      }

      case Kind.Identifier: {
        this._infoForSymbol(node.identifierSymbol()).reads.push(node);
        break;
      }

      case Kind.Member: {
        this._infoForSymbol(node.memberSymbol()).reads.push(node);
        break;
      }

      ////////////////////////////////////////////////////////////////////////////////
      // Writes

      case Kind.Function: {
        this._infoForSymbol(node.functionSymbol()).writes.push(node);
        break;
      }

      case Kind.Label: {
        this._infoForSymbol(node.labelSymbol()).writes.push(node);
        break;
      }

      case Kind.Property: {
        this._infoForSymbol(node.propertyKey()).writes.push(node);
        break;
      }

      case Kind.Variable: {
        this._infoForSymbol(node.variableSymbol()).writes.push(node);
        break;
      }
    }
  }

  private _infoForSymbol(symbol: Symbol): ScanInfo {
    let id = symbol.id();
    let info = this._info[id];
    if (info == null) this._info[id] = info = {symbol, reads: [], writes: []};
    return info;
  }

  private _scanAndRecordWrite(parent: Node, target: Node): void {
    switch (target.kind()) {
      case Kind.Identifier: {
        this._infoForSymbol(target.identifierSymbol()).writes.push(parent);
        break;
      }

      case Kind.Member: {
        this.scan(target.memberValue());
        this._infoForSymbol(target.memberSymbol()).writes.push(parent);
        break;
      }

      default: {
        this.scan(target);
        break;
      }
    }
  }
}
