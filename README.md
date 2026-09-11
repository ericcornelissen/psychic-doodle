<!-- SPDX-License-Identifier: CC0-1.0 -->

# psychic-doodle

A lightweight JavaScript code processor.

## Install

```shell
npm install psychic-doodle
```

## Usage

### API

```javascript
import { process } from "psychic-doodle";

process("var unicorns = false; // Only horses", {
  lineComment: (content) => {
    console.log(content);
    //=> "Only horses\n"

    return content;
  },
});
```

## License

The source code is licensed under the `Apache-2.0` license, see [LICENSE] for
the full license text.

[license]: ./LICENSE
