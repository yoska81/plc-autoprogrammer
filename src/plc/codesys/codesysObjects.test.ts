/// <reference types="node" />
/**
 * Send to CODESYS: the project's Structured Text as CODESYS objects: each POU with its declaration (header and VAR
 * sections) and implementation (the statements, without END_…), a FUNCTION's return type, each TYPE a DUT, each
 * VAR_GLOBAL a GVL; the first PROGRAM is the one the MainTask calls; a block without its END_… is left out, said.
 * Run with:  npx tsx src/plc/codesys/codesysObjects.test.ts
 */
import assert from 'node:assert/strict';
import { codesysProgram } from './codesysObjects';

const st = `\`\`\`st
(* Conveyor cell *)
TYPE Mode : (Off, Manual, Auto); END_TYPE

TYPE Station :
STRUCT
  Busy : BOOL;
  Count : INT;
END_STRUCT
END_TYPE

VAR_GLOBAL
  gMode : Mode;
  Start_PB AT %IX0.0 : BOOL; (* start button *)
END_VAR

FUNCTION Scale : REAL // raw to units
VAR_INPUT
  Raw : INT;
END_VAR
Scale := INT_TO_REAL(Raw) / 27648.0 * 100.0;
END_FUNCTION

FUNCTION_BLOCK SealIn
VAR_INPUT
  SetIn, ResetIn : BOOL;
END_VAR
VAR_OUTPUT
  Q : BOOL;
END_VAR
Q := (SetIn OR Q) AND NOT ResetIn;
END_FUNCTION_BLOCK

PROGRAM Main
VAR
  Motor : SealIn;
  (* the run timer *)
  RunT : TON;
END_VAR

// the motor
Motor(SetIn := Start_PB, ResetIn := FALSE);
RunT(IN := Motor.Q, PT := T#5S);
END_PROGRAM
\`\`\``;

const p = codesysProgram(st);
assert.deepEqual(p.objects.map((o) => `${o.kind} ${o.name}`), ['dut Mode', 'dut Station', 'gvl GVL', 'function Scale', 'function_block SealIn', 'program Main']);
assert.equal(p.main, 'Main');
assert.deepEqual(p.notes, []);
const main = p.objects.find((o) => o.name === 'Main')!;
assert.equal(main.declaration, 'PROGRAM Main\nVAR\n  Motor : SealIn;\n  (* the run timer *)\n  RunT : TON;\nEND_VAR');
assert.equal(main.implementation, '// the motor\nMotor(SetIn := Start_PB, ResetIn := FALSE);\nRunT(IN := Motor.Q, PT := T#5S);');
const fb = p.objects.find((o) => o.name === 'SealIn')!;
assert.match(fb.declaration, /^FUNCTION_BLOCK SealIn\nVAR_INPUT[\s\S]*VAR_OUTPUT\n {2}Q : BOOL;\nEND_VAR$/);
assert.equal(fb.implementation, 'Q := (SetIn OR Q) AND NOT ResetIn;');
const fn = p.objects.find((o) => o.name === 'Scale')!;
assert.equal(fn.returnType, 'REAL');
assert.equal(fn.implementation, 'Scale := INT_TO_REAL(Raw) / 27648.0 * 100.0;');
assert.equal(p.objects.find((o) => o.name === 'Station')!.declaration.split('\n').at(-1), 'END_TYPE');
assert.match(p.objects.find((o) => o.kind === 'gvl')!.declaration, /^VAR_GLOBAL\n[\s\S]*END_VAR$/);

// one-line VAR sections
const one = codesysProgram('FUNCTION_BLOCK F\nVAR_INPUT a, b : BOOL; END_VAR\nVAR_OUTPUT q : BOOL; END_VAR\nq := a AND b;\nEND_FUNCTION_BLOCK').objects[0];
assert.equal(one.declaration, 'FUNCTION_BLOCK F\nVAR_INPUT a, b : BOOL; END_VAR\nVAR_OUTPUT q : BOOL; END_VAR');
assert.equal(one.implementation, 'q := a AND b;');

// a program with no declaration, CRLF; an unfinished block; no PROGRAM
const q = codesysProgram('PROGRAM PLC_PRG\r\nx := 1;\r\nEND_PROGRAM\r\nFUNCTION_BLOCK Broken\r\nVAR END_VAR\r\n');
assert.deepEqual(q.objects.map((o) => [o.name, o.declaration, o.implementation]), [['PLC_PRG', 'PROGRAM PLC_PRG', 'x := 1;']]);
assert.match(q.notes[0], /FUNCTION_BLOCK at line 4 has no END_FUNCTION_BLOCK: left out/);
assert.match(codesysProgram('FUNCTION_BLOCK A\nEND_FUNCTION_BLOCK').notes.at(-1)!, /no PROGRAM/);
console.log('codesysObjects.test: all passed');
