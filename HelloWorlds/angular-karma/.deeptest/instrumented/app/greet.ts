const __witness_1f3y9w2: { s(id: number): void; f(id: number): void; c(id: number, index: number): void; v<T>(id: number, name: string, value: T): T } = (globalThis as any).__witness__.file("__witness_1f3y9w2", {"path":"C:/workspace/HelloWorlds/angular-karma/src/app/greet.ts","statementMap":{"0":{"start":{"line":4,"column":2},"end":{"line":6,"column":3}},"1":{"start":{"line":5,"column":4},"end":{"line":5,"column":19}},"2":{"start":{"line":7,"column":2},"end":{"line":7,"column":27}},"3":{"start":{"line":11,"column":2},"end":{"line":13,"column":3}},"4":{"start":{"line":12,"column":4},"end":{"line":12,"column":19}},"5":{"start":{"line":14,"column":2},"end":{"line":16,"column":3}},"6":{"start":{"line":15,"column":4},"end":{"line":15,"column":27}},"7":{"start":{"line":17,"column":2},"end":{"line":17,"column":83}},"8":{"start":{"line":21,"column":2},"end":{"line":21,"column":49}}},"fnMap":{"0":{"name":"hello","decl":{"start":{"line":3,"column":7},"end":{"line":3,"column":46}},"loc":{"start":{"line":3,"column":46},"end":{"line":8,"column":1}},"line":3},"1":{"name":"helloMany","decl":{"start":{"line":10,"column":7},"end":{"line":10,"column":51}},"loc":{"start":{"line":10,"column":51},"end":{"line":18,"column":1}},"line":10},"2":{"name":"shout","decl":{"start":{"line":20,"column":7},"end":{"line":20,"column":44}},"loc":{"start":{"line":20,"column":44},"end":{"line":22,"column":1}},"line":20}},"branchMap":{"0":{"type":"default-arg","line":3,"loc":{"start":{"line":3,"column":22},"end":{"line":3,"column":36}},"locations":[{"start":{"line":3,"column":29},"end":{"line":3,"column":36}}]},"1":{"type":"if","line":4,"loc":{"start":{"line":4,"column":2},"end":{"line":6,"column":3}},"locations":[{"start":{"line":4,"column":13},"end":{"line":6,"column":3}},{"start":{"line":4,"column":2},"end":{"line":4,"column":2}}]},"2":{"type":"if","line":11,"loc":{"start":{"line":11,"column":2},"end":{"line":13,"column":3}},"locations":[{"start":{"line":11,"column":26},"end":{"line":13,"column":3}},{"start":{"line":11,"column":2},"end":{"line":11,"column":2}}]},"3":{"type":"if","line":14,"loc":{"start":{"line":14,"column":2},"end":{"line":16,"column":3}},"locations":[{"start":{"line":14,"column":26},"end":{"line":16,"column":3}},{"start":{"line":14,"column":2},"end":{"line":14,"column":2}}]}},"skipped":[]});/** Simple greetings. Every path here is covered by greet.test.ts. */

export function hello(name = (__witness_1f3y9w2.c(0, 0), 'World')): string {__witness_1f3y9w2.f(0);
  __witness_1f3y9w2.s(0);if (!name) {__witness_1f3y9w2.c(1, 0);
    __witness_1f3y9w2.s(1);name = 'World';
  } else {__witness_1f3y9w2.c(1, 1);}
  __witness_1f3y9w2.s(2);return `Hello, ${name}!`;
}

export function helloMany(names: string[]): string {__witness_1f3y9w2.f(1);
  __witness_1f3y9w2.s(3);if (names.length === 0) {__witness_1f3y9w2.c(2, 0);
    __witness_1f3y9w2.s(4);return hello();
  } else {__witness_1f3y9w2.c(2, 1);}
  __witness_1f3y9w2.s(5);if (names.length === 1) {__witness_1f3y9w2.c(3, 0);
    __witness_1f3y9w2.s(6);return hello(names[0]);
  } else {__witness_1f3y9w2.c(3, 1);}
  __witness_1f3y9w2.s(7);return `Hello, ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}!`;
}

export function shout(text: string): string {__witness_1f3y9w2.f(2);
  __witness_1f3y9w2.s(8);return text.toUpperCase().replace(/!/g, '!!!');
}
