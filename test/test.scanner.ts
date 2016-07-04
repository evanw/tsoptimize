import * as assert from 'assert';
import * as emitter from '../src/emitter';
import * as helpers from '../src/helpers';
import * as lowering from '../src/lowering';
import {Scanner} from '../src/scanner';
import * as ts from 'typescript';

import * as mangler from '../src/mangler';

function check(input: string, expectedNormal: string, expectedMinified: string): void {
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

  let outputNormal = emitter.emit(modules[0], emitter.Emit.Normal);
  let outputMinified = emitter.emit(modules[0], emitter.Emit.Minified);

  assert.strictEqual(diagnostics, '');
  assert.strictEqual(outputNormal.trim(), expectedNormal.trim());
  assert.strictEqual(outputMinified.trim(), expectedMinified.trim());
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
    '}',

    'function foo(a){' +
    'var y=1+2,z=3;' +
    'z++;' +
    'return 1+y+z+a+void 0' +
    '}'
  );
});
