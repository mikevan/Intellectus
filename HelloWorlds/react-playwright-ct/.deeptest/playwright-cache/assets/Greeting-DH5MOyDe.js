import { t as require_jsx_runtime } from "./jsx-runtime-CJaPXSUa.js";
//#region src/greet.ts
var import_jsx_runtime = require_jsx_runtime();
var __witness_wm5jwq = globalThis.__witness__.file("__witness_wm5jwq", {
	"path": "C:/workspace/HelloWorlds/react-playwright-ct/src/greet.ts",
	"statementMap": {
		"0": {
			"start": {
				"line": 4,
				"column": 2
			},
			"end": {
				"line": 6,
				"column": 3
			}
		},
		"1": {
			"start": {
				"line": 5,
				"column": 4
			},
			"end": {
				"line": 5,
				"column": 19
			}
		},
		"2": {
			"start": {
				"line": 7,
				"column": 2
			},
			"end": {
				"line": 7,
				"column": 27
			}
		},
		"3": {
			"start": {
				"line": 11,
				"column": 2
			},
			"end": {
				"line": 13,
				"column": 3
			}
		},
		"4": {
			"start": {
				"line": 12,
				"column": 4
			},
			"end": {
				"line": 12,
				"column": 19
			}
		},
		"5": {
			"start": {
				"line": 14,
				"column": 2
			},
			"end": {
				"line": 16,
				"column": 3
			}
		},
		"6": {
			"start": {
				"line": 15,
				"column": 4
			},
			"end": {
				"line": 15,
				"column": 27
			}
		},
		"7": {
			"start": {
				"line": 17,
				"column": 2
			},
			"end": {
				"line": 17,
				"column": 83
			}
		},
		"8": {
			"start": {
				"line": 21,
				"column": 2
			},
			"end": {
				"line": 21,
				"column": 49
			}
		}
	},
	"fnMap": {
		"0": {
			"name": "hello",
			"decl": {
				"start": {
					"line": 3,
					"column": 7
				},
				"end": {
					"line": 3,
					"column": 46
				}
			},
			"loc": {
				"start": {
					"line": 3,
					"column": 46
				},
				"end": {
					"line": 8,
					"column": 1
				}
			},
			"line": 3
		},
		"1": {
			"name": "helloMany",
			"decl": {
				"start": {
					"line": 10,
					"column": 7
				},
				"end": {
					"line": 10,
					"column": 51
				}
			},
			"loc": {
				"start": {
					"line": 10,
					"column": 51
				},
				"end": {
					"line": 18,
					"column": 1
				}
			},
			"line": 10
		},
		"2": {
			"name": "shout",
			"decl": {
				"start": {
					"line": 20,
					"column": 7
				},
				"end": {
					"line": 20,
					"column": 44
				}
			},
			"loc": {
				"start": {
					"line": 20,
					"column": 44
				},
				"end": {
					"line": 22,
					"column": 1
				}
			},
			"line": 20
		}
	},
	"branchMap": {
		"0": {
			"type": "default-arg",
			"line": 3,
			"loc": {
				"start": {
					"line": 3,
					"column": 22
				},
				"end": {
					"line": 3,
					"column": 36
				}
			},
			"locations": [{
				"start": {
					"line": 3,
					"column": 29
				},
				"end": {
					"line": 3,
					"column": 36
				}
			}]
		},
		"1": {
			"type": "if",
			"line": 4,
			"loc": {
				"start": {
					"line": 4,
					"column": 2
				},
				"end": {
					"line": 6,
					"column": 3
				}
			},
			"locations": [{
				"start": {
					"line": 4,
					"column": 13
				},
				"end": {
					"line": 6,
					"column": 3
				}
			}, {
				"start": {
					"line": 4,
					"column": 2
				},
				"end": {
					"line": 4,
					"column": 2
				}
			}]
		},
		"2": {
			"type": "if",
			"line": 11,
			"loc": {
				"start": {
					"line": 11,
					"column": 2
				},
				"end": {
					"line": 13,
					"column": 3
				}
			},
			"locations": [{
				"start": {
					"line": 11,
					"column": 26
				},
				"end": {
					"line": 13,
					"column": 3
				}
			}, {
				"start": {
					"line": 11,
					"column": 2
				},
				"end": {
					"line": 11,
					"column": 2
				}
			}]
		},
		"3": {
			"type": "if",
			"line": 14,
			"loc": {
				"start": {
					"line": 14,
					"column": 2
				},
				"end": {
					"line": 16,
					"column": 3
				}
			},
			"locations": [{
				"start": {
					"line": 14,
					"column": 26
				},
				"end": {
					"line": 16,
					"column": 3
				}
			}, {
				"start": {
					"line": 14,
					"column": 2
				},
				"end": {
					"line": 14,
					"column": 2
				}
			}]
		}
	},
	"skipped": []
});
function hello(name = (__witness_wm5jwq.c(0, 0), "World")) {
	__witness_wm5jwq.f(0);
	__witness_wm5jwq.s(0);
	if (!name) {
		__witness_wm5jwq.c(1, 0);
		__witness_wm5jwq.s(1);
		name = "World";
	} else __witness_wm5jwq.c(1, 1);
	__witness_wm5jwq.s(2);
	return `Hello, ${name}!`;
}
function helloMany(names) {
	__witness_wm5jwq.f(1);
	__witness_wm5jwq.s(3);
	if (names.length === 0) {
		__witness_wm5jwq.c(2, 0);
		__witness_wm5jwq.s(4);
		return hello();
	} else __witness_wm5jwq.c(2, 1);
	__witness_wm5jwq.s(5);
	if (names.length === 1) {
		__witness_wm5jwq.c(3, 0);
		__witness_wm5jwq.s(6);
		return hello(names[0]);
	} else __witness_wm5jwq.c(3, 1);
	__witness_wm5jwq.s(7);
	return `Hello, ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}!`;
}
function shout(text) {
	__witness_wm5jwq.f(2);
	__witness_wm5jwq.s(8);
	return text.toUpperCase().replace(/!/g, "!!!");
}
//#endregion
//#region src/components/Greeting.tsx
var __witness_1kaxuph = globalThis.__witness__.file("__witness_1kaxuph", {
	"path": "C:/workspace/HelloWorlds/react-playwright-ct/src/components/Greeting.tsx",
	"statementMap": {
		"0": {
			"start": {
				"line": 10,
				"column": 15
			},
			"end": {
				"line": 10,
				"column": 53
			}
		},
		"1": {
			"start": {
				"line": 11,
				"column": 2
			},
			"end": {
				"line": 11,
				"column": 46
			}
		}
	},
	"fnMap": { "0": {
		"name": "Greeting",
		"decl": {
			"start": {
				"line": 9,
				"column": 7
			},
			"end": {
				"line": 9,
				"column": 109
			}
		},
		"loc": {
			"start": {
				"line": 9,
				"column": 109
			},
			"end": {
				"line": 12,
				"column": 1
			}
		},
		"line": 9
	} },
	"branchMap": {
		"0": {
			"type": "default-arg",
			"line": 9,
			"loc": {
				"start": {
					"line": 9,
					"column": 40
				},
				"end": {
					"line": 9,
					"column": 52
				}
			},
			"locations": [{
				"start": {
					"line": 9,
					"column": 47
				},
				"end": {
					"line": 9,
					"column": 52
				}
			}]
		},
		"1": {
			"type": "cond-expr",
			"line": 10,
			"loc": {
				"start": {
					"line": 10,
					"column": 15
				},
				"end": {
					"line": 10,
					"column": 53
				}
			},
			"locations": [{
				"start": {
					"line": 10,
					"column": 23
				},
				"end": {
					"line": 10,
					"column": 39
				}
			}, {
				"start": {
					"line": 10,
					"column": 42
				},
				"end": {
					"line": 10,
					"column": 53
				}
			}]
		},
		"2": {
			"type": "cond-expr",
			"line": 11,
			"loc": {
				"start": {
					"line": 11,
					"column": 14
				},
				"end": {
					"line": 11,
					"column": 39
				}
			},
			"locations": [{
				"start": {
					"line": 11,
					"column": 21
				},
				"end": {
					"line": 11,
					"column": 32
				}
			}, {
				"start": {
					"line": 11,
					"column": 35
				},
				"end": {
					"line": 11,
					"column": 39
				}
			}]
		}
	},
	"skipped": []
});
/**
* The greeting component. Every path through greet.ts is reached from here,
* because in a component-testing project the page is what gets measured:
* a function a test calls in Node is not counted, so the tests go through
* the component.
*/
function Greeting({ name, names, loud = (__witness_1kaxuph.c(0, 0), false) }) {
	__witness_1kaxuph.f(0);
	const text = __witness_1kaxuph.v(0, "text", names ? (__witness_1kaxuph.c(1, 0), helloMany(names)) : (__witness_1kaxuph.c(1, 1), hello(name)));
	__witness_1kaxuph.s(1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: loud ? (__witness_1kaxuph.c(2, 0), shout(text)) : (__witness_1kaxuph.c(2, 1), text) });
}
//#endregion
export { Greeting };

//# sourceMappingURL=Greeting-DH5MOyDe.js.map