import * as assert from 'assert';
import * as emitter from '../src/emitter';
import * as helpers from '../src/helpers';
import * as lowering from '../src/lowering';
import {nameFromIndex, Scanner} from '../src/scanner';
import * as ts from 'typescript';

import * as mangler from '../src/mangler';

function check(input: string, expected: string): void {
  let program = helpers.createProgram({'input.ts': input}, {
    noImplicitAny: true,
  });

  let diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
    let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
  }).join('\n');

  let {modules} = lowering.lower(program);
  assert.strictEqual(modules.length, 1);

  let scanner = new Scanner;
  scanner.scan(modules[0]);
  scanner.inlineConstantVariables();

  let output = emitter.emit(modules[0], emitter.Emit.Normal);

  assert.strictEqual(diagnostics, '');
  assert.strictEqual(output.trim(), expected.trim());
}

it('scanner: inline constants', function() {
  this.timeout(0);

  check(
    'function foo(a: number) {' +
    '  var x = 1, y = x + 2, z = 3, u: any;' +
    '  z++;' +
    '  return x + y + z + a + u;' +
    '}',

    'function foo(a) {\n' +
    '  var y = 1 + 2, z = 3;\n' +
    '  z++;\n' +
    '  return 1 + y + z + a + void 0;\n' +
    '}'
  );
});

it('scanner: name generation', function() {
  this.timeout(0);

  assert.strictEqual('a', nameFromIndex(0));
  assert.strictEqual('b', nameFromIndex(1));
  assert.strictEqual('c', nameFromIndex(2));

  assert.strictEqual('Z', nameFromIndex(51));
  assert.strictEqual('_', nameFromIndex(52));
  assert.strictEqual('$', nameFromIndex(53));

  assert.strictEqual('aa', nameFromIndex(54));
  assert.strictEqual('ba', nameFromIndex(55));
  assert.strictEqual('ca', nameFromIndex(56));

  assert.strictEqual('Za', nameFromIndex(105));
  assert.strictEqual('_a', nameFromIndex(106));
  assert.strictEqual('$a', nameFromIndex(107));

  assert.strictEqual('ab', nameFromIndex(108));
  assert.strictEqual('bb', nameFromIndex(109));
  assert.strictEqual('cb', nameFromIndex(110));

  assert.strictEqual('Z$', nameFromIndex(2967));
  assert.strictEqual('_$', nameFromIndex(2968));
  assert.strictEqual('$$', nameFromIndex(2969));

  assert.strictEqual('a0', nameFromIndex(2970));
  assert.strictEqual('b0', nameFromIndex(2971));
  assert.strictEqual('c0', nameFromIndex(2972));
});
