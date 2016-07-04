import * as assert from 'assert';
import * as emitter from '../src/emitter';
import * as helpers from '../src/helpers';
import * as lowering from '../src/lowering';
import * as mangler from '../src/mangler';
import * as ts from 'typescript';

function check(input: string, expected: string): void {
  let program = helpers.createProgram({'input.ts': input}, {
    noImplicitAny: true,
  });

  let diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
    let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
  }).join('\n');

  let {knownSymbols, modules} = lowering.lower(program);
  assert.strictEqual(modules.length, 1);

  mangler.mangle(modules[0], knownSymbols);

  let output = emitter.emit(modules[0], emitter.Emit.Normal);

  assert.strictEqual(diagnostics, '');
  assert.strictEqual(output.trim(), expected.trim());
}

it('mangler: unary arithmetic', function() {
  this.timeout(0);

  check(
    'this.x = [+3, -3, ~3, !3];',
    'this.x = [3, -3, -4, false];'
  );
});

it('mangler: binary arithmetic', function() {
  this.timeout(0);

  check(
    'this.x = [3 + 5, 3 - 5, 3 * 5, 3 / 5, 3 % 5, 3 & 5, 3 | 5, 3 ^ 5, 3 << 5, -33 >> 5, -33 >>> 5];',
    'this.x = [8, -2, 15, 0.6, 3, 1, 7, 6, 96, -2, 134217726];'
  );
});

it('mangler: strings', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    'this.x = [0 + "", false + "", "" + true, "" + null, void 0 + ""];' +
    'this.x = ["" + x + "a", "a" + x + "", "a" + x + "b", `${x}${x}`, `${x}a${x}`];' +
    'this.x = [0 + ("a" + x), "a" + (0 + x), (x + "a") + 0, (x + 0) + "a", ("" + x) + 0, 0 + (x + "")];',

    'var x;\n' +
    'this.x = ["0", "false", "true", "null", "undefined"], ' +
    'this.x = [x + "a", "a" + x, "a" + x + "b", "" + x + x, x + "a" + x], ' +
    'this.x = ["0a" + x, "a" + (0 + x), x + "a0", x + 0 + "a", x + "0", "0" + x];'
  );
});

it('mangler: side effects', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    '0;' +
    'null;' +
    'this;' +
    'void 0;' +
    '"text";' +
    'x;' +
    'x();' +
    'x((0, x()));' +
    'x((x(), 0));' +
    'x((0, x(), 0, x()));' +
    'x((x(), 0, x(), 0));' +
    'x((x(), (x(), x()), x()));' +
    'x(1) + "" + [x(2).x, x[x], x(3)[x], x[x(4)], {x}, {x: x(5)}];',

    'var x;\n' +
    'x(), ' +
    'x(x()), ' +
    'x((x(), 0)), ' +
    'x((x(), x())), ' +
    'x((x(), x(), 0)), ' +
    'x((x(), x(), x(), x())), ' +
    'x(1), x(2), x(3), x(4), x(5);'
  );
});

it('mangler: boolean conditional logic', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    'x(1 ? 2 : 3);' +
    'x(0 ? 2 : 3);' +
    'x(x ? 2 : 3);' +
    'x(!x ? 2 : 3);',

    'var x;\n' +
    'x(2), ' +
    'x(3), ' +
    'x(x ? 2 : 3), ' +
    'x(x ? 3 : 2);'
  );
});

it('mangler: boolean identical appearance logic', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    'x(x ? x : 0);' +
    'x(!x ? 0 : x);' +
    'x(x() ? x() : 0);' +
    'x(!x() ? 0 : x());' +
    'x(x ? 0 : x);' +
    'x(!x ? x : 0);' +
    'x(x() ? 0 : x());' +
    'x(!x() ? x() : 0);' +
    'x(x ? x : x);' +
    'x(!x ? x : x);' +
    'x(x() ? x() : x());' +
    'x(!x() ? x() : x());',

    'var x;\n' +
    'x(x || 0), ' +
    'x(x || 0), ' +
    'x(x() ? x() : 0), ' +
    'x(x() ? x() : 0), ' +
    'x(x && 0), ' +
    'x(x && 0), ' +
    'x(x() ? 0 : x()), ' +
    'x(x() ? 0 : x()), ' +
    'x(x), ' +
    'x(x), ' +
    'x((x(), x())), ' +
    'x((x(), x()));'
  );
});

it('mangler: Math.pow', function() {
  this.timeout(0);

  check(
    'this(3 ** 4);' +
    'this(Math.pow(3, 4));' +
    'this((0, Math).pow(3, 4));' +
    'this(Math.pow(3, this()));' +
    'this(Math.pow(this(), 4));' +
    'this((this(), Math).pow(3, 4));' +
    'function foo(Math: any) { return Math.pow(3, 4); }',

    'this(81), ' +
    'this(81), ' +
    'this(81), ' +
    'this(Math.pow(3, this())), ' +
    'this(Math.pow(this(), 4)), ' +
    'this((this(), Math).pow(3, 4));\n' +
    'function foo(Math) {\n' +
    '  return Math.pow(3, 4);\n' +
    '}'
 );
});

it('mangler: typeof', function() {
  this.timeout(0);

  check(
    'this(typeof "", typeof false, typeof 0, typeof void 0, typeof null, typeof [], typeof {});' +
    'this(typeof typeof this, typeof !this, typeof -this, typeof void this, typeof [this], typeof {x: this});' +
    'this(typeof typeof this(), typeof !this(), typeof -this(), typeof void this(), typeof [this()], typeof {x: this()});',

    'this("string", "boolean", "number", "undefined", "object", "object", "object"), ' +
    'this("string", "boolean", "number", "undefined", "object", "object"), ' +
    'this(typeof typeof this(), typeof !this(), typeof -this(), typeof void this(), typeof [this()], typeof {x: this()});'
 );
});
