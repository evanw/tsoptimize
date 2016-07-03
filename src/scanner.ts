import {Kind, Node, Symbol} from './ast';

class ScanInfo {
  reads: Node[] = [];
  writes: Node[] = [];

  constructor(
    public symbol: Symbol
  ) {
  }
}

export class Scanner {
  private _info: {[id: number]: ScanInfo} = {};

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
      let value = write.variableValue().clone();
      if (!value.isLiteral()) {
        continue;
      }

      // Inline all reads
      let count = 0;
      for (let read of info.reads) {
        if (read.kind() === Kind.Identifier) {
          read.become(value);
          wasChanged = true;
          count++;
        }
      }

      // Remove the variable now that it's unused
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
    if (info == null) this._info[id] = info = new ScanInfo(symbol);
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
