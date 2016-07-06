import * as assert from 'assert';
import * as emitter from '../src/emitter';
import * as helpers from '../src/helpers';
import * as lowering from '../src/lowering';
import * as ts from 'typescript';

function check(input: string, expectedNormal: string, expectedMinified: string): void {
  let program = helpers.createProgram({'input.ts': input}, {
    allowUnreachableCode: true,
    noImplicitAny: true,
  });

  let diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
    let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
  }).join('\n');

  let {modules} = lowering.lower(program);
  assert.strictEqual(modules.length, 1);

  let outputNormal = emitter.emit(modules[0], emitter.Emit.Normal);
  let outputMinified = emitter.emit(modules[0], emitter.Emit.Minified);

  assert.strictEqual(diagnostics, '');
  assert.strictEqual(outputNormal.trim(), expectedNormal.trim());
  assert.strictEqual(outputMinified.trim(), expectedMinified.trim());
}

it('emitter: general', function() {
  this.timeout(0);

  check(
    'function test(a: number, b: number): number {' +
    '  [false, true, null, this, 0, 1.5000, 1e10, \'abc\\n\', "abc\\n", `abc\\n`, `(\${a} \${b})`, /abc\\n/g];' +
    '  do break; while (true);' +
    '  do continue; while (false);' +
    '  x: do break x; while (true);' +
    '  y: do continue y; while (false);' +
    '  z: { break z; }' +
    '  if (a) throw new Error();' +
    '  else if (b) return a;' +
    '  else debugger;' +
    '  try { a; }' +
    '  catch (e) { e; }' +
    '  finally { b; }' +
    '  while (true) break;' +
    '  for (;;) break;' +
    '  var i = 0, j = 1;' +
    '  const c: any = null;' +
    '  for (i = 0; i < 10; i++) ;' +
    '  for (var i = 0, j = 10; i < j; i++, j--) ;' +
    '  for (x in c) ;' +
    '  for (var x in c) ;' +
    '  [i?a:b, test(i, j), (a, b, i, j), , , {a: b, "b ": a, c}, c[a], c.a, a as number,,];' +
    '  [+a, -a, !a, ~a, --a, ++a, a--, a++, void a, typeof a, delete a];' +
    '  [a == b, a != b, a === b, a !== b, a < b, a > b, a <= b, a >= b, a && b, a || b];' +
    '  [a + b, a - b, a * b, a / b, a % b, a & b, a | b, a ^ b, a << b, a >> b];' +
    '  [a = b, a += b, a -= b, a *= b, a /= b, a %= b, a &= b, a |= b, a ^= b, a <<= b, a >>= b];' +
    '}',

    'function test(a, b) {\n' +
    '  [false, true, null, this, 0, 1.5, 10000000000, "abc\\n", "abc\\n", "abc\\n", "(" + a + " " + b + ")", /abc\\n/g];\n' +
    '  do\n' +
    '    break;\n' +
    '  while (true);\n' +
    '  do\n' +
    '    continue;\n' +
    '  while (false);\n' +
    'x:\n' +
    '  do\n' +
    '    break x;\n' +
    '  while (true);\n' +
    'y:\n' +
    '  do\n' +
    '    continue y;\n' +
    '  while (false);\n' +
    'z:\n' +
    '  {\n' +
    '    break z;\n' +
    '  }\n' +
    '  if (a)\n' +
    '    throw new Error();\n' +
    '  else if (b)\n' +
    '    return a;\n' +
    '  else\n' +
    '    debugger;\n' +
    '  try {\n' +
    '    a;\n' +
    '  } catch (e) {\n' +
    '    e;\n' +
    '  } finally {\n' +
    '    b;\n' +
    '  }\n' +
    '  while (true)\n' +
    '    break;\n' +
    '  for (;;)\n' +
    '    break;\n' +
    '  var i = 0, j = 1;\n' +
    '  var c = null;\n' +
    '  for (i = 0; i < 10; i++)\n' +
    '    ;\n' +
    '  for (var i = 0, j = 10; i < j; i++, j--)\n' +
    '    ;\n' +
    '  for (x in c)\n' +
    '    ;\n' +
    '  for (var x in c)\n' +
    '    ;\n' +
    '  [i ? a : b, test(i, j), (a, b, i, j),,, {a: b, "b ": a, c: c}, c[a], c.a, a,,];\n' +
    '  [+a, -a, !a, ~a, --a, ++a, a--, a++, void a, typeof a, delete a];\n' +
    '  [a == b, a != b, a === b, a !== b, a < b, a > b, a <= b, a >= b, a && b, a || b];\n' +
    '  [a + b, a - b, a * b, a / b, a % b, a & b, a | b, a ^ b, a << b, a >> b];\n' +
    '  [a = b, a += b, a -= b, a *= b, a /= b, a %= b, a &= b, a |= b, a ^= b, a <<= b, a >>= b];\n' +
    '}',

    'function test(a,b){' +
    '[!1,!0,null,this,0,1.5,1e10,"abc\\n","abc\\n","abc\\n","("+a+" "+b+")",/abc\\n/g];' +
    'do break;while(!0);' +
    'do continue;while(!1);' +
    'x:do break x;while(!0);' +
    'y:do continue y;while(!1);' +
    'z:{break z}' +
    'if(a)throw new Error();' +
    'else if(b)return a;' +
    'else debugger;' +
    'try{a}' +
    'catch(e){e}' +
    'finally{b}' +
    'while(!0)break;' +
    'for(;;)break;' +
    'var i=0,j=1;' +
    'var c=null;' +
    'for(i=0;i<10;i++);' +
    'for(var i=0,j=10;i<j;i++,j--);' +
    'for(x in c);' +
    'for(var x in c);' +
    '[i?a:b,test(i,j),(a,b,i,j),,,{a:b,"b ":a,c:c},c[a],c.a,a,,];' +
    '[+a,-a,!a,~a,--a,++a,a--,a++,void a,typeof a,delete a];' +
    '[a==b,a!=b,a===b,a!==b,a<b,a>b,a<=b,a>=b,a&&b,a||b];' +
    '[a+b,a-b,a*b,a/b,a%b,a&b,a|b,a^b,a<<b,a>>b];' +
    '[a=b,a+=b,a-=b,a*=b,a/=b,a%=b,a&=b,a|=b,a^=b,a<<=b,a>>=b]' +
    '}'
  );
});

it('emitter: numbers', function() {
  this.timeout(0);

  check(
    '[0..toString, 0.5.toString, -0.5.toString, (-0.5).toString, 10.5.toString];' +
    '[1e100.toString, -1e100.toString, (-1e100).toString, 1.5e100.toString, -1.5e100.toString, (-1.5e100).toString];',

    '[0 .toString, 0.5.toString, -0.5.toString, (-0.5).toString, 10.5.toString];\n' +
    '[1e+100.toString, -1e+100.toString, (-1e+100).toString, 1.5e+100.toString, -1.5e+100.toString, (-1.5e+100).toString];',

    '[0 .toString,.5.toString,-.5.toString,(-.5).toString,10.5.toString];' +
    '[1e100.toString,-1e100.toString,(-1e100).toString,1.5e100.toString,-1.5e100.toString,(-1.5e100).toString];'
  );
});

it('emitter: unary whitespace', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    '[+ +x, +-x, -+x, - -x, + ++x, +--x, -++x, - --x];' +
    '[x++ + x, x + +x, x + ++x, x * x++ + x, x + +x * x, x + ++x * x];' +
    '[x-- - x, x - -x, x - --x, x * x-- - x, x - -x * x, x - --x * x];' +
    '[x++ - x, x + -x, x + --x, x * x++ - x, x + -x * x, x + --x * x];' +
    '[x-- + x, x - +x, x - ++x, x * x-- + x, x - +x * x, x - ++x * x];' +
    '[x < !--x, x < ~--x, x > !--x];',

    'var x;\n' +
    '[+ +x, +-x, -+x, - -x, + ++x, +--x, -++x, - --x];\n' +
    '[x++ + x, x + +x, x + ++x, x * x++ + x, x + +x * x, x + ++x * x];\n' +
    '[x-- - x, x - -x, x - --x, x * x-- - x, x - -x * x, x - --x * x];\n' +
    '[x++ - x, x + -x, x + --x, x * x++ - x, x + -x * x, x + --x * x];\n' +
    '[x-- + x, x - +x, x - ++x, x * x-- + x, x - +x * x, x - ++x * x];\n' +
    '[x < !--x, x < ~--x, x > !--x];',

    'var x;' +
    '[+ +x,+-x,-+x,- -x,+ ++x,+--x,-++x,- --x];' +
    '[x+++x,x+ +x,x+ ++x,x*x+++x,x+ +x*x,x+ ++x*x];' +
    '[x---x,x- -x,x- --x,x*x---x,x- -x*x,x- --x*x];' +
    '[x++-x,x+-x,x+--x,x*x++-x,x+-x*x,x+--x*x];' +
    '[x--+x,x-+x,x-++x,x*x--+x,x-+x*x,x-++x*x];' +
    '[x<! --x,x<~--x,x>!--x];'
  );
});

it('emitter: precedence and parentheses', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    '[-x + x, -(x + x)];' +
    '[(x + x) + x, x + (x + x), x + (x * x), (x + x) * x];',

    'var x;\n' +
    '[-x + x, -(x + x)];\n' +
    '[x + x + x, x + (x + x), x + x * x, (x + x) * x];',

    'var x;' +
    '[-x+x,-(x+x)];' +
    '[x+x+x,x+(x+x),x+x*x,(x+x)*x];'
  );
});
