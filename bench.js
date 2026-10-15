// SPDX-License-Identifier: Apache-2.0

import { bench, suite } from "node:bench";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as acorn from "acorn";

import * as psychicDoodle from "./lib.js";

const file = join(import.meta.dirname, "main.js");
const code = readFileSync(file, "utf8");

suite("parse", () => {
	const operations = 128;

	bench(
		"acorn",
		{
			samples: 64,
			warmup: 1,
		},
		(b) => {
			const options = { ecmaVersion: 2026, sourceType: "module" };

			b.start();
			for (let i = 0; i < operations; i++) {
				acorn.parse(code, options);
			}
			b.end(operations);
		},
	);

	bench(
		"psychic-doodle",
		{
			samples: 32,
			warmup: 1,
		},
		(b) => {
			b.start();
			for (let i = 0; i < operations; i++) {
				psychicDoodle.process(code);
			}
			b.end(operations);
		},
	);
});
