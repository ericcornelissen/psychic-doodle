// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as psychicDoodle from "./lib.js";

const file = join(import.meta.dirname, "main.js");
const code = readFileSync(file, "utf8");

for (let i = 0; i < 1000; i++) {
	psychicDoodle.process(code);
}
