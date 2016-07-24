# Csound Linting in Atom

This [Atom](https://atom.io/) package adds syntax checking for [Csound](https://csound.github.io/) orchestras.

## Contributing

[Open an issue](https://github.com/nwhetsell/linter-csound/issues), or [fork this project and make a pull request](https://guides.github.com/activities/forking/).

## linter-csound’s Orchestra Parser

To check the syntax of orchestras, linter-csound uses a [preprocessor and parser](https://github.com/nwhetsell/linter-csound/tree/master/lib/csound-parser) generated using the [GerHobbelt fork](https://github.com/GerHobbelt/jison) of [Jison](https://zaa.ch/jison/). To generate the preprocessor and parser on macOS, open a Terminal, `cd` to linter-csound, and run:

```sh
npm install https://github.com/GerHobbelt/jison.git
pushd lib/csound-parser
../../node_modules/jison-lex/cli.js preprocessor.jison-lex --outfile preprocessor.js
../../node_modules/jison/lib/cli.js orchestra.jison orchestra.jison-lex --outfile orchestra-parser.js
popd
```

The linter-csound orchestra preprocessor and parser try to match Csound’s behavior, but linter-csound’s implementations are quite different. The [Jison grammar](https://github.com/nwhetsell/linter-csound/blob/master/lib/csound-parser/orchestra.jison) used by the parser is based on [this JavaScript grammar](http://www.cjihrig.com/development/jsparser/ecmascript.jison) (which you can read about [here](http://cjihrig.com/blog/creating-a-javascript-parser/)) and [this C grammar](http://www.quut.com/c/ANSI-C-grammar-y-2011.html).

Here is how linter-csound’s Jison files correspond to Csound’s Flex/Bison files:

This Jison file | Corresponds to this Flex/Bison file
----------------|------------------------------------
[preprocessor.jison-lex](https://github.com/nwhetsell/linter-csound/blob/master/lib/csound-parser/preprocessor.jison-lex) | [csound_pre.lex](https://github.com/csound/csound/blob/develop/Engine/csound_pre.lex)
[orchestra.jison-lex](https://github.com/nwhetsell/linter-csound/blob/master/lib/csound-parser/orchestra.jison-lex) | [csound_orc.lex](https://github.com/csound/csound/blob/develop/Engine/csound_orc.lex)
[orchestra.jison](https://github.com/nwhetsell/linter-csound/blob/master/lib/csound-parser/orchestra.jison) | [csound_orc.y](https://github.com/csound/csound/blob/develop/Engine/csound_orc.y)

### Known Differences from Csound’s Preprocessor

Csound’s preprocessor:

* permits [0-length parameter names in function-like macros](https://github.com/csound/csound/issues/663). This orchestra prints `hello, world`:

    ```csound
    #define MACRO(arg') #$arg,$#
    prints "$MACRO(hello' world)\n"
    scoreline_i "e"
    ```

    The linter-csound preprocessor treats 0-length parameter names as errors.

* permits duplicate parameter names in function-like macros. The linter-csound preprocessor treats duplicate parameter names as errors.

* [continues to compile after attempting to `#include` a directory](https://github.com/csound/csound/issues/679). The linter-csound preprocessor treats this as an error.

### Known Differences from Csound’s Parser

* Csound’s parser silently ignores duplicate [labels](http://csound.github.io/docs/manual/OrchTop.html), while linter-csound gives a warning.
