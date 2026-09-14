// SPDX-License-Identifier: Apache-2.0

import { env } from "node:process";
import { suite, test } from "node:test";

import { javascript } from "@ericcornelissen/arbitrary-javascript";
import * as fc from "fast-check";

import { process } from "./main.js";

if (env.MUTATION_TESTING) {
	fc.configureGlobal({ numRuns: 0 });
}

const baseHooks = Object.freeze({
	blockComment: (x) => x,
	lineComment: (x) => x,
	statement: (x) => x,
});

suite("lineComment", () => {
	suite("calls", () => {
		const testdata = {
			"basic, comment with line feed": {
				code: "var foo; // bar\n",
				calls: [["// bar"]],
			},
			"basic, comment with carriage return+line feed": {
				code: "var foo; // bar\r\n",
				calls: [["// bar"]],
			},
			"only a comment": {
				code: "// foobar",
				calls: [["// foobar"]],
			},
			"only an empty comment": {
				code: "//",
				calls: [["//"]],
			},
			"only an empty comment with line feed": {
				code: "//\n",
				calls: [["//"]],
			},
			"only an empty comment with carriage return+line feed": {
				code: "//\r\n",
				calls: [["//"]],
			},
			"consecutive line comments": {
				code: "// hello\n// world\n",
				calls: [["// hello\n// world"]],
			},
			"consecutive line comments, indented": {
				code: "  // hello\n  // world\n",
				calls: [["// hello\n  // world"]],
			},
			"consecutive line comments, multiple": {
				code: "// foo\n  // bar\n// baz\n",
				calls: [["// foo\n  // bar\n// baz"]],
			},
			"line comment followed by a block comment": {
				code: "// hello\n/* world */",
				calls: [["// hello"]],
			},
			"line comment lead by a block comment": {
				code: "/* hello */// world\n",
				calls: [["// world"]],
			},
			"line comment with a line comment inside": {
				code: "// hello // world",
				calls: [["// hello // world"]],
			},
			"line comment with a block comment inside": {
				code: "// foo /* bar */ baz",
				calls: [["// foo /* bar */ baz"]],
			},
			"line comment mixed in with if-then": {
				code: "if // condition\n(foo) // branch\n{ bar(); }",
				calls: [["// condition"], ["// branch"]],
			},
			"line comment mixed in variable declaration": {
				code: "var // ident\n  foo = // gets\n  'bar' // value",
				calls: [["// ident"], ["// gets"], ["// value"]],
			},
		};

		for (const [name, testcase] of Object.entries(testdata)) {
			test(name, (t) => {
				const { code, calls } = testcase;

				const hooks = {
					...baseHooks,
					lineComment: t.mock.fn((x) => x),
				};

				const _ = process(code, hooks);
				t.assert.deepStrictEqual(
					hooks.lineComment.mock.calls.map((call) => call.arguments),
					calls,
				);
			});
		}
	});

	suite("returns", () => {
		const testdata = {
			"preserve basic comment": {
				code: "var foo = 'bar'; // baz\n",
				hook: (x) => x,
				want: "var foo = 'bar'; // baz\n",
			},
			"change basic comment": {
				code: "var foo = 'bar'; // baz\n",
				hook: () => "// bar",
				want: "var foo = 'bar'; // bar\n",
			},
			"strip basic comment": {
				code: "var foo = 'bar'; // baz\n",
				hook: () => "",
				want: "var foo = 'bar';",
			},
			"preserve leading comment": {
				code: '// hello\nvar world = "\\!";',
				hook: (x) => x,
				want: '// hello\nvar world = "\\!";',
			},
			"change leading comment": {
				code: '// hello\nvar world = "\\!";',
				hook: () => "// hej",
				want: '// hej\nvar world = "\\!";',
			},
			"strip leading comment": {
				code: '// hello\nvar world = "\\!";',
				hook: () => "",
				want: 'var world = "\\!";',
			},
			"preserve trailing comment": {
				code: "var foo = `bar`; // baz",
				hook: (x) => x,
				want: "var foo = `bar`; // baz",
			},
			"change trailing comment": {
				code: "var foo = `bar`; // baz",
				hook: () => "// bar",
				want: "var foo = `bar`; // bar",
			},
			"strip trailing comment": {
				code: "var foo = `bar`; // baz",
				hook: () => "",
				want: "var foo = `bar`;",
			},
			"strip trailing comment after line feed": {
				code: "var foo = /bar/;\n// baz\n",
				hook: () => "",
				want: "var foo = /bar/;\n",
			},
			"strip trailing comment after line feed, no line feed": {
				code: "var foo = /bar/;\n// baz",
				hook: () => "",
				want: "var foo = /bar/;\n",
			},
			"strip trailing comment after carriage return+line feed": {
				code: "var foo = /bar/;\r\n// baz\r\n",
				hook: () => "",
				want: "var foo = /bar/;\r\n",
			},
			"strip line with only a line comment": {
				code: "{\n  var foo;\n  // bar\n  var baz;\n}",
				hook: () => "",
				want: "{\n  var foo;\n  var baz;\n}",
			},
			"strip line with only a line comment, w/ carriage return": {
				code: "{\n  var foo;\r\n  // bar\r\n  var baz;\n}",
				hook: () => "",
				want: "{\n  var foo;\r\n  var baz;\n}",
			},
			"strip only a comment": {
				code: "// foobar",
				hook: () => "",
				want: "",
			},
		};

		for (const [name, testcase] of Object.entries(testdata)) {
			test(name, (t) => {
				const { code, hook, want } = testcase;

				const hooks = {
					...baseHooks,
					lineComment: hook,
				};

				const got = process(code, hooks);
				t.assert.strictEqual(got, want);
			});
		}
	});
});

suite("blockComment", () => {
	suite("calls", () => {
		const testdata = {
			"basic comment": {
				code: "var foo; /* bar */",
				calls: [["/* bar */"]],
			},
			"only a comment": {
				code: "/* foobar */",
				calls: [["/* foobar */"]],
			},
			"only an empty comment": {
				code: "/**/",
				calls: [["/**/"]],
			},
			"a comment with only a '/'": {
				code: "/*/*/",
				calls: [["/*/*/"]],
			},
			"a comment with only a '*'": {
				code: "/***/",
				calls: [["/***/"]],
			},
			"a comment with '/*'": {
				code: "/* /* */",
				calls: [["/* /* */"]],
			},
			"a comment with '*/'": {
				code: "/* * / */",
				calls: [["/* * / */"]],
			},
			"a comment with a line feed": {
				code: "/* a\nb */",
				calls: [["/* a\nb */"]],
			},
			"a comment with a carriage return+line feed": {
				code: "/* a\r\nb */",
				calls: [["/* a\r\nb */"]],
			},
			"block comment followed by a block comment": {
				code: "/* hello */// world\n",
				calls: [["/* hello */"]],
			},
			"block comment lead by a block comment": {
				code: "// hello\n/* world */",
				calls: [["/* world */"]],
			},
			"block comment with a line comment inside": {
				code: "/* hello // world */",
				calls: [["/* hello // world */"]],
			},
			"block comment mixed in with class": {
				code: "class /* name */ Foo /* optional */ extends /* super */ Bar /* definition */ {}",
				calls: [
					["/* name */"],
					["/* optional */"],
					["/* super */"],
					["/* definition */"],
				],
			},
			"block comment mixed in with do-while": {
				code: "do /* body */ {} /* condition */ while (true)",
				calls: [["/* body */"], ["/* condition */"]],
			},
			"block comment mixed in with for-loop": {
				code: "for /* condition */ (let a in b) /* body */ {}",
				calls: [["/* condition */"], ["/* body */"]],
			},
			"block comment mixed in with function statement": {
				code: "function /* ident */ f /* args */ () /* body */ {}",
				calls: [["/* ident */"], ["/* args */"], ["/* body */"]],
			},
			"block comment mixed in with generator statement": {
				code: "function /* generator */ * /* ident */ g /* args */ () /* body */ {}",
				calls: [
					["/* generator */"],
					["/* ident */"],
					["/* args */"],
					["/* body */"],
				],
			},
			"block comment mixed in with if-then": {
				code: "if /* condition */ (foo) /* branch */ { bar(); }",
				calls: [["/* condition */"], ["/* branch */"]],
			},
			"block comment mixed in with else-then": {
				code: "if (foo) {} /* else */ else /* branch */ { baz(); }",
				calls: [["/* else */"], ["/* branch */"]],
			},
			"block comment mixed in with else-if-then": {
				code: "if(a){}else/*else*/if/*condition*/(b)/*branch*/{c();}",
				calls: [["/*else*/"], ["/*condition*/"], ["/*branch*/"]],
			},
			"block comment mixed in with switch-case": {
				code: "switch /* expr */ (foo) /* branches */ {\n/* case #1 */\ncase /* expr */ 'bar' /* branch */: /* body */ return 'baz';\n/* case #2 */case 'baz': 'bar' /* fallthrough */\n/* default case */default /* no condition */: /* body */ {\n  break;\n}}",
				calls: [
					["/* expr */"],
					["/* branches */"],
					["/* case #1 */"],
					["/* expr */"],
					["/* branch */"],
					["/* body */"],
					["/* case #2 */"],
					["/* fallthrough */"],
					["/* default case */"],
					["/* no condition */"],
					["/* body */"],
				],
			},
			"block comment mixed in with while-do": {
				code: "while /* condition */ (false) /* body */ {}",
				calls: [["/* condition */"], ["/* body */"]],
			},
			"block comment mixed in with with-do": {
				code: "with /* context */ (false) /* body */ {}",
				calls: [["/* context */"], ["/* body */"]],
			},
			"block comment mixed in variable declaration": {
				code: "var /* ident */ foo /* gets */ = /* value */ 'bar' /* semi */;",
				calls: [
					["/* ident */"],
					["/* gets */"],
					["/* value */"],
					["/* semi */"],
				],
			},
			"block comment mixed in multiline expression": {
				code: "arr.map(x => x + 1)\n/*sum*/.reduce((a, x) => a+x, 0);",
				calls: [["/*sum*/"]],
			},
		};

		for (const [name, testcase] of Object.entries(testdata)) {
			test(name, (t) => {
				const { code, calls } = testcase;

				const hooks = {
					...baseHooks,
					blockComment: t.mock.fn((x) => x),
				};

				const _ = process(code, hooks);
				t.assert.deepStrictEqual(
					hooks.blockComment.mock.calls.map((call) => call.arguments),
					calls,
				);
			});
		}
	});

	suite("returns", () => {
		const testdata = {
			"preserve basic comment": {
				code: "var foo = 'bar'; /* baz */",
				hook: (x) => x,
				want: "var foo = 'bar'; /* baz */",
			},
			"change basic comment": {
				code: "var foo = 'bar'; /* baz */",
				hook: () => "/* bar */",
				want: "var foo = 'bar'; /* bar */",
			},
			"strip basic comment": {
				code: "var foo = 'bar'; /* baz */",
				hook: () => "",
				want: "var foo = 'bar';",
			},
			"preserve leading comment": {
				code: '/* hello */var world = "\\!";',
				hook: (x) => x,
				want: '/* hello */var world = "\\!";',
			},
			"change leading comment": {
				code: '/* hello */var world = "\\!";',
				hook: () => "/* hej */",
				want: '/* hej */var world = "\\!";',
			},
			"strip leading comment": {
				code: '/* hello */var world = "\\!";',
				hook: () => "",
				want: 'var world = "\\!";',
			},
			"preserve trailing comment": {
				code: "var foo = `bar`; /* baz */",
				hook: (x) => x,
				want: "var foo = `bar`; /* baz */",
			},
			"change trailing comment": {
				code: "var foo = `bar`; /* baz */",
				hook: () => "/* bar */",
				want: "var foo = `bar`; /* bar */",
			},
			"strip trailing comment": {
				code: "var foo = `bar`; /* baz */",
				hook: () => "",
				want: "var foo = `bar`;",
			},
			"strip trailing comment after line feed": {
				code: "var foo = /bar/;\n/* baz */",
				hook: () => "",
				want: "var foo = /bar/;",
			},
			"strip trailing comment after carriage return+line feed": {
				code: "var foo = /bar/;\r\n/* baz */",
				hook: () => "",
				want: "var foo = /bar/;",
			},
			"strip trailing comment after line feed, extra line feed": {
				code: "var foo = /bar/;\n/* baz */\n",
				hook: () => "",
				want: "var foo = /bar/;\n",
			},
			"strip trailing comment after carriage return+line feed, extra newline": {
				code: "var foo = /bar/;\r\n/* baz */\r\n",
				hook: () => "",
				want: "var foo = /bar/;\r\n",
			},
			"strip leading comment, no newline": {
				code: "/* foo */var bar;",
				hook: () => "",
				want: "var bar;",
			},
			"strip leading comment, line feed": {
				code: "/* foo */\nvar bar;",
				hook: () => "",
				want: "var bar;",
			},
			"strip leading comment, carriage return+line feed": {
				code: "/* foo */\r\nvar bar;",
				hook: () => "",
				want: "var bar;",
			},
			"strip only a comment": {
				code: "/* foobar */",
				hook: () => "",
				want: "",
			},
		};

		for (const [name, testcase] of Object.entries(testdata)) {
			test(name, (t) => {
				const { code, hook, want } = testcase;

				const hooks = {
					...baseHooks,
					blockComment: hook,
				};

				const got = process(code, hooks);
				t.assert.strictEqual(got, want);
			});
		}
	});
});

suite("statement", () => {
	suite("calls", () => {
		const testdata = {
			"basic, one statement": {
				code: "var foobar;",
				calls: [["var foobar;"]],
			},
			"basic, two statements": {
				code: "var foo; var bar;",
				calls: [["var foo;"], ["var bar;"]],
			},
			"basic, block statement": {
				code: "{ var foobar; }",
				calls: [["var foobar;"], ["{ var foobar; }"]],
			},
			"basic, single quoted string": {
				code: "var x = 'y;';",
				calls: [["var x = 'y;';"]],
			},
			"basic, double quoted string": {
				code: 'let y = "z;";',
				calls: [['let y = "z;";']],
			},
			"basic, template literal": {
				code: "const z = `a;`;",
				calls: [["const z = `a;`;"]],
			},
			"basic, template literal with expression": {
				code: "const a = `b${c}d`",
				calls: [["const a = `b${c}d`"]],
			},
			"basic, arrow function, expression": {
				code: "const foo = () => 'bar';",
				calls: [["const foo = () => 'bar';"]],
			},
			"basic, arrow function, block": {
				code: "const foo = () => {\n  return 'bar';\n}",
				calls: [["return 'bar';"], ["const foo = () => {\n  return 'bar';\n}"]],
			},
			"basic, function value": {
				code: "const foo = function() {\n  return 'bar';\n}",
				calls: [
					["return 'bar';"],
					["const foo = function() {\n  return 'bar';\n}"],
				],
			},
			"basic, object literal": {
				code: "const obj = {\n  foo: 'bar'\n};",
				calls: [["const obj = {\n  foo: 'bar'\n};"]],
			},
			"basic, object literal, method": {
				code: "const obj = {\n  foo() { return 'bar'; }\n};",
				calls: [
					["return 'bar';"],
					["const obj = {\n  foo() { return 'bar'; }\n};"],
				],
			},
			"basic, class": {
				code: "class Example {\n  constructor() {\n    super();\n  }\n}",
				calls: [
					["super();"],
					["constructor() {\n    super();\n  }"],
					["class Example {\n  constructor() {\n    super();\n  }\n}"],
				],
			},
			"basic, class extends": {
				code: "class Foo extends Bar {\n  constructor() {\n    super();\n  }\n}",
				calls: [
					["super();"],
					["constructor() {\n    super();\n  }"],
					["class Foo extends Bar {\n  constructor() {\n    super();\n  }\n}"],
				],
			},
			"basic, do-while, block": {
				code: "do {\n  console.log(x);\n} while (y)",
				calls: [
					["console.log(x);"],
					["{\n  console.log(x);\n}"],
					["do {\n  console.log(x);\n} while (y)"],
				],
			},
			"basic, do-while, expression": {
				code: "do console.log(x); while (y)",
				calls: [["console.log(x);"], ["do console.log(x); while (y)"]],
			},
			"basic, for-loop, block": {
				code: "for (var i = 0; i < 10; i++) {console.log(x);}",
				calls: [
					["console.log(x);"],
					["{console.log(x);}"],
					["for (var i = 0; i < 10; i++) {console.log(x);}"],
				],
			},
			"basic, for-loop, expression": {
				code: "for (const x  in y) console.log(x);",
				calls: [["console.log(x);"], ["for (const x  in y) console.log(x);"]],
			},
			"basic, function statement": {
				code: "function f() {\n  var foobar;\n}",
				calls: [["var foobar;"], ["function f() {\n  var foobar;\n}"]],
			},
			"basic, if-then, block": {
				code: "if (a) {\n  console.log(x);\n}",
				calls: [
					["console.log(x);"],
					["{\n  console.log(x);\n}"],
					["if (a) {\n  console.log(x);\n}"],
				],
			},
			"basic, if-then, block, else, block": {
				code: "if (a) {\n  console.log(x);\n} else {\n  console.log(y);\n}",
				calls: [
					["console.log(x);"],
					["{\n  console.log(x);\n}"],
					["console.log(y);"],
					["{\n  console.log(y);\n}"],
					["if (a) {\n  console.log(x);\n} else {\n  console.log(y);\n}"],
				],
			},
			"basic, if-then, block, else, expression": {
				code: "if (a) {\n  console.log(x);\n} else console.log(y);",
				calls: [
					["console.log(x);"],
					["{\n  console.log(x);\n}"],
					["console.log(y);"],
					["if (a) {\n  console.log(x);\n} else console.log(y);"],
				],
			},
			"basic, if-then, block, else-if, block": {
				code: "if (a) {\n  x();\n} else if (b) {\n  y();\n}",
				calls: [
					["x();"],
					["{\n  x();\n}"],
					["y();"],
					["{\n  y();\n}"],
					["if (b) {\n  y();\n}"],
					["if (a) {\n  x();\n} else if (b) {\n  y();\n}"],
				],
			},
			"basic, if-then, block, else-if, expression": {
				code: "if (a) {\n  x();\n} else if (b) y();",
				calls: [
					["x();"],
					["{\n  x();\n}"],
					["y();"],
					["if (b) y();"],
					["if (a) {\n  x();\n} else if (b) y();"],
				],
			},
			"basic, if-then, expression": {
				code: "if (a) console.log(x);",
				calls: [["console.log(x);"], ["if (a) console.log(x);"]],
			},
			"basic, if-then, expression, else, block": {
				code: "if (a) console.log(x);\nelse { console.log(y); }",
				calls: [
					["console.log(x);"],
					["console.log(y);"],
					["{ console.log(y); }"],
					["if (a) console.log(x);\nelse { console.log(y); }"],
				],
			},
			"basic, if-then, expression, else, expression": {
				code: "if (a) console.log(x);\nelse console.log(y);",
				calls: [
					["console.log(x);"],
					["console.log(y);"],
					["if (a) console.log(x);\nelse console.log(y);"],
				],
			},
			"basic, if-then, expression, else-if, block": {
				code: "if (a) x();\nelse if (b) { y(); }",
				calls: [
					["x();"],
					["y();"],
					["{ y(); }"],
					["if (b) { y(); }"],
					["if (a) x();\nelse if (b) { y(); }"],
				],
			},
			"basic, if-then, expression, else-if, expression": {
				code: "if (a) x();\nelse if (b) y();",
				calls: [
					["x();"],
					["y();"],
					["if (b) y();"],
					["if (a) x();\nelse if (b) y();"],
				],
			},
			"basic, switch with one case, expression": {
				code: "switch (x) {\ncase 'a': return 'b'\n}",
				calls: [["return 'b'"], ["switch (x) {\ncase 'a': return 'b'\n}"]],
			},
			"basic, switch with one case, block": {
				code: "switch (x) {\ncase 'c': {\n  y();\n  break;}}",
				calls: [
					["y();"],
					["break;"],
					["{\n  y();\n  break;}"],
					["switch (x) {\ncase 'c': {\n  y();\n  break;}}"],
				],
			},
			"basic, switch with multiple cases": {
				code: "switch (x) {\ncase 'a': return 'b'\ncase 'c': {\n  break;\n}\n}",
				calls: [
					["return 'b'"],
					["break;"],
					["{\n  break;\n}"],
					["switch (x) {\ncase 'a': return 'b'\ncase 'c': {\n  break;\n}\n}"],
				],
			},
			"basic, switch with case-case": {
				code: "switch (x) {\ncase 'a':\ncase 'b': {\n  return 'c';\n}\n}",
				calls: [
					["return 'c';"],
					["{\n  return 'c';\n}"],
					["switch (x) {\ncase 'a':\ncase 'b': {\n  return 'c';\n}\n}"],
				],
			},
			"basic, switch with default, expression": {
				code: "switch (x) {\ncase 'a': return 'b'\ndefault: return 'z'}",
				calls: [
					["return 'b'"],
					["return 'z'"],
					["switch (x) {\ncase 'a': return 'b'\ndefault: return 'z'}"],
				],
			},
			"basic, switch with default, block": {
				code: "switch (x) {\ncase 'a': return 'b'\ndefault: {\n  return;\n}\n}",
				calls: [
					["return 'b'"],
					["return;"],
					["{\n  return;\n}"],
					["switch (x) {\ncase 'a': return 'b'\ndefault: {\n  return;\n}\n}"],
				],
			},
			"basic, switch with case+default": {
				code: "switch (x) {\ncase 'a':\ndefault: {\n  return;\n}\n}",
				calls: [
					["return;"],
					["{\n  return;\n}"],
					["switch (x) {\ncase 'a':\ndefault: {\n  return;\n}\n}"],
				],
			},
			"basic, try-catch, with error": {
				code: "try { throw new Error(); } catch (error) { console.log(error); }",
				calls: [
					["throw new Error();"],
					["console.log(error);"],
					["try { throw new Error(); } catch (error) { console.log(error); }"],
				],
			},
			"basic, try-catch, without error": {
				code: "try { throw new Error(); } catch { console.log('error'); }",
				calls: [
					["throw new Error();"],
					["console.log('error');"],
					["try { throw new Error(); } catch { console.log('error'); }"],
				],
			},
			"basic, try-catch-finally, without error": {
				code: "try {print('t')} catch (e) {print('c')} finally {print('f')}",
				calls: [
					["print('t')"],
					["print('c')"],
					["print('f')"],
					["try {print('t')} catch (e) {print('c')} finally {print('f')}"],
				],
			},
			"basic, try-catch-finally, without error": {
				code: "try {print('t')} catch {print('c')} finally {print('f')}",
				calls: [
					["print('t')"],
					["print('c')"],
					["print('f')"],
					["try {print('t')} catch {print('c')} finally {print('f')}"],
				],
			},
			"basic, try-finally, without error": {
				code: "try {print('t')} finally {print('f')}",
				calls: [
					["print('t')"],
					["print('f')"],
					["try {print('t')} finally {print('f')}"],
				],
			},
			"basic, while-do, block": {
				code: "while (x) {\n  console.log(y);\n}",
				calls: [
					["console.log(y);"],
					["{\n  console.log(y);\n}"],
					["while (x) {\n  console.log(y);\n}"],
				],
			},
			"basic, while-do, expression": {
				code: "while (x) console.log(y);",
				calls: [["console.log(y);"], ["while (x) console.log(y);"]],
			},
			"basic, with, block": {
				code: "with (x) {\n  console.log(y);\n}",
				calls: [
					["console.log(y);"],
					["{\n  console.log(y);\n}"],
					["with (x) {\n  console.log(y);\n}"],
				],
			},
			"basic, with, expression": {
				code: "with (x) console.log(y);",
				calls: [["console.log(y);"], ["with (x) console.log(y);"]],
			},
			"automatic semicolon insertion, line feed": {
				code: "var foo\nvar bar;",
				calls: [["var foo"], ["var bar;"]],
			},
			"automatic semicolon insertion, carriage return+line feed": {
				code: "var foo\r\nvar bar;",
				calls: [["var foo"], ["var bar;"]],
			},
			"automatic semicolon insertion, end of block": {
				code: "{var foobar}",
				calls: [["var foobar"], ["{var foobar}"]],
			},
			"automatic semicolon insertion, end of file": {
				code: "var foo;var bar",
				calls: [["var foo;"], ["var bar"]],
			},
			"automatic semicolon insertion, MDN example #1": {
				code: "{ 1\n2 } 3",
				calls: [["1"], ["2"], ["{ 1\n2 }"], ["3"]],
			},
			"automatic semicolon insertion, MDN example #2": {
				code: "do {\n// …\n} while (condition) /* ; */ // ASI here\nconst a = 1",
				calls: [
					["{\n// …\n}"],
					["do {\n// …\n} while (condition)"],
					["const a = 1"],
				],
			},
			"no semicolon insertion, line feed before '.'": {
				code: "var foo = bar\n.baz;",
				calls: [["var foo = bar\n.baz;"]],
			},
			"no semicolon insertion, carriage return+line feed before '.'": {
				code: "var foo = bar\r\n  .baz;",
				calls: [["var foo = bar\r\n  .baz;"]],
			},
			"no semicolon insertion, line feed before '='": {
				code: "var foo\n='bar';",
				calls: [["var foo\n='bar';"]],
			},
			"no semicolon insertion, carriage return+line feed before '='": {
				code: "var foo\r\n  = 'bar';",
				calls: [["var foo\r\n  = 'bar';"]],
			},
			"no semicolon insertion, TODO": {
				code: "function f(y) {\n  var x = y\n  var z = x\n}",
				calls: [
					["var x = y"],
					["var z = x"],
					["function f(y) {\n  var x = y\n  var z = x\n}"],
				],
			},
			"no semicolon insertion, newline after return": {
				code: "function f(y) {\n  return\n  var x = y\n}",
				calls: [
					["return"],
					["var x = y"],
					["function f(y) {\n  return\n  var x = y\n}"],
				],
			},
			"variable declaration on the next line": {
				code: "var foo =\n  'bar';",
				calls: [["var foo =\n  'bar';"]],
			},
			"method call on the next line": {
				code: "var foo = bar.\ntoString();",
				calls: [["var foo = bar.\ntoString();"]],
			},
			"method call on the next-next line": {
				code: "var foo = bar.\n\ntoString();",
				calls: [["var foo = bar.\n\ntoString();"]],
			},
			"method call on the next line, with block comment": {
				code: "arr.map(x => x + 1)\n/*sum*/.reduce((a, x) => a+x, 0);",
				calls: [["arr.map(x => x + 1)\n/*sum*/.reduce((a, x) => a+x, 0);"]],
			},
			"function expression body on next line": {
				code: "const foo = function()\n{return 'bar';}",
				calls: [["return 'bar';"], ["const foo = function()\n{return 'bar';}"]],
			},
			"arrow function followed by control flow": {
				code: "const foo = () => 'bar';function hello(){return world;}",
				calls: [
					["const foo = () => 'bar';"],
					["return world;"],
					["function hello(){return world;}"],
				],
			},
			"do-while do-while": {
				code: "do console.log(x); while (y)",
				calls: [["console.log(x);"], ["do console.log(x); while (y)"]],
			},
			"for-loop for-loop": {
				code: "for (let a in b) for (let c of d) console.log(e);",
				calls: [
					["console.log(e);"],
					["for (let c of d) console.log(e);"],
					["for (let a in b) for (let c of d) console.log(e);"],
				],
			},
			"if-then if-then": {
				code: "if (a) if (b) console.log(c);",
				calls: [
					["console.log(c);"],
					["if (b) console.log(c);"],
					["if (a) if (b) console.log(c);"],
				],
			},
			"switch-case if-then": {
				code: "switch (a) {\ncase b: if (c) console.log(d)\n}",
				calls: [
					["console.log(d)"],
					["if (c) console.log(d)"],
					["switch (a) {\ncase b: if (c) console.log(d)\n}"],
				],
			},
			"while-do while-do": {
				code: "while (a) while (b) console.log(c);",
				calls: [
					["console.log(c);"],
					["while (b) console.log(c);"],
					["while (a) while (b) console.log(c);"],
				],
			},
			"with-do with-do": {
				code: "with (a) with (b) console.log(c);",
				calls: [
					["console.log(c);"],
					["with (b) console.log(c);"],
					["with (a) with (b) console.log(c);"],
				],
			},
			"if-then for-loop while-do": {
				code: "if (a) for (b in c) while (d) e",
				calls: [
					["e"],
					["while (d) e"],
					["for (b in c) while (d) e"],
					["if (a) for (b in c) while (d) e"],
				],
			},
		};

		for (const [name, testcase] of Object.entries(testdata)) {
			test(name, (t) => {
				const { code, calls } = testcase;

				const hooks = {
					...baseHooks,
					statement: t.mock.fn((x) => x),
				};

				const _ = process(code, hooks);
				t.assert.deepStrictEqual(
					hooks.statement.mock.calls.map((call) => call.arguments),
					calls,
				);
			});
		}
	});

	suite("returns", () => {
		const testdata = {
			"preserve basic statement": {
				code: "var foo = 'bar';",
				hook: (x) => x,
				want: "var foo = 'bar';",
			},
			"change basic statement": {
				code: "var foo = 'bar';",
				hook: () => "var foo='bar';",
				want: "var foo='bar';",
			},
			"strip basic statement": {
				code: "var foo = 'bar';",
				hook: () => "",
				want: "",
			},
			"strip a nested statement": {
				code: "if (x) { y() }",
				hook: (x) => (x === "y()" ? "" : x),
				want: "if (x) { }",
			},
		};

		for (const [name, testcase] of Object.entries(testdata)) {
			test(name, (t) => {
				const { code, hook, want } = testcase;

				const hooks = {
					...baseHooks,
					statement: hook,
				};

				const got = process(code, hooks);
				t.assert.strictEqual(got, want);
			});
		}
	});
});

suite("pathological input", () => {
	const testdata = {
		"single quote string with escaped '": "'a\\'b';",
		"single quote string with escaped character": "'a\\tb';",
		'double quote string with escaped "': '"a\\"b";',
		"double quote string with escaped character": '"a\\tb";',
		"template literal with escaped `": "`a\\`b`;",
		"template literal with escaped character": "`a\\tb`;",
		"template literal with escaped $, expr-like": "`a\\${b}c`;",
		"template literal with escaped $, non-expr": "`a$b`;",
		"division, basic": "3 / 14;",
		"division, after return regexp": "return /x/; 3/14;",
		"division, after void regexp": "void /x/; 3/14;",
		"division, after addition regex": "1 + /x/; 3/14;",
		"division, with parenthesis, lhs": "(3+1)/4;",
		"division, with parenthesis, rhs": "3/(1+4);",
		"division, with parenthesis, both": "(3+1)/(4);",
		"division, with parenthesis after control flow": "if(g){(1/2)/3}",
		"line comment in single quote string": "'// x';",
		"line comment in double quote string": '"// x";',
		"line comment in template literal": "`// x`;",
		"line comment in template literal expression": "`$}`;",
		"line comment before control flow block": "if (g) // '\n  f()",
		"line comment (like) in regexp": "/\\/\\//;",
		"line comment in regexp character class": "/[// x]/;",
		"block comment in single quote string": "'/* */ */';",
		"block comment in double quote string": '"/* */ */";',
		"block comment in template literal": "`/* */ */`;",
		"block comment before control flow block": "if (g) /* a/b */ f()",
		"block comment in regexp": "/\\/* */;",
		"block comment start in regexp": "/\\/*/;",
		"block comment end in regexp": "/ */;",
		"block comment in regexp char class": "/[/* */]/;",
		"block comment start in regexp char class": "/[/*]/;",
		"block comment end in regexp char class": "/[*/]/;",
		"block comment before control flow body": "if (g) /* a/b */ {}",
		"empty block statement": "{}",
		"empty block statement, whitespace": "{  }",
		"switch with default, space before ':'": "switch(x){default : break}",
		"keyword-like string literal": "'class';",
		"keyword-like string x": "    function f() {}",
		"regex with '/' in character class": "/[/]; var x = /;",
		"regex immediately followed by a line comment": "/'/ // '",
		"regex immediately followed by a block comment": "/'/ /* a/b */",
		"regex in var-assignment": "var regexp = /'/",
		"regex in let-assignment": "let regexp = /'/",
		"regex in const-assignment": "const regexp = /'/",
		"regex as array value, first": "let arr = [/'/]",
		"regex as array value, nth": "let arr = [3, 14, /'/]",
		"regex as object value": "let obj = { regexp: /'/ }",
		"regex as object key": "let obj = { [/'/]: 42 }",
		"regex as object index": "obj[/'/]",
		"regex as function argument, first": "f(/'/)",
		"regex as function argument, nth": "f(3, 14, /'/)",
		"regex as default parameter value": "f(regexp=/'/)",
		"regex as await expression": "await /'/",
		"regex as await expression, no space": "await/'/",
		"regex as call expression": "if (g) { /'/ (); }",
		"regex as call expression, no space": "if (g) { /'/(); }",
		"regex as delete expression": "delete /'/",
		"regex as delete expression, no space": "delete/'/",
		"regex in in-expression": "if(x in /'/) f()",
		"regex in in-expression, no space": "if(x in/'/) f()",
		"regex in instanceof-expression": "x => x instanceof /'/",
		"regex in instanceof-expression, no space": "x instanceof/'/",
		"regex as new expression": "new /'/",
		"regex as new expression, no space": "new/'/",
		"regex as return expression": "function f() { return /'/; }",
		"regex as return expression, no space": "{ return/'/; }",
		"regex as throw expression": "throw /'/",
		"regex as throw expression, no space": "throw/'/",
		"regex as typeof expression": "typeof /'/",
		"regex as typeof expression, no space": "typeof/'/",
		"regex as void expression": "void /'/",
		"regex as void expression, no space": "void/'/",
		"regex as yield expression": "function* g(){yield /'/}",
		"regex as yield expression, no space": "function* g(){yield/'/}",
		"regex as x expression in y expression": "void delete /'/",
		"regex as arrow function body": "() => /'/",
		"regex as arrow function body, no space": "() =>/'/",
		"regex as template literal expression": "\`\${/'/}\`",
		"regex as bare expression": ";/'/;",
		"regex as in comma operator, first": "/'/,3,14;",
		"regex as in comma operator, nth": "3,14,/'/;",
		"regex as for-in object": "for (var x in /'/) x",
		"regex as for-in body": "for (var x in arr) /'/",
		"regex as for-of object": "for (var x of /'/) x",
		"regex as for-of body": "for (var x of arr) /'/",
		"regex as for-loop, initialization": "for (let i = /'/; i<10; i++) i",
		"regex as for-loop, condition": "for (let i = 0; /'/; i++) i",
		"regex as for-loop, afterthought": "for (let i = 0; i<10; /'/) i",
		"regex as for-loop, body": "for (let i = 0; i<10; i++) /'/",
		"regex as do-while guard": "do {} while (/'/)",
		"regex as do-while body": "do /'/; while (g)",
		"regex as if guard": "if (/'/) {}",
		"regex as if body": "if (g) /'/",
		"regex as else if guard": "if (g1) {} else if (/'/) {}",
		"regex as else if body": "if (g1) {} else if (g2) /'/",
		"regex as else body": "if (g) {} else /'/",
		"regex as switch guard": "switch (/'/) {}",
		"regex as switch-case expression": "switch(x){case /'/: break}",
		"regex as switch-case expression, LF": "switch(x){case\n/'/: break}",
		"regex as switch-case expression, CRLF": "switch(x){case\r\n/'/: break}",
		"regex as switch-case body": "switch (x) {\ncase y: /'/\n}",
		"regex as switch-default body": "switch (x) {\ndefault: /'/\n}",
		"regex as while guard": "while (/'/) {}",
		"regex as while body": "while (g) /'/",
		"regex as with body": "with (x) /'/",
		"regex as control flow body, no space guard": "while(g) /'/",
		"regex as control flow body, more space guard": "while  (g) /'/",
		"regex as control flow body, no space body": "while (g)/'/",
		"regex as control flow body, more space body": "while (g)  /'/",
		"regex as control flow body, dividend": "while (g) /'/ / 14",
		"regex as control flow body, divisor": "while (g) 3 / /'/",
		"regex as control flow body, sub expression": "while(g)void /'/",
		"regex as control flow body, then block comment": "while(g)/'/ /* a/b */",
		"regex as control flow body, then line comment": "while(g)/'/ // '",
		"regex as control flow body, call": "while (g) /'/()",
		"regex as default export": "export default /'/",
		"regex inside block scope, bordering start": "{/'/ }",
		"regex inside block scope, bordering end": "{ /'/}",
		"regex after a block scope": "{var x;}/'/",
		"regex in unary plus": "var p = +/'/",
		"regex in unary minus": "var m = -/'/",
		"regex in bitwise not": "var bn = ~/'/",
		"regex in logical not": "var ln = !/'/",
		"regex in binary addition": "var a = 1 + /'/",
		"regex in binary subtraction": "var a = 1 - /'/",
		"regex in binary multiplication": "var a = 1 * /'/",
		"regex in binary division as dividend": "/'/ / x",
		"regex in binary division as divisor": "x / /'/",
		"regex in binary remainder as dividend": "/'/ % x",
		"regex in binary remainder as divisor": "x % /'/",
		"regex in binary exponentiation as exponent": "var e = 1**/'/",
		"regex in binary left shift": "var ls = x << /'/",
		"regex in binary right shift": "var rs = x >> /'/",
		"regex in binary unsigned right shift": "var urs = x >>> /'/",
		"regex in binary bitwise AND": "var ba = x & /'/",
		"regex in binary bitwise XOR": "var bx = x ^ /'/",
		"regex in binary bitwise OR": "var bo = x | /'/",
		"regex in binary logical AND": "var la = x && /'/",
		"regex in binary logical OR": "var lo = x || /'/",
		"regex in binary nullish coalescing": "var nc = x ?? /'/",
		"regex in binary greater than": "var gt = x > /'/",
		"regex in binary greater than or equal": "var gte = x >= /'/",
		"regex in binary less than": "var lt = x < /'/",
		"regex in binary less than or equal": "var lte = x <= /'/",
		"regex in binary equals": "if (x == /'/) {}",
		"regex in binary not equals": "if (x != /'/) {}",
		"regex in binary strict equals": "if (x === /'/) {}",
		"regex in binary not strict equals": "if (x !== /'/) {}",
		"regex in binary expression, \\t": "1 +\t/'/",
		"regex in binary expression, \\f": "1 +\f/'/",
		"regex in binary expression, \\v": "1 +\v/'/",
		"regex in binary expression, \\n": "1 +\n/'/",
		"regex in binary expression, \\r\\n": "1 +\r\n/'/",
		"regex in binary expression, \\u00a0": "1 +\u00a0/'/",
		"regex in binary expression, \\u1680": "1 +\u1680/'/",
		"regex in binary expression, \\u2000": "1 +\u2000/'/",
		"regex in binary expression, \\u2001": "1 +\u2001/'/",
		"regex in binary expression, \\u2002": "1 +\u2002/'/",
		"regex in binary expression, \\u2003": "1 +\u2003/'/",
		"regex in binary expression, \\u2004": "1 +\u2004/'/",
		"regex in binary expression, \\u2005": "1 +\u2005/'/",
		"regex in binary expression, \\u2006": "1 +\u2006/'/",
		"regex in binary expression, \\u2007": "1 +\u2007/'/",
		"regex in binary expression, \\u2008": "1 +\u2008/'/",
		"regex in binary expression, \\u2009": "1 +\u2009/'/",
		"regex in binary expression, \\u200a": "1 +\u200a/'/",
		"regex in binary expression, \\u2028": "1 +\u2028/'/",
		"regex in binary expression, \\u2029": "1 +\u2029/'/",
		"regex in binary expression, \\u202f": "1 +\u202f/'/",
		"regex in binary expression, \\u205f": "1 +\u205f/'/",
		"regex in binary expression, \\u3000": "1 +\u3000/'/",
		"regex in binary expression, \\ufeff": "1 +\ufeff/'/",
		"regex in ternary, condition": "var t = /'/ ? y : z",
		"regex in ternary, first branch": "var t = x ? /'/ : z",
		"regex in ternary, second branch": "var t = x ? y : /'/",
	};

	for (const [name, testcase] of Object.entries(testdata)) {
		test(name, (t) => {
			const code = testcase;

			t.assert.doesNotThrow(() => {
				const _ = process(code, baseHooks);
			});
		});
	}
});

suite("trimming", () => {
	const testdata = {
		"trim ' '": [" // comment", ""],
		"trim '\\t'": ["\t// comment", ""],
		"trim '\\f'": ["\f// comment", ""],
		"trim '\\v'": ["\v// comment", ""],
		"trim '\\u00a0'": ["\u00a0// comment", ""],
		"trim '\\u1680'": ["\u1680// comment", ""],
		"trim '\\u2000'": ["\u2000// comment", ""],
		"trim '\\u2001'": ["\u2001// comment", ""],
		"trim '\\u2002'": ["\u2002// comment", ""],
		"trim '\\u2003'": ["\u2003// comment", ""],
		"trim '\\u2004'": ["\u2004// comment", ""],
		"trim '\\u2005'": ["\u2005// comment", ""],
		"trim '\\u2000'": ["\u2006// comment", ""],
		"trim '\\u2007'": ["\u2007// comment", ""],
		"trim '\\u2008'": ["\u2008// comment", ""],
		"trim '\\u2009'": ["\u2009// comment", ""],
		"trim '\\u200a'": ["\u200a// comment", ""],
		"trim '\\u2028'": ["\u2028// comment", ""],
		"trim '\\u2029'": ["\u2029// comment", ""],
		"trim '\\u202f'": ["\u202f// comment", ""],
		"trim '\\u205f'": ["\u205f// comment", ""],
		"trim '\\u3000'": ["\u3000// comment", ""],
		"trim '\\ufeff'": ["\ufeff// comment", ""],
	};

	for (const [name, testcase] of Object.entries(testdata)) {
		test(name, (t) => {
			const [code, want] = testcase;

			const hooks = {
				...baseHooks,
				lineComment: () => "",
			};

			const got = process(code, hooks);
			t.assert.strictEqual(got, want);
		});
	}
});

suite("invalid source code", () => {
	const testdata = {
		"unmatched '{'": {
			code: "var foo = { bar ;",
			message: "Missing token '}'",
		},
		"unmatched '}'": {
			code: "var foo = 'bar'}",
			message: "Unexpected token '}'",
		},
		"unmatched '('": {
			code: "foo(",
			message: "Missing token ')'",
		},
		"unmatched ')'": {
			code: "foo)",
			message: "Unexpected token ')'",
		},
		"unmatched '['": {
			code: "foo[",
			message: "Missing token ']'",
		},
		"unmatched ']'": {
			code: "foo]",
			message: "Unexpected token ']'",
		},
		"unbalanced brackets, '{'-')'": {
			code: "{ let foo = 42 )",
			message: "Unexpected token ')'",
		},
		"unbalanced brackets, '{'-']'": {
			code: "{ let foo = bar0]",
			message: "Unexpected token ']'",
		},
		"unbalanced brackets, '('-'}'": {
			code: "if (bar === 42}",
			message: "Unexpected token '}'",
		},
		"unbalanced brackets, '('-']'": {
			code: "if (foo === bar0]",
			message: "Unexpected token ']'",
		},
		"unbalanced brackets, '['-'}'": {
			code: "foo['bar'}",
			message: "Unexpected token '}'",
		},
		"unbalanced brackets, '['-')'": {
			code: "foo['bar')",
			message: "Unexpected token ')'",
		},
		"unclosed string, single quote": {
			code: "var foo = 'bar",
			message: "Unclosed string literal",
		},
		"unclosed string, double quote": {
			code: 'var foo = "bar',
			message: "Unclosed string literal",
		},
		"unclosed string, backticks": {
			code: "var foo = `bar",
			message: "Unclosed template literal",
		},
		"unclosed template literal expression": {
			code: "var foo = `${bar`",
			message: "Unclosed template literal",
		},
		"unclosed block comment": {
			code: "var foo = 'bar'; /*",
			message: "Unclosed block comment",
		},
		"unclosed regex": {
			code: "var foo = /bar",
			message: "Unclosed regular expression literal",
		},
		"unclosed regex as control flow body": {
			code: "while (foo) /bar",
			message: "Unclosed regular expression literal",
		},
		"invalid for-loop condition": {
			code: "for (var i = 0",
			message: "Missing token ')'",
		},
		"invalid function statement": {
			code: "function a b() {}",
			message: "Unexpected token 'b'",
		},
	};

	for (const [name, testcase] of Object.entries(testdata)) {
		test(name, (t) => {
			const { code, message } = testcase;

			t.assert.throws(
				() => {
					process(code, baseHooks);
				},
				{
					name: "ParseError",
					message,
				},
			);
		});
	}
});

test("stack depth", (t) => {
	const n = 9999;
	const code = "{".repeat(n) + "}".repeat(n);

	t.assert.throws(
		() => {
			process(code, baseHooks);
		},
		{ name: "RangeError", message: "Maximum call stack size exceeded" },
	);
});

test("syntax", (t) => {
	fc.assert(
		fc.property(javascript(), (code) => {
			t.assert.doesNotThrow(() => {
				const _ = process(code, baseHooks);
			});
		}),
	);
});
