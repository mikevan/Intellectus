const __witness_a01hn3: { s(id: number): void; f(id: number): void; c(id: number, index: number): void; v<T>(id: number, name: string, value: T): T } = (globalThis as any).__witness__.file("__witness_a01hn3", {"path":"C:/workspace/HelloWorlds/angular-karma/src/app/names.ts","statementMap":{"0":{"start":{"line":7,"column":13},"end":{"line":7,"column":23}},"1":{"start":{"line":8,"column":2},"end":{"line":10,"column":3}},"2":{"start":{"line":9,"column":4},"end":{"line":9,"column":14}},"3":{"start":{"line":11,"column":2},"end":{"line":16,"column":3}},"4":{"start":{"line":12,"column":4},"end":{"line":15,"column":17}},"5":{"start":{"line":14,"column":18},"end":{"line":14,"column":70}},"6":{"start":{"line":17,"column":2},"end":{"line":17,"column":14}},"7":{"start":{"line":22,"column":16},"end":{"line":22,"column":54}},"8":{"start":{"line":22,"column":52},"end":{"line":22,"column":53}},"9":{"start":{"line":23,"column":2},"end":{"line":25,"column":3}},"10":{"start":{"line":24,"column":4},"end":{"line":24,"column":14}},"11":{"start":{"line":26,"column":2},"end":{"line":28,"column":3}},"12":{"start":{"line":27,"column":4},"end":{"line":27,"column":50}},"13":{"start":{"line":29,"column":2},"end":{"line":29,"column":68}},"14":{"start":{"line":29,"column":26},"end":{"line":29,"column":57}},"15":{"start":{"line":34,"column":16},"end":{"line":34,"column":54}},"16":{"start":{"line":34,"column":52},"end":{"line":34,"column":53}},"17":{"start":{"line":35,"column":16},"end":{"line":35,"column":48}},"18":{"start":{"line":36,"column":2},"end":{"line":38,"column":3}},"19":{"start":{"line":37,"column":4},"end":{"line":37,"column":40}},"20":{"start":{"line":39,"column":2},"end":{"line":39,"column":15}}},"fnMap":{"0":{"name":"cleanName","decl":{"start":{"line":6,"column":7},"end":{"line":6,"column":47}},"loc":{"start":{"line":6,"column":47},"end":{"line":18,"column":1}},"line":6},"1":{"name":"(anonymous_1)","decl":{"start":{"line":14,"column":11},"end":{"line":14,"column":18}},"loc":{"start":{"line":14,"column":18},"end":{"line":14,"column":70}},"line":14},"2":{"name":"initials","decl":{"start":{"line":21,"column":7},"end":{"line":21,"column":51}},"loc":{"start":{"line":21,"column":51},"end":{"line":30,"column":1}},"line":21},"3":{"name":"(anonymous_3)","decl":{"start":{"line":22,"column":45},"end":{"line":22,"column":52}},"loc":{"start":{"line":22,"column":52},"end":{"line":22,"column":53}},"line":22},"4":{"name":"(anonymous_4)","decl":{"start":{"line":29,"column":19},"end":{"line":29,"column":26}},"loc":{"start":{"line":29,"column":26},"end":{"line":29,"column":57}},"line":29},"5":{"name":"nickname","decl":{"start":{"line":33,"column":7},"end":{"line":33,"column":63}},"loc":{"start":{"line":33,"column":63},"end":{"line":40,"column":1}},"line":33},"6":{"name":"(anonymous_6)","decl":{"start":{"line":34,"column":45},"end":{"line":34,"column":52}},"loc":{"start":{"line":34,"column":52},"end":{"line":34,"column":53}},"line":34}},"branchMap":{"0":{"type":"if","line":8,"loc":{"start":{"line":8,"column":2},"end":{"line":10,"column":3}},"locations":[{"start":{"line":8,"column":13},"end":{"line":10,"column":3}},{"start":{"line":8,"column":2},"end":{"line":8,"column":2}}]},"1":{"type":"if","line":11,"loc":{"start":{"line":11,"column":2},"end":{"line":16,"column":3}},"locations":[{"start":{"line":11,"column":66},"end":{"line":16,"column":3}},{"start":{"line":11,"column":2},"end":{"line":11,"column":2}}]},"2":{"type":"binary-expr","line":11,"loc":{"start":{"line":11,"column":6},"end":{"line":11,"column":64}},"locations":[{"start":{"line":11,"column":6},"end":{"line":11,"column":33}},{"start":{"line":11,"column":37},"end":{"line":11,"column":64}}]},"3":{"type":"if","line":23,"loc":{"start":{"line":23,"column":2},"end":{"line":25,"column":3}},"locations":[{"start":{"line":23,"column":26},"end":{"line":25,"column":3}},{"start":{"line":23,"column":2},"end":{"line":23,"column":2}}]},"4":{"type":"if","line":26,"loc":{"start":{"line":26,"column":2},"end":{"line":28,"column":3}},"locations":[{"start":{"line":26,"column":26},"end":{"line":28,"column":3}},{"start":{"line":26,"column":2},"end":{"line":26,"column":2}}]},"5":{"type":"default-arg","line":33,"loc":{"start":{"line":33,"column":43},"end":{"line":33,"column":53}},"locations":[{"start":{"line":33,"column":52},"end":{"line":33,"column":53}}]},"6":{"type":"cond-expr","line":35,"loc":{"start":{"line":35,"column":16},"end":{"line":35,"column":48}},"locations":[{"start":{"line":35,"column":35},"end":{"line":35,"column":43}},{"start":{"line":35,"column":46},"end":{"line":35,"column":48}}]},"7":{"type":"if","line":36,"loc":{"start":{"line":36,"column":2},"end":{"line":38,"column":3}},"locations":[{"start":{"line":36,"column":29},"end":{"line":38,"column":3}},{"start":{"line":36,"column":2},"end":{"line":36,"column":2}}]}},"skipped":[]});/**
 * Name helpers. These have tests, but only one happy path each.
 * DeepTest should flag the branches the tests never reach.
 */

export function cleanName(raw: string): string {__witness_a01hn3.f(0);
  let name = __witness_a01hn3.v(0, "name", raw.trim());
  __witness_a01hn3.s(1);if (!name) {__witness_a01hn3.c(0, 0);
    __witness_a01hn3.s(2);return '';
  } else {__witness_a01hn3.c(0, 1);}
  __witness_a01hn3.s(3);if ((__witness_a01hn3.c(2, 0), name === name.toUpperCase()) || (__witness_a01hn3.c(2, 1), name === name.toLowerCase())) {__witness_a01hn3.c(1, 0);
    __witness_a01hn3.s(4);name = name
      .split(/\s+/)
      .map((p) => (__witness_a01hn3.f(1), __witness_a01hn3.s(5), p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
      .join(' ');
  } else {__witness_a01hn3.c(1, 1);}
  __witness_a01hn3.s(6);return name;
}

/** The initials of a full name, e.g. "Jeff Q Public" -> "J.Q.P." */
export function initials(fullName: string): string {__witness_a01hn3.f(2);
  const parts = __witness_a01hn3.v(7, "parts", fullName.split(/\s+/).filter((p) => (__witness_a01hn3.f(3), __witness_a01hn3.s(8), p)));
  __witness_a01hn3.s(9);if (parts.length === 0) {__witness_a01hn3.c(3, 0);
    __witness_a01hn3.s(10);return '';
  } else {__witness_a01hn3.c(3, 1);}
  __witness_a01hn3.s(11);if (parts.length === 1) {__witness_a01hn3.c(4, 0);
    __witness_a01hn3.s(12);return parts[0].charAt(0).toUpperCase() + '.';
  } else {__witness_a01hn3.c(4, 1);}
  __witness_a01hn3.s(13);return parts.map((p) => (__witness_a01hn3.f(4), __witness_a01hn3.s(14), p.charAt(0).toUpperCase() + '.')).join('');
}

/** Shorten a first name for a casual greeting. */
export function nickname(fullName: string, maxLen = (__witness_a01hn3.c(5, 0), 8)): string {__witness_a01hn3.f(5);
  const parts = __witness_a01hn3.v(15, "parts", fullName.split(/\s+/).filter((p) => (__witness_a01hn3.f(6), __witness_a01hn3.s(16), p)));
  const first = __witness_a01hn3.v(17, "first", parts.length > 0 ? (__witness_a01hn3.c(6, 0), parts[0]) : (__witness_a01hn3.c(6, 1), ''));
  __witness_a01hn3.s(18);if (first.length > maxLen) {__witness_a01hn3.c(7, 0);
    __witness_a01hn3.s(19);return first.slice(0, maxLen) + '.';
  } else {__witness_a01hn3.c(7, 1);}
  __witness_a01hn3.s(20);return first;
}
