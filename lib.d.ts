// SPDX-License-Identifier: Apache-2.0

export type Hooks = {
	/** A handler for block comments. */
	blockComment?: (comment: string) => string;

	/** A handler for line comments. */
	lineComment?: (comment: string) => string;
};

/**
 * Process and manipulate a piece of code.
 *
 * @param code The code to process.
 * @param hooks The hooks for manipulation.
 * @return The manipulated code.
 * @throws {Error} If the provided code is invalid.
 * @throws {TypeError} If the provided pattern is not a RegExp.
 * @throws {RangeError} If the provided code has too deeply nested constructs.
 */
export function process(code: string, hooks: Hooks): string;
