import * as assert from 'assert';
import * as emitter from '../src/emitter';
import * as helpers from '../src/helpers';
import * as ts from 'typescript';

function check(input: string, expectedNormal: string, expectedMinified: string): void {
  var program = helpers.createProgram({'input.ts': input}, {noImplicitAny: true});
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

it('emitter: general', function() {
  this.timeout(0);

  check(
    'function test(a: number, b: number): number {\n' +
    '  [false, true, null, this, 0, 1.5000, 1e10, \'abc\\n\', "abc\\n", `abc\\n`, `\${a}\${b}c\\n`, this`abc\\n`, /abc\\n/g];\n' +
    '  [() => {}, (a: number) => a, (a: number, b: number) => { throw a + b; }];\n' +
    '  do break; while (true);\n' +
    '  do continue; while (false);\n' +
    '  x: do break x; while (true);\n' +
    '  y: do continue y; while (false);\n' +
    '  z: { break z; }\n' +
    '  if (a) throw new Error();\n' +
    '  else if (b) return a;\n' +
    '  else debugger;\n' +
    '  while (true) break;\n' +
    '  for (;;) break;\n' +
    '  var i = 0, j = 1;\n' +
    '  const c: any = null;\n' +
    '  let [l0, l1 = a, ...l2] = c, {l3, l4: {l5 = b, l6: l7}} = c;\n' +
    '  for (i = 0; i < 10; i++) ;\n' +
    '  for (var i = 0, j = 10; i < j; i++, j--) ;\n' +
    '  for (x in c) ;\n' +
    '  for (var x in c) ;\n' +
    '  for (y of c) ;\n' +
    '  for (var y of c) ;\n' +
    '  [i?a:b, test(i, j), (a, b, i, j), , , {a: b, "b": a, [a]: b}, c[a], c.a, a as number, ...c];\n' +
    '  [+a, -a, !a, ~a, --a, ++a, a--, a++, void a, typeof a, delete a];\n' +
    '  [a == b, a != b, a === b, a !== b, a < b, a > b, a <= b, a >= b, a && b, a || b];\n' +
    '  [a + b, a - b, a * b, a / b, a % b, a ** b, a & b, a | b, a ^ b, a << b, a >> b];\n' +
    '  [a = b, a += b, a -= b, a *= b, a /= b, a %= b, a **= b, a &= b, a |= b, a ^= b, a <<= b, a >>= b];\n' +
    '}',
    'function test(a, b) {\n' +
    '  [false, true, null, this, 0, 1.5, 10000000000, "abc\\n", "abc\\n", `abc\\n`, `\${a}\${b}c\\n`, this`abc\\n`, /abc\\n/g];\n' +
    '  [() => {\n' +
    '  }, a => a, (a, b) => {\n' +
    '    throw a + b;\n' +
    '  }];\n' +
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
    '  while (true)\n' +
    '    break;\n' +
    '  for (;;)\n' +
    '    break;\n' +
    '  var i = 0, j = 1;\n' +
    '  const c = null;\n' +
    '  let [l0, l1 = a, ...l2] = c, {l3, {l5 = b, l7: l6}: l4} = c;\n' +
    '  for (i = 0; i < 10; i++)\n' +
    '    ;\n' +
    '  for (var i = 0, j = 10; i < j; i++, j--)\n' +
    '    ;\n' +
    '  for (x in c)\n' +
    '    ;\n' +
    '  for (var x in c)\n' +
    '    ;\n' +
    '  for (y of c)\n' +
    '    ;\n' +
    '  for (var y of c)\n' +
    '    ;\n' +
    '  [i ? a : b, test(i, j), (a, b, i, j), , , {a: b, "b": a, [a]: b}, c[a], c.a, a, ...c];\n' +
    '  [+a, -a, !a, ~a, --a, ++a, a--, a++, void a, typeof a, delete a];\n' +
    '  [a == b, a != b, a === b, a !== b, a < b, a > b, a <= b, a >= b, a && b, a || b];\n' +
    '  [a + b, a - b, a * b, a / b, a % b, a ** b, a & b, a | b, a ^ b, a << b, a >> b];\n' +
    '  [a = b, a += b, a -= b, a *= b, a /= b, a %= b, a **= b, a &= b, a |= b, a ^= b, a <<= b, a >>= b];\n' +
    '}',
    'function test(a,b){' +
    '[!1,!0,null,this,0,1.5,1e10,"abc\\n","abc\\n",`abc\\n`,`\${a}\${b}c\\n`,this`abc\\n`,/abc\\n/g];' +
    '[()=>{},a=>a,(a,b)=>{throw a+b}];' +
    'do break;while(!0);' +
    'do continue;while(!1);' +
    'x:do break x;while(!0);' +
    'y:do continue y;while(!1);' +
    'z:{break z}' +
    'if(a)throw new Error();' +
    'else if(b)return a;' +
    'else debugger;' +
    'while(!0)break;' +
    'for(;;)break;' +
    'var i=0,j=1;' +
    'const c=null;' +
    'let[l0,l1=a,...l2]=c,{l3,{l5=b,l7:l6}:l4}=c;' +
    'for(i=0;i<10;i++);' +
    'for(var i=0,j=10;i<j;i++,j--);' +
    'for(x in c);' +
    'for(var x in c);' +
    'for(y of c);' +
    'for(var y of c);' +
    '[i?a:b,test(i,j),(a,b,i,j),,,{a:b,"b":a,[a]:b},c[a],c.a,a,...c];' +
    '[+a,-a,!a,~a,--a,++a,a--,a++,void a,typeof a,delete a];' +
    '[a==b,a!=b,a===b,a!==b,a<b,a>b,a<=b,a>=b,a&&b,a||b];' +
    '[a+b,a-b,a*b,a/b,a%b,a**b,a&b,a|b,a^b,a<<b,a>>b];' +
    '[a=b,a+=b,a-=b,a*=b,a/=b,a%=b,a**=b,a&=b,a|=b,a^=b,a<<=b,a>>=b]' +
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
    '[(x + x) + x, x + (x + x), x + (x * x), (x + x) * x, (x ** x) ** x, x ** (x ** x)];',
    'var x;\n' +
    '[-x + x, -(x + x)];\n' +
    '[x + x + x, x + (x + x), x + x * x, (x + x) * x, (x ** x) ** x, x ** x ** x];',
    'var x;' +
    '[-x+x,-(x+x)];' +
    '[x+x+x,x+(x+x),x+x*x,(x+x)*x,(x**x)**x,x**x**x];'
  );
});