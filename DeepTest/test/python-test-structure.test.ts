/**
 * The pytest half of the additive rule, and the composed port.
 *
 * The allowlist is asserted at the classification rather than at a later
 * check, because a denylist that happened to name `@pytest.fixture` would
 * tell us nothing about the next decorator.
 */
import { test, beforeAll } from 'vitest';
import assert from 'node:assert/strict';
import { isProvablyAdditive } from '@projectrevivesolutions/witness';
import type { SyntaxPort } from '@projectrevivesolutions/witness';
import { repoWasmDir } from '../src/languages/shared/treeSitter';
import { createDeepTestSyntax } from '../src/agent/syntax';

let syntax: SyntaxPort;
beforeAll(async () => {
  syntax = await createDeepTestSyntax(repoWasmDir());
}, 60_000);

const FILE = 'tests/test_greet.py';

function kinds(source: string, file = FILE): string[] {
  return (syntax.testStructures(file, source) ?? []).map((s) => s.kind);
}

function additive(before: string, after: string, file = FILE): string {
  return isProvablyAdditive(syntax.testStructures(file, before), syntax.testStructures(file, after)).kind;
}

const MODULE = `from greet import greet


def test_greets():
    assert greet("a") == "Hello a"
`;

test('an undecorated module-level def test_ is a case', () => {
  assert.deepEqual(kinds(`def test_a():\n    pass\n`), ['test-case']);
});

test('a def that is not test_ prefixed is other', () => {
  assert.deepEqual(kinds(`def helper():\n    pass\n`), ['other']);
});

test('a Test-prefixed class is a suite and its test_ methods are cases', () => {
  const structures = syntax.testStructures(FILE, `class TestGreet:\n    def test_a(self):\n        pass\n`) ?? [];
  assert.equal(structures[0].kind, 'suite');
  assert.deepEqual(structures[0].kind === 'suite' ? structures[0].children.map((c) => c.kind) : [], ['test-case']);
});

test('a class that is not Test-prefixed is other', () => {
  assert.deepEqual(kinds(`class Helper:\n    def test_a(self):\n        pass\n`), ['other']);
});

/**
 * Any decorator at all, and the reason is `@pytest.fixture`: it turns a
 * function into shared infrastructure rather than a test, and telling it
 * apart from a harmless mark means classifying decorator expressions.
 */
test('any decorator makes it other, and the exclusion is pinned rather than implicit', () => {
  for (const source of [
    `@pytest.fixture\ndef test_a():\n    pass\n`,
    `@pytest.mark.skip\ndef test_a():\n    pass\n`,
    `@pytest.mark.parametrize("x", [1])\ndef test_a(x):\n    pass\n`,
    `@pytest.mark.xfail\ndef test_a():\n    pass\n`,
  ]) {
    assert.deepEqual(kinds(source), ['other'], source.split('\n')[0]);
  }
});

test('imports, module statements and setup_method are other', () => {
  assert.deepEqual(kinds(`import pytest\n`), ['other']);
  assert.deepEqual(kinds(`SHARED = {}\n`), ['other']);
  assert.deepEqual(kinds(`def setup_method(self):\n    pass\n`), ['other']);
});

// ---------------------------------------------------------------------------
// The comparison, over pytest shapes
// ---------------------------------------------------------------------------

test('adding a def test_ to a module is additive', () => {
  const after = `${MODULE}

def test_greets_nobody():
    assert greet("") == "Hello"
`;
  assert.equal(additive(MODULE, after), 'additive');
});

test('adding a method to a Test class is additive', () => {
  const before = `class TestGreet:
    def test_a(self):
        assert True
`;
  const after = `class TestGreet:
    def test_a(self):
        assert True

    def test_b(self):
        assert True
`;
  assert.equal(additive(before, after), 'additive');
});

test('adding a fixture alongside a test is refused', () => {
  const after = `${MODULE}

@pytest.fixture
def shared():
    return {}


def test_more(shared):
    assert shared == {}
`;
  assert.equal(additive(MODULE, after), 'not-additive');
});

test('adding an import is refused', () => {
  assert.equal(additive(MODULE, `import pytest\n${MODULE}`), 'not-additive');
});

test('changing an existing assertion is refused', () => {
  assert.equal(additive(MODULE, MODULE.replace('== "Hello a"', 'is not None')), 'not-additive');
});

test('reordering two existing tests is refused', () => {
  const before = `def test_a():\n    pass\n\n\ndef test_b():\n    pass\n`;
  const after = `def test_b():\n    pass\n\n\ndef test_a():\n    pass\n`;
  assert.equal(additive(before, after), 'not-additive');
});

test('a file that does not parse is undecidable, never a pass', () => {
  assert.equal(syntax.testStructures(FILE, `def test_a(:\n    pass\n`), undefined);
  assert.equal(additive(MODULE, `def test_a(:\n    pass\n`), 'undecidable');
});

// ---------------------------------------------------------------------------
// The composed port
// ---------------------------------------------------------------------------

test('the composed port answers for both language families', () => {
  assert.equal(syntax.supports('tests/test_greet.py'), true);
  assert.equal(syntax.supports('src/greet.test.ts'), true);
  assert.equal(syntax.supports('src/components/Greeting.test.tsx'), true);
  assert.equal(syntax.supports('src/greet.test.js'), true);
  assert.equal(syntax.supports('src/Greeting.svelte'), false, 'no grammar, so no answer');
});

test('the composed port routes TypeScript to Witness and Python to DeepTest', () => {
  assert.deepEqual((syntax.testStructures('src/a.test.ts', `it('a', () => {});`) ?? []).map((s) => s.kind), ['test-case']);
  assert.deepEqual((syntax.testStructures('tests/test_a.py', `def test_a():\n    pass\n`) ?? []).map((s) => s.kind), ['test-case']);
});

/**
 * Python is deliberately not answered for `exportedDeclarations`. An empty
 * list would report "this file exports nothing" and pass every Python source
 * change, which is exactly the permissive failure `undefined` exists to
 * prevent.
 */
test('exportedDeclarations returns undefined for Python rather than an empty list', () => {
  assert.equal(syntax.exportedDeclarations('src/greet.py', `def greet(name):\n    return name\n`), undefined);
});
