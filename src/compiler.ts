import {Node} from './ast';
import {Scanner} from './scanner';
import * as lowering from './lowering';
import * as mangler from './mangler';
import * as ts from 'typescript';

export function compile(program: ts.Program): Node[] {
  let {knownSymbols, modules} = lowering.lower(program);

  // Constant propagation
  let scanner = new Scanner;
  for (let module of modules) scanner.scan(module);
  scanner.inlineConstantVariables();

  // Constant folding
  mangler.mangle(modules[0], knownSymbols);

  // Constant propagation again
  scanner = new Scanner;
  for (let module of modules) scanner.scan(module);
  let wasChanged = scanner.inlineConstantVariables();

  // Constant folding again
  if (wasChanged) mangler.mangle(modules[0], knownSymbols);

  return modules;
}
