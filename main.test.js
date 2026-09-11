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
});

suite("lineComment", () => {
	suite("calls", () => {
		const testdata = {
			"basic, comment with line feed": {
				code: "var foo; // bar\n",
				calls: [["// bar\n"]],
			},
			"basic, comment with carriage return+line feed": {
				code: "var foo; // bar\r\n",
				calls: [["// bar\r\n"]],
			},
			"only a comment": {
				code: "// foobar",
				calls: [["// foobar\n"]],
			},
			"only an empty comment": {
				code: "//",
				calls: [["//\n"]],
			},
			"only an empty comment with line feed": {
				code: "//\n",
				calls: [["//\n"]],
			},
			"only an empty comment with carriage return+line feed": {
				code: "//\r\n",
				calls: [["//\r\n"]],
			},
			"consecutive line comments": {
				code: "// hello\n// world\n",
				calls: [["// hello\n// world\n"]],
			},
			"consecutive line comments, indented": {
				code: "  // hello\n  // world\n",
				calls: [["// hello\n  // world\n"]],
			},
			"consecutive line comments, multiple": {
				code: "// foo\n  // bar\n// baz\n",
				calls: [["// foo\n  // bar\n// baz\n"]],
			},
			"line comment followed by a block comment": {
				code: "// hello\n/* world */",
				calls: [["// hello\n"]],
			},
			"line comment lead by a block comment": {
				code: "/* hello */// world\n",
				calls: [["// world\n"]],
			},
			"line comment with a line comment inside": {
				code: "// hello // world",
				calls: [["// hello // world\n"]],
			},
			"line comment with a block comment inside": {
				code: "// foo /* bar */ baz",
				calls: [["// foo /* bar */ baz\n"]],
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
				hook: () => "// bar\n",
				want: "var foo = 'bar'; // bar\n",
			},
			"strip basic comment": {
				code: "var foo = 'bar'; // baz\n",
				hook: () => "",
				want: "var foo = 'bar';\n",
			},
			"preserve leading comment": {
				code: '// hello\nvar world = "\\!";',
				hook: (x) => x,
				want: '// hello\nvar world = "\\!";',
			},
			"change leading comment": {
				code: '// hello\nvar world = "\\!";',
				hook: () => "// hej\n",
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
				hook: () => "// bar\n",
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
				want: "var foo = /bar/;",
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
			"a comment with '* /'": {
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
		"regex as do-while guard": "do {} while (/'/)",
		"regex as do-while body": "do /'/; while (g)",
		"regex as if guard": "if (/'/) {}",
		"regex as if body": "if (g) /'/",
		"regex as else if guard": "if (g1) {} else if (/'/) {}",
		"regex as else if body": "if (g1) {} else if (g2) /'/",
		"regex as else body": "if (g) {} else /'/",
		"regex as switch guard": "switch (/'/) {}",
		"regex as switch-case expression": "switch(x){case /'/: break}",
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
		"regex before a block scope": "/'/{var x;}",
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
			code: "{var foo = 'bar' /*invalid*/",
			message: "unmatched '{'",
		},
		"unmatched '}'": {
			code: "var foo = 'bar'} /*invalid*/",
			message: "unmatched '}'",
		},
		"unmatched '('": {
			code: "if (foo { var bar = 42; } /*invalid*/",
			message: "unmatched '('",
		},
		"unmatched ')'": {
			code: "if foo) { var bar = 42; } /*invalid*/",
			message: "unmatched ')'",
		},
		"unbalanced brackets, '{'-')'": {
			code: "{ let foo = 42 ) /*invalid*/",
			message: "unmatched ')'",
		},
		"unbalanced brackets, '('-'}'": {
			code: "( let bar = 42 } /*invalid*/",
			message: "unmatched '}'",
		},
		"unclosed string, single quote": {
			code: "/*invalid*/ var foo = 'bar",
			message: "unclosed string literal",
		},
		"unclosed string, double quote": {
			code: '/*invalid*/ var foo = "bar',
			message: "unclosed string literal",
		},
		"unclosed string, backticks": {
			code: "/*invalid*/ var foo = `bar",
			message: "unclosed template literal",
		},
		"unclosed template literal expression": {
			code: "/*invalid*/ var foo = `${bar`",
			message: "unclosed template literal",
		},
		"unclosed block comment": {
			code: "/*invalid*/ var foo = 'bar'; /*",
			message: "unclosed block comment",
		},
		"unclosed regex": {
			code: "/*invalid*/ var foo = /bar",
			message: "unclosed regular expression literal",
		},
		"unclosed regex as control flow body": {
			code: "/*invalid*/ while (foo) /bar",
			message: "unclosed regular expression literal",
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
					name: "Error",
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
