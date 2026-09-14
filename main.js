// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert";

const identExpr = /^[$a-z_][\w$]*/i;
const whitespaceExpr =
	/[\t\v\f \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

/**
 * @typedef Hooks
 * @property {(comment: string) => string} blockComment
 * @property {(comment: string) => string} lineComment
 * @property {(statement: string) => string} statement
 */

/**
 * @param {string} code
 * @param {Hooks} hooks
 * @return {string}
 */
export function process(code, hooks) {
	const result = new StringBuilder();
	const chars = new Scanner(code);
	while (!chars.isEmpty()) {
		$statement(chars, result, hooks);
		$whitespace(chars, result, hooks);
	}
	return result.toString();
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $block(chars, result, hooks) {
	assert(chars.peek() === "{");
	result.push(chars.next());
	$whitespace(chars, result, hooks);
	while (chars.peek() !== "}") {
		$statement(chars, result, hooks);
		$whitespace(chars, result, hooks);
	}
	assert(chars.peek() === "}");
	result.push(chars.next());
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $blockComment(chars, result, hooks) {
	const comment = new StringBuilder();
	comment.push(result.pop());

	assert(chars.peek() === "*");
	comment.push(chars.next());

	let char;
	while ((char = chars.next()) !== null) {
		comment.push(char);

		if (char === "*" && chars.peek() === "/") {
			comment.push(chars.next());

			const rawComment = comment.toString();
			const outComment = hooks.blockComment(rawComment);
			if (outComment.length === 0) {
				trimEnd(result);

				if (result.last() === "\n") result.pop();
				if (result.last() === "\r") result.pop();

				if (result.isEmpty()) {
					if (chars.peek() === "\r") chars.next();
					if (chars.peek() === "\n") chars.next();
				}
			} else {
				result.append(outComment);
			}

			return;
		}
	}

	throw new ParseError("Unclosed block comment");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $class(chars, result, hooks) {
	assert(chars.peek(5) === "class");
	take(chars, result, 5);
	$whitespace(chars, result, hooks);
	$ident(chars, result);
	$whitespace(chars, result, hooks);
	if (chars.peek() !== "{") {
		expect(chars, result, "extends");
		$whitespace(chars, result, hooks);
		$ident(chars, result);
		$whitespace(chars, result, hooks);
	}
	$block(chars, result, hooks);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $do(chars, result, hooks) {
	assert(chars.peek(2) === "do");
	take(chars, result, 2);
	$statement(chars, result, hooks);
	$whitespace(chars, result, hooks);
	expect(chars, result, "while");
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @param {string | null} until
 * @throws {Error}
 */
function $expression(chars, result, hooks, until) {
	$whitespace(chars, result, hooks);

	let start = result.length;
	let last;

	let char;
	LOOP: while ((char = chars.next()) !== null) {
		result.push(char);
		switch (char) {
			case until: {
				return;
			}

			case "\n": {
				if (until === ";") {
					$whitespace(chars, result, hooks);
					const next = chars.peek();
					if (last !== "." && next !== "." && next !== "=" && next !== "{") {
						break LOOP;
					}
				}

				continue;
			}

			case "(": {
				$expression(chars, result, hooks, ")");
				break;
			}
			case ")": {
				throw new ParseError(`Unexpected token ')'`);
			}

			case "[": {
				$expression(chars, result, hooks, "]");
				break;
			}
			case "]": {
				throw new ParseError(`Unexpected token ']'`);
			}

			case "{": {
				if (last === "(" || last === ">") {
					result.pop();
					chars.undo();
					$block(chars, result, hooks);
				} else {
					$expression(chars, result, hooks, "}");
				}

				break;
			}
			case "}": {
				if (until === ";") {
					chars.undo();
					result.pop();
					return;
				}

				throw new ParseError(`Unexpected token '}'`);
			}

			case "'":
			case '"': {
				$string(chars, result, char);
				break;
			}
			case "`": {
				$template(chars, result, hooks);
				break;
			}

			case "/": {
				if (start === result.length - 1) {
					$regexp(chars, result);
					break;
				}
			}
			case "~":
			case "!":
			case "%":
			case "^":
			case "&":
			case "*":
			case "-":
			case "+":
			case "=":
			case "|":
			case ":":
			case ";":
			case ",":
			case "<":
			case ">":
			case "?": {
				$whitespace(chars, result, hooks);
				start = result.length;
				break;
			}

			case "a":
			case "d":
			case "i":
			case "n":
			case "o":
			case "r":
			case "t":
			case "v":
			case "y": {
				const keyword = char + identExpr.exec(chars.peek(10))?.[0];
				if (
					keyword === "await" ||
					keyword === "default" ||
					keyword === "delete" ||
					keyword === "in" ||
					keyword === "of" ||
					keyword === "new" ||
					keyword === "return" ||
					keyword === "throw" ||
					keyword === "void" ||
					keyword === "yield"
				) {
					take(chars, result, keyword.length - 1);
					$whitespace(chars, result, hooks, false);
					start = result.length;
				}

				break;
			}
		}

		last = char;
		$whitespace(chars, result, hooks, false);
	}

	if (until !== ";") {
		throw new ParseError(`Missing token '${until}'`);
	}
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $for(chars, result, hooks) {
	assert(chars.peek(3) === "for");
	take(chars, result, 3);
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
	$statement(chars, result, hooks);
	$whitespace(chars, result, hooks);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $function(chars, result, hooks) {
	assert(chars.peek(8) === "function");
	take(chars, result, 8);
	$whitespace(chars, result, hooks);
	if (chars.peek() === "*") {
		result.push(chars.next());
		$whitespace(chars, result, hooks);
	}
	$ident(chars, result);
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
	$whitespace(chars, result, hooks);
	$block(chars, result, hooks);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 */
function $ident(chars, result) {
	let char;
	while (/[\w$]/.test((char = chars.next()))) result.push(char);
	chars.undo();
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $if(chars, result, hooks) {
	assert(chars.peek(2) === "if");
	take(chars, result, 2);
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
	$statement(chars, result, hooks);
	$whitespace(chars, result, hooks);
	if (identExpr.exec(chars.peek(5))?.[0] === "else") {
		expect(chars, result, "else");
		$statement(chars, result, hooks);
		$whitespace(chars, result, hooks);
	}
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 */
function $lineComment(chars, result, hooks) {
	const comment = new StringBuilder();
	comment.push(result.pop());

	assert(chars.peek() === "/");

	let newline = "";
	const indent = new StringBuilder();

	let char;
	LOOP: while ((char = chars.next()) !== null) {
		switch (char) {
			case "\r": {
				newline += char;
				char = chars.next();
			}
			case "\n": {
				newline += char;

				while (whitespaceExpr.test((char = chars.next()))) indent.push(char);
				chars.undo();

				if (chars.peek(2) === "//") {
					comment.append(newline);
					comment.concat(indent);

					newline = "";
					indent.clear();
				} else {
					break LOOP;
				}

				break;
			}
			default: {
				comment.push(char);
				break;
			}
		}
	}

	const rawComment = comment.toString();
	const outComment = hooks.lineComment(rawComment);
	if (outComment.length === 0) {
		trimEnd(result);
	} else {
		result.append(outComment);
		result.append(newline);
	}

	result.concat(indent);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @throws {Error}
 */
function $regexp(chars, result) {
	let inCharRange = false;
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);
		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case "[": {
				inCharRange = true;
				break;
			}
			case "]": {
				inCharRange = false;
				break;
			}
			case "/": {
				if (!inCharRange) return;
			}
		}
	}

	throw new ParseError("Unclosed regular expression literal");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} statement
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $statement(chars, result, hooks) {
	$whitespace(chars, result, hooks);

	const statement = new StringBuilder();
	const start = statement.length;

	const keyword = identExpr.exec(chars.peek(9))?.[0];
	switch (keyword) {
		case "class": {
			$class(chars, statement, hooks);
			break;
		}
		case "do": {
			$do(chars, statement, hooks);
			break;
		}
		case "for": {
			$for(chars, statement, hooks);
			break;
		}
		case "function": {
			$function(chars, statement, hooks);
			break;
		}
		case "if": {
			$if(chars, statement, hooks);
			break;
		}
		case "switch": {
			$switch(chars, statement, hooks);
			break;
		}
		case "try": {
			$try(chars, statement, hooks);
			break;
		}
		case "while": {
			$while(chars, statement, hooks);
			break;
		}
		case "with": {
			$with(chars, statement, hooks);
			break;
		}
		default: {
			switch (chars.peek()) {
				case "{": {
					$block(chars, statement, hooks);
					break;
				}
				case "}": {
					throw new ParseError(`Unexpected token '}'`);
				}

				default: {
					$expression(chars, statement, hooks, ";");
					break;
				}
			}

			break;
		}
	}

	const whitespace = [];
	let char;
	while (!statement.isEmpty() && /\s/.test((char = statement.pop())))
		whitespace.push(char);
	if (char) statement.push(char);

	const rawStatement = statement.toString();
	const outStatement = hooks.statement(rawStatement);
	if (outStatement.length === 0) {
		// TODO: trimEnd(result);
	} else {
		result.append(outStatement);
		whitespace.reverse();
		result.append(whitespace.join(""));
	}

	assert(statement.length >= start);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {"'" | '"'} quote
 * @throws {Error}
 */
function $string(chars, result, quote) {
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);
		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case quote: {
				return;
			}
		}
	}

	throw new ParseError("Unclosed string literal");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $switch(chars, result, hooks) {
	assert(chars.peek(6) === "switch");
	take(chars, result, 6);
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
	$whitespace(chars, result, hooks);
	expect(chars, result, "{");
	$whitespace(chars, result, hooks);
	while (chars.peek() !== "}") {
		while (chars.peek(4) === "case") {
			expect(chars, result, "case");
			$expression(chars, result, hooks, ":");
			$whitespace(chars, result, hooks);
		}
		if (chars.peek(7) === "default") {
			expect(chars, result, "default");
			$whitespace(chars, result, hooks);
			expect(chars, result, ":");
		}
		$statement(chars, result, hooks);
		$whitespace(chars, result, hooks);
	}
	expect(chars, result, "}");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $template(chars, result, hooks) {
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);
		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case "$": {
				if (chars.peek() === "{") {
					result.push(chars.next());
					$expression(chars, result, hooks, "}");
				}

				break;
			}
			case "`": {
				return;
			}
		}
	}

	throw new ParseError("Unclosed template literal");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $try(chars, result, hooks) {
	assert(chars.peek(3) === "try");
	take(chars, result, 3);
	$whitespace(chars, result, hooks);
	$block(chars, result, hooks);
	$whitespace(chars, result, hooks);
	if (identExpr.exec(chars.peek(6))[0] === "catch") {
		take(chars, result, 5);
		$whitespace(chars, result, hooks);
		if (chars.peek() === "(") {
			expect(chars, result, "(");
			$expression(chars, result, hooks, ")");
			$whitespace(chars, result, hooks);
		}
		$block(chars, result, hooks);
		$whitespace(chars, result, hooks);
	}
	if (identExpr.exec(chars.peek(8))?.[0] === "finally") {
		take(chars, result, 7);
		$whitespace(chars, result, hooks);
		$block(chars, result, hooks);
	}
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $while(chars, result, hooks) {
	assert(chars.peek(5) === "while");
	take(chars, result, 5);
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
	$statement(chars, result, hooks);
	$whitespace(chars, result, hooks);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @param {boolean} [newline=true]
 * @throws {Error}
 */
function $whitespace(chars, result, hooks, newline = true) {
	if (chars.isEmpty()) return;
	newline &&= "\n";

	let char;
	while ((char = chars.next()) !== null) {
		switch (char) {
			case " ":
			case "\t":
			case newline:
			case "\r":
			case "\f":
			case "\v":
			case "\u00a0":
			case "\u1680":
			case "\u2000":
			case "\u2001":
			case "\u2002":
			case "\u2003":
			case "\u2004":
			case "\u2005":
			case "\u2006":
			case "\u2007":
			case "\u2008":
			case "\u2009":
			case "\u200a":
			case "\u2028":
			case "\u2029":
			case "\u202f":
			case "\u205f":
			case "\u3000":
			case "\ufeff": {
				result.push(char);
				continue;
			}

			case "/": {
				const next = chars.peek();
				if (next === "*") {
					result.push(char);
					$blockComment(chars, result, hooks);
					continue;
				} else if (next === "/") {
					result.push(char);
					$lineComment(chars, result, hooks);
					continue;
				}
			}
		}

		break;
	}

	chars.undo();
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws {Error}
 */
function $with(chars, result, hooks) {
	assert(chars.peek(4) === "with");
	take(chars, result, 4);
	$whitespace(chars, result, hooks);
	expect(chars, result, "(");
	$expression(chars, result, hooks, ")");
	$statement(chars, result, hooks);
	$whitespace(chars, result, hooks);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {string} want
 * @throws {Error}
 */
function expect(chars, result, want) {
	const got = chars.peek(want.length);
	if (got !== want) throw new ParseError(`Unexpected token '${got}'`);
	take(chars, result, want.length);
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {number} n
 * @throws {Error}
 */
function take(chars, result, n) {
	for (let i = 0; i < n; i++) result.push(chars.next());
}

/**
 * @param {StringBuilder} string
 */
function trimEnd(string) {
	for (let i = string.length - 1; i >= 0; i--) {
		const cur = string.get(i);
		if (whitespaceExpr.test(cur)) {
			string.pop();
		} else {
			break;
		}
	}
}

/**
 * A custom error for parsing errors.
 */
class ParseError extends Error {
	/**
	 * @param {string} message
	 */
	constructor(message) {
		super(message);
		this.name = "ParseError";
	}
}

/**
 * A one-way scanner over a string.
 */
class Scanner {
	#list;
	#idx;

	/**
	 * Initialize a new scanner for a string.
	 *
	 * @param {string} list The string to create a scanner for.
	 */
	constructor(list) {
		assert(typeof list === "string");
		this.#list = list;
		this.#idx = 0;
	}

	/**
	 * Check if the scanner is finished.
	 *
	 * @returns {boolean} `true` if the scanner finished, `false` otherwise.
	 */
	isEmpty() {
		return this.#list.length <= this.#idx;
	}

	/**
	 * Consume the next character.
	 *
	 * @returns {string | null} The next character, null if the scanner finished.
	 */
	next() {
		// TODO: assert(this.#idx <= this.#list.length);
		const idx = this.#idx++;
		return this.#list[idx] || null;
	}

	/**
	 * Preview the next n characters.
	 *
	 * @param {number} [n=1] How many characters to look ahead.
	 * @returns {string} The next (up-to) n characters.
	 */
	peek(n = 1) {
		assert(n > 0);
		return this.#list.slice(this.#idx, this.#idx + n);
	}

	/**
	 * Undo the last call of next.
	 */
	undo() {
		assert(this.#idx > 0);
		this.#idx -= 1;
	}
}

/**
 * A resizable string builder.
 */
class StringBuilder {
	#list;

	/**
	 * Initialize a new string builder.
	 */
	constructor() {
		this.#list = [];
	}

	/**
	 * The current length of the string being build.
	 *
	 * @returns {number} The length of the string.
	 */
	get length() {
		return this.#list.length;
	}

	/**
	 * Append the characters of a string to the list of characters.
	 *
	 * @param {string} string
	 */
	append(string) {
		assert(typeof string === "string");
		for (const char of string) this.push(char);
	}

	/**
	 * Get the current string as a list of characters.
	 *
	 * @returns {string[]} The characters.
	 */
	chars() {
		return this.#list;
	}

	/**
	 * Reset the underlying string to the empty string.
	 */
	clear() {
		this.#list.length = 0;
	}

	/**
	 * Concatenate two string builders.
	 *
	 * @param {StringBuilder} string
	 */
	concat(builder) {
		assert(builder instanceof StringBuilder);
		for (const char of builder.#list) this.push(char);
	}

	/**
	 * Get a character in the current string.
	 *
	 * @param {number} idx The index of the character to get.
	 * @returns {string} The character at `idx`.
	 */
	get(idx) {
		assert(idx >= 0 && idx < this.#list.length);
		return this.#list[idx];
	}

	/**
	 * Check if the string builder is empty.
	 *
	 * @returns {boolean} `true` if the string builder is empty, `false` otherwise.
	 */
	isEmpty() {
		return this.#list.length === 0;
	}

	/**
	 * Get the last character in the current string.
	 *
	 * @returns {string | null} The last character, null if the builder is empty.
	 */
	last() {
		return this.#list[this.#list.length - 1] || null;
	}

	/**
	 * Remove the last character from the current string.
	 *
	 * @returns {string} The last character in the string.
	 */
	pop() {
		assert(this.#list.length > 0);
		return this.#list.pop();
	}

	/**
	 * Add a character to the string.
	 *
	 * @param {string} char The character to add.
	 */
	push(char) {
		assert(typeof char === "string");
		assert(char.length === 1);
		this.#list.push(char);
	}

	/**
	 * Extract a slice of the current string from the builder.
	 *
	 * @param {number} start
	 * @returns {string} A slice of the current string.
	 */
	slice(start, end) {
		return this.#list
			.slice(start, end)
			.reduce((string, char) => string + char, "");
	}

	/**
	 * Extract the current string from the builder.
	 *
	 * @returns {string} The current string.
	 */
	toString() {
		return this.#list.reduce((string, char) => string + char, "");
	}
}
