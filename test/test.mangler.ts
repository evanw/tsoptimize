import * as assert from 'assert';
import * as emitter from '../src/emitter';
import * as mangler from '../src/mangler';
import * as helpers from '../src/helpers';
import * as ts from 'typescript';

function check(input: string, expectedNormal: string, expectedMinified: string): void {
  var program = helpers.createProgram({'input.ts': input}, {noImplicitAny: true});
  mangler.mangle(program);
  var diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
    var {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
  }).join('\n');
  var outputNormal = emitter.emit(program, emitter.Emit.Normal);
  var outputMinified = emitter.emit(program, emitter.Emit.Minified);

  assert.strictEqual(diagnostics, '');
  assert.strictEqual(outputNormal.trim(), expectedNormal.trim());
  assert.strictEqual(outputMinified.trim(), expectedMinified.trim());
}

it('mangler: unary arithmetic', function() {
  this.timeout(0);

  check(
    'this.x = [+3, -3, ~3, !3];',
    'this.x = [3, -3, -4, false];',
    'this.x=[3,-3,-4,!1];'
  );
});

it('mangler: binary arithmetic', function() {
  this.timeout(0);

  check(
    'this.x = [3 + 5, 3 - 5, 3 * 5, 3 / 5, 3 % 5, 3 ** 5, 3 & 5, 3 | 5, 3 ^ 5, 3 << 5, -33 >> 5, -33 >>> 5];',
    'this.x = [8, -2, 15, 0.6, 3, 243, 1, 7, 6, 96, -2, 134217726];',
    'this.x=[8,-2,15,.6,3,243,1,7,6,96,-2,134217726];'
  );
});
