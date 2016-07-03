import * as compiler from '../src/compiler';
import * as emitter from '../src/emitter';
import * as fs from 'fs';
import * as helpers from '../src/helpers';
import * as http from 'http';
import * as net from 'net';
import * as ts from 'typescript';

let port = 8000;

interface InputMessage {
  input: string;
  minify: boolean;
}

function runServer(): void {
  let server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(fs.readFileSync(__dirname + '/index.html'));
    }

    else if (req.method === 'POST' && req.url === '/') {
      let chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('error', () => {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end('400 Bad Request');
      });
      req.on('end', () => {
        let json: InputMessage = JSON.parse(Buffer.concat(chunks).toString());

        let program = helpers.createProgram({'input.ts': json.input}, {
          noFallthroughCasesInSwitch: true,
          noImplicitAny: true,
          noImplicitReturns: true,
        });

        let diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
          let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          return `${diagnostic.file.fileName}:${line + 1}:${character + 1}: ${message}`;
        }).join('\n');

        res.writeHead(200, {'Content-Type': 'application/json'});

        if (diagnostics.length) {
          res.end(JSON.stringify({success: false, diagnostics}));
        }

        else {
          let modules = compiler.compile(program);
          let mode = json.minify ? emitter.Emit.Minified : emitter.Emit.Normal;
          let output = modules.map(module => emitter.emit(module, mode)).join('');
          res.end(JSON.stringify({success: true, output}));
        }
      });
    }

    else {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('404 Not Found');
    }
  });

  server.listen({host: 'localhost', port});
  console.log(`Listening on http://localhost:${port}/`);
}

function checkNextPort(): void {
  let client = net.connect({port}, () => {
    client.destroy();
    port++;
    checkNextPort();
  }).on('error', runServer);
}

checkNextPort();
