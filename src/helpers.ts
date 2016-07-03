import * as fs from 'fs';
import * as ts from 'typescript';

let SyntaxKind = ts.SyntaxKind;
let librarySource: string = null;
let libraryFile: ts.SourceFile = null;

export function createProgram(files: {[path: string]: string}, options: ts.CompilerOptions): ts.Program {
  let fileExists = (fileName: string) => fileName in files;
  let readFile = (fileName: string) => files[fileName];
  let host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (fileName === 'lib.d.ts') {
        let source = librarySource || (librarySource = fs.readFileSync(__dirname + '/../node_modules/typescript/lib/lib.d.ts', 'utf8'));
        return libraryFile || (libraryFile = ts.createSourceFile(fileName, source, languageVersion));
      }
      if (fileName in files) return ts.createSourceFile(fileName, files[fileName], languageVersion);
      return;
    },
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: (fileName, contents) => files[fileName] = contents,
    getCurrentDirectory: () => '.',
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => '\n',
    useCaseSensitiveFileNames: () => true,
    fileExists,
    readFile,
    resolveModuleNames: (moduleNames, containingFile) => {
      return moduleNames.map(moduleName => {
        let result = ts.resolveModuleName(moduleName, containingFile, options, {fileExists, readFile});
        if (result.resolvedModule) return result.resolvedModule;
        return;
      });
    },
  };

  return ts.createProgram(Object.keys(files), options, host);
}
