// SPDX-License-Identifier: Apache-2.0

import { process as p } from "./main.js";

/**
 * @typedef Hooks
 * @property {(comment: string) => string} [blockComment] A handler for block comments.
 * @property {(comment: string) => string} [lineComment] A handler for line comments.
 */

/**
 * Process and manipulate a piece of code.
 *
 * @param {string} code The code to process.
 * @param {Hooks} hooks The hooks for manipulation.
 * @return {string} The manipulated code.
 * @throws {Error} If the provided code is invalid.
 * @throws {TypeError} If the provided pattern is not a RegExp.
 * @throws {RangeError} If the provided code has too deeply nested constructs.
 */
export function process(code, hooks) {
	const h = { ...hooks };
	h.blockComment ??= identity;
	h.lineComment ??= identity;
	return p(code, h);
}

/**
 * @template T
 * @param {T} x The input value.
 * @returns Exactly the value of `x`.
 */
function identity(x) {
	return x;
}
