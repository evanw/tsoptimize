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

it('general', () => {
  check(
`function test(a: number, b: number): number {
  [false, true, null, this, 0, 1.5000, 1e10, 'abc\\n', "abc\\n"];
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
  for (i = 0; i < 10; i++) ;
  for (var i = 0, j = 10; i < j; i++, j--) ;
}`,
'',
`function test(a, b) {
  [false, true, null, this, 0, 1.5, 10000000000, "abc\\n", "abc\\n"];
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
  for (i = 0; i < 10; i++)
    ;
  for (var i = 0, j = 10; i < j; i++, j--)
    ;
}
`,
`function test(a,b){
[false,true,null,this,0,1.5,10000000000,"abc\\n","abc\\n"];
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
for(i=0;i<10;i++);
for(var i=0,j=10;i<j;i++,j--);
}`.replace(/\n/g, '')
  );
});
