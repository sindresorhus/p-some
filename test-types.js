import test from 'node:test';
import assert from 'node:assert/strict';
import typescript from 'typescript';

test('TypeScript declarations match supported inputs and awaited values', () => {
	const program = typescript.createProgram(['index.test-d.ts'], {
		strict: true,
		noEmit: true,
		target: typescript.ScriptTarget.ES2022,
		module: typescript.ModuleKind.NodeNext,
		types: [],
	});
	const diagnostics = typescript.getPreEmitDiagnostics(program);
	assert.deepEqual(diagnostics.map(diagnostic => typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});
