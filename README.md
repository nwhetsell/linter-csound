# Csound Linting in Pulsar and Atom Forks

[![Actions](https://github.com/nwhetsell/linter-csound/workflows/CI/badge.svg)](https://github.com/nwhetsell/linter-csound/actions?workflow=CI)

This [Pulsar](https://pulsar-edit.dev) package adds syntax checking for [Csound](https://csound.com) orchestras.

## Including Files

The linter-csound preprocessor searches paths for files included using [`#include`](https://csound.com/docs/manual/include.html) in this order:

1. The paths returned by Pulsar’s `Project::getPaths`. (This is usually one path that’s roughly equivalent to the current directory.)

2. The path of the file being preprocessed.

3. If there are files named .csound-include-directories in the paths returned by `Project::getPaths`, the paths (one per line) contained in each .csound-include-directories file. For example, if you create a file named .csound-include-directories in the root folder of your project, and this file contains

    ```
    /usr/local/csound/udos
    /usr/local/csound/more-udos
    ```

    then linter-csound will search /usr/local/csound/udos and /usr/local/csound/more-udos for included files.

4. Paths you enter in linter-csound’s Settings.

## Contributing

[Open an issue](https://github.com/nwhetsell/linter-csound/issues), or [fork this project and make a pull request](https://guides.github.com/activities/forking/).

## linter-csound’s Orchestra Parser

To check the syntax of orchestras, linter-csound uses a [preprocessor and parser](lib/csound-parser) generated using the [GerHobbelt fork](https://github.com/GerHobbelt/jison) of [Jison](https://zaa.ch/jison/). The [grammar](lib/csound-parser/orchestra.jison) used by the parser is based on [this JavaScript grammar](https://github.com/cjihrig/jsparser/blob/master/ecmascript.jison) and [this C grammar](http://www.quut.com/c/ANSI-C-grammar-y-2011.html). To generate the preprocessor and parser on macOS, open a Terminal, `cd` to linter-csound/lib/csound-parser, and then run:

```sh
npm install https://github.com/GerHobbelt/jison/archive/0.6.1-215.tar.gz
node generate-parser.js
```

The linter-csound preprocessor and parser try to match Csound’s behavior, but linter-csound’s implementations are quite different. Here is how linter-csound’s Jison files correspond to Csound’s Flex/Bison files:

This Jison file | Corresponds to this Flex/Bison file
----------------|------------------------------------
[preprocessor.jisonlex](lib/csound-parser/preprocessor.jisonlex) | [csound_pre.lex](https://github.com/csound/csound/blob/develop/Engine/csound_pre.lex)
[orchestra.jisonlex](lib/csound-parser/orchestra.jisonlex) | [csound_orc.lex](https://github.com/csound/csound/blob/develop/Engine/csound_orc.lex)
[orchestra.jison](lib/csound-parser/orchestra.jison) | [csound_orc.y](https://github.com/csound/csound/blob/develop/Engine/csound_orc.y)

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

* Csound’s parser silently ignores duplicate [labels](https://csound.com/docs/manual/OrchTop.html), while linter-csound gives a warning.
