// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert";

const whitespaceExpr =
	/[\t\v\f \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

/**
 * @typedef Hooks
 * @property {(comment: string) => string} blockComment
 * @property {(comment: string) => string} lineComment
 */

/**
 * @param {string} code
 * @param {Hooks} hooks
 * @return {string}
 */
export function process(code, hooks) {
	const result = new StringBuilder();
	const chars = new Scanner(code + "\n");
	$code(chars, result, hooks, null);
	result.pop();
	return result.toString();
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
				if (chars.peek() === "\n" || chars.peek(2) === "\r\n") {
					if (result.last() === "\n") result.pop();
					if (result.last() === "\r") result.pop();

					if (result.isEmpty()) {
						if (chars.next() === "\r") chars.next();
						if (chars.isEmpty()) result.push("\n");
					}
				}
			} else {
				for (const char of outComment) result.push(char);
			}

			return;
		}
	}

	throw new Error("unclosed block comment");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @param {"{" | "(" | null} match
 * @throws {Error}
 */
function $code(chars, result, hooks, match) {
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);
		switch (char) {
			case "{": {
				$code(chars, result, hooks, "{");
				break;
			}
			case "}": {
				if (match !== "{") {
					throw new Error(`unmatched '}'`);
				}

				return;
			}

			case "(": {
				const code = result.toString();
				$code(chars, result, hooks, "(");
				if (/(?:^|\*\/|[\s);{}])(?:do|for|if|while|with)\s*\($/.test(code)) {
					$whitespace(chars, result);
					const next = chars.peek(2);
					if (next[0] === "/" && next[1] !== "/" && next[1] !== "*") {
						result.push(chars.next());
						$regexp(chars, result);
						$whitespace(chars, result);
						const next = chars.peek(2);
						if (next[0] === "/" && next[1] !== "/" && next[1] !== "*") {
							result.push(chars.next());
						}
					}
				}

				break;
			}
			case ")": {
				if (match !== "(") {
					throw new Error(`unmatched ')'`);
				}

				return;
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
				const next = chars.peek();
				if (next === "/") {
					$lineComment(chars, result, hooks);
				} else if (next === "*") {
					$blockComment(chars, result, hooks);
				} else if (startExpression(result)) {
					$regexp(chars, result);
					$whitespace(chars, result);
					const next = chars.peek(2);
					if (next[0] === "/" && next[1] !== "/" && next[1] !== "*") {
						result.push(chars.next());
					}
				}

				break;
			}
		}
	}

	if (match !== null) {
		throw new Error(`unmatched '${match}'`);
	}
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Options} options
 */
function $lineComment(chars, result, hooks) {
	const comment = new StringBuilder();
	comment.push(result.pop());

	const whitespace = new StringBuilder();
	let char;
	while ((char = chars.next()) !== null) {
		comment.push(char);
		if (char === "\n") {
			$whitespace(chars, whitespace);
			if (chars.peek(2) === "//") {
				for (const char of whitespace.chars()) comment.push(char);
				whitespace.clear();
			} else {
				break;
			}
		}
	}

	const rawComment = comment.toString();
	const outComment = hooks.lineComment(rawComment);
	if (outComment.length === 0) {
		trimEnd(result);

		if (result.last() === "\n") result.pop();
		if (result.last() === "\r") result.pop();

		if (!result.isEmpty() || chars.isEmpty()) {
			if (rawComment.endsWith("\r\n")) result.push("\r");
			result.push("\n");
		}
	} else {
		for (const char of outComment) result.push(char);
	}

	for (const char of whitespace.chars()) result.push(char);
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

	throw new Error("unclosed regular expression literal");
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

	throw new Error("unclosed string literal");
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
					$code(chars, result, hooks, "{");
				}
				break;
			}
			case "`": {
				return;
			}
		}
	}

	throw new Error("unclosed template literal");
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 */
function $whitespace(chars, result) {
	let char;
	while ((char = chars.next()) !== null) {
		if (whitespaceExpr.test(char)) {
			result.push(char);
		} else {
			break;
		}
	}

	chars.undo();
}

/**
 * @param {StringBuilder} snippet
 * @returns {boolean}
 */
function startExpression(snippet) {
	const expressionExpr =
		/(?:^|[\n!%&(*+,\-/:;<=>?[^{|}~])[\t\v\f \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*\/$/;
	const keywordExpressionExpr =
		/(?:^|[\s!%&()*+,\-/:;<=>?[^{|}~])(?:await|case|default|delete|instanceof|new|throw|typeof|void|yield)\s*\/$/;
	const keywordStatementExpr = /(?:^|[\s);{}])(?:do|else|in|of|return)\s*\/$/;

	const s = snippet.toString();
	return (
		expressionExpr.test(s) ||
		keywordExpressionExpr.test(s) ||
		keywordStatementExpr.test(s)
	);
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
		return this.#list.length === this.#idx;
	}

	/**
	 * Consume the next character.
	 *
	 * @returns {string | null} The next character, null if the scanner finished.
	 */
	next() {
		assert(this.#idx <= this.#list.length);
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
	 * Extract the current string from the builder.
	 *
	 * @returns {string} The current string.
	 */
	toString() {
		return this.#list.join("");
	}
}
