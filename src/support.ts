import * as ts from 'typescript';
import * as fs from 'fs';

var lib_d_ts: string = null;

export function createProgram(files: {[path: string]: string}, options: ts.CompilerOptions): ts.Program {
  var fileNames = Object.keys(files);
  var clone: {[path: string]: string} = Object.create(null);
  fileNames.forEach(fileName => clone[fileName] = files[fileName]);
  clone['lib.d.ts'] = lib_d_ts || (lib_d_ts = fs.readFileSync(__dirname + '/../node_modules/typescript/lib/lib.d.ts', 'utf8'));
  files = clone;

  var fileExists = (fileName: string) => fileName in files;
  var readFile = (fileName: string) => files[fileName];
  var host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      if (fileName in files) return ts.createSourceFile(fileName, files[fileName], languageVersion);
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
        var result = ts.resolveModuleName(moduleName, containingFile, options, {fileExists, readFile});
        if (result.resolvedModule) return result.resolvedModule;
      });
    },
  };

  return ts.createProgram(fileNames, options, host);
}
