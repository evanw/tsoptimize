import * as emitter from './emitter';
import * as support from './support';
import * as assert from 'assert';
import * as ts from 'typescript';

function check(input: string, expectedDiagnostics: string, expectedNormal: string, expectedMinified: string): void {
  var program = support.createProgram({'input.ts': input}, {noImplicitAny: true});
  var diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
    var {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
  }).join('\n');
  var outputNormal = emitter.emit(program, emitter.Emit.Normal);
  var outputMinified = emitter.emit(program, emitter.Emit.Minified);

  assert.strictEqual(diagnostics, expectedDiagnostics);
  assert.strictEqual(outputNormal.trim(), expectedNormal.trim());
  assert.strictEqual(outputMinified.trim(), expectedMinified.trim());
}

it('general', function() {
  this.timeout(0);

  check(
`function test(a: number, b: number): number {
  [false, true, null, this, 0, 1.5000, 1e10, 'abc\\n', "abc\\n", \`abc\\n\`, \`\${a}\${b}c\\n\`, this\`abc\\n\`, /abc\\n/g];
  [() => {}, (a: number) => a, (a: number, b: number) => { throw a + b; }];
  do break; while (true);
  do continue; while (false);
  x: do break x; while (true);
  y: do continue y; while (false);
  z: { break z; }
  if (a) throw new Error();
  else if (b) return a;
  else debugger;
  while (true) break;
  for (;;) break;
  var i = 0, j = 1;
  const c: any = null;
  let [l0, l1 = a, ...l2] = c, {l3, l4: {l5 = b, l6: l7}} = c;
  for (i = 0; i < 10; i++) ;
  for (var i = 0, j = 10; i < j; i++, j--) ;
  for (x in c) ;
  for (var x in c) ;
  for (y of c) ;
  for (var y of c) ;
  [i?a:b, test(i, j), (a, b, i, j), , , {a: b, "b": a, [a]: b}, c[a], c.a, a as number, ...c];
  [+a, -a, !a, ~a, --a, ++a, a--, a++, void a, typeof a, delete a];
  [a == b, a != b, a === b, a !== b, a < b, a > b, a <= b, a >= b, a && b, a || b];
  [a + b, a - b, a * b, a / b, a % b, a ** b, a & b, a | b, a ^ b, a << b, a >> b];
  [a = b, a += b, a -= b, a *= b, a /= b, a %= b, a **= b, a &= b, a |= b, a ^= b, a <<= b, a >>= b];
}`,
'',
`function test(a, b) {
  [false, true, null, this, 0, 1.5, 10000000000, "abc\\n", "abc\\n", \`abc\\n\`, \`\${a}\${b}c\\n\`, this\`abc\\n\`, /abc\\n/g];
  [() => {
  }, a => a, (a, b) => {
    throw a + b;
  }];
  do
    break;
  while (true);
  do
    continue;
  while (false);
x:
  do
    break x;
  while (true);
y:
  do
    continue y;
  while (false);
z:
  {
    break z;
  }
  if (a)
    throw new Error();
  else if (b)
    return a;
  else
    debugger;
  while (true)
    break;
  for (;;)
    break;
  var i = 0, j = 1;
  const c = null;
  let [l0, l1 = a, ...l2] = c, {l3, {l5 = b, l7: l6}: l4} = c;
  for (i = 0; i < 10; i++)
    ;
  for (var i = 0, j = 10; i < j; i++, j--)
    ;
  for (x in c)
    ;
  for (var x in c)
    ;
  for (y of c)
    ;
  for (var y of c)
    ;
  [i ? a : b, test(i, j), (a, b, i, j), , , {a: b, "b": a, [a]: b}, c[a], c.a, a, ...c];
  [+a, -a, !a, ~a, --a, ++a, a--, a++, void a, typeof a, delete a];
  [a == b, a != b, a === b, a !== b, a < b, a > b, a <= b, a >= b, a && b, a || b];
  [a + b, a - b, a * b, a / b, a % b, a ** b, a & b, a | b, a ^ b, a << b, a >> b];
  [a = b, a += b, a -= b, a *= b, a /= b, a %= b, a **= b, a &= b, a |= b, a ^= b, a <<= b, a >>= b];
}
`,
`function test(a,b){
[false,true,null,this,0,1.5,1e10,"abc\\n","abc\\n",\`abc\\n\`,\`\${a}\${b}c\\n\`,this\`abc\\n\`,/abc\\n/g];
[()=>{},a=>a,(a,b)=>{throw a+b}];
do break;while(true);
do continue;while(false);
x:do break x;while(true);
y:do continue y;while(false);
z:{break z}
if(a)throw new Error();
else if(b)return a;
else debugger;
while(true)break;
for(;;)break;
var i=0,j=1;
const c=null;
let[l0,l1=a,...l2]=c,{l3,{l5=b,l7:l6}:l4}=c;
for(i=0;i<10;i++);
for(var i=0,j=10;i<j;i++,j--);
for(x in c);
for(var x in c);
for(y of c);
for(var y of c);
[i?a:b,test(i,j),(a,b,i,j),,,{a:b,"b":a,[a]:b},c[a],c.a,a,...c];
[+a,-a,!a,~a,--a,++a,a--,a++,void a,typeof a,delete a];
[a==b,a!=b,a===b,a!==b,a<b,a>b,a<=b,a>=b,a&&b,a||b];
[a+b,a-b,a*b,a/b,a%b,a**b,a&b,a|b,a^b,a<<b,a>>b];
[a=b,a+=b,a-=b,a*=b,a/=b,a%=b,a**=b,a&=b,a|=b,a^=b,a<<=b,a>>=b]
}`.replace(/\n/g, '')
  );
});

it('numbers', function() {
  this.timeout(0);

  check(
    '[0..toString, 0.5.toString, -0.5.toString, (-0.5).toString, 10.5.toString];' +
    '[1e100.toString, -1e100.toString, (-1e100).toString, 1.5e100.toString, -1.5e100.toString, (-1.5e100).toString];',
    '',
    '[0 .toString, 0.5.toString, -0.5.toString, (-0.5).toString, 10.5.toString];\n' +
    '[1e+100.toString, -1e+100.toString, (-1e+100).toString, 1.5e+100.toString, -1.5e+100.toString, (-1.5e+100).toString];',
    '[0 .toString,.5.toString,-.5.toString,(-.5).toString,10.5.toString];' +
    '[1e100.toString,-1e100.toString,(-1e100).toString,1.5e100.toString,-1.5e100.toString,(-1.5e100).toString];'
  );
});

it('unary whitespace', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    '[+ +x, +-x, -+x, - -x, + ++x, +--x, -++x, - --x];' +
    '[x++ + x, x + +x, x + ++x, x * x++ + x, x + +x * x, x + ++x * x];' +
    '[x-- - x, x - -x, x - --x, x * x-- - x, x - -x * x, x - --x * x];' +
    '[x++ - x, x + -x, x + --x, x * x++ - x, x + -x * x, x + --x * x];' +
    '[x-- + x, x - +x, x - ++x, x * x-- + x, x - +x * x, x - ++x * x];' +
    '[x < !--x, x < ~--x, x > !--x];',
    '',
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

it('precedence and parentheses', function() {
  this.timeout(0);

  check(
    'var x: any;' +
    '[-x + x, -(x + x)];' +
    '[(x + x) + x, x + (x + x), x + (x * x), (x + x) * x, (x ** x) ** x, x ** (x ** x)];',
    '',
    'var x;\n' +
    '[-x + x, -(x + x)];\n' +
    '[x + x + x, x + (x + x), x + x * x, (x + x) * x, (x ** x) ** x, x ** x ** x];',
    'var x;' +
    '[-x+x,-(x+x)];' +
    '[x+x+x,x+(x+x),x+x*x,(x+x)*x,(x**x)**x,x**x**x];'
  );
});
