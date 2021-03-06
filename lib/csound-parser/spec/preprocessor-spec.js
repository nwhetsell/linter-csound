const dedent = require("dedent-js");
const fs = require("fs");
const path = require("path");

const preprocessor = require(path.join("..", "preprocessor.js")).lexer;

describe("Csound preprocessor", () => {
  afterEach(() => {
    preprocessor.cleanupAfterLex();
  });

  it("is defined", () => {
    expect(preprocessor).toBeDefined();
  });

  it("lexes empty string", () => {
    preprocessor.setInput("");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes line continuation", () => {
    preprocessor.setInput("\\\n");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes line continuation with trailing semicolon comment", () => {
    preprocessor.setInput("\\ \t;comment\n");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 0], [0, 1]]
      },
      excerpt: "Line continuation is not followed immediately by newline"
    });
  });

  it("lexes block comments", () => {
    preprocessor.setInput("/*\n#include @0 /* @@0 $macro*//**/");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("  ");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[1, 12], [1, 14]]
      },
      excerpt: "‘/*’ in block comment"
    });
  });

  // https://github.com/csound/csound/issues/542
  it("lexes unterminated block comment", () => {
    preprocessor.setInput("/*");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" ");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 2]]
      },
      excerpt: "Unterminated block comment"
    });
  });

  it("lexes single-line comments", () => {
    preprocessor.setInput(dedent`
      ;#include
      //#define
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("\n\n");
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes quoted string", () => {
    const string = '"#include/**/;\\n"';
    preprocessor.setInput(string);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(string);
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes quoted string with unrecognized escape sequence", () => {
    const string = '"\\x"';
    preprocessor.setInput(string);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(string);
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 1], [0, 3]]
      },
      excerpt: "Unknown escape sequence ‘\\x’"
    });
  });

  it("lexes quoted string with line continuation", () => {
    preprocessor.setInput('"\\ \t;comment\n"');
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe('""');
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 1], [0, 2]]
      },
      excerpt: "Line continuation is not followed immediately by newline"
    });
  });

  // https://github.com/csound/csound/issues/660
  it("lexes quoted string with newline", () => {
    preprocessor.setInput('"\n"');
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe('""');
    expect(preprocessor.messages.length).toBe(2);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 1]]
      },
      excerpt: 'Missing terminating ‘"’'
    });
    expect(preprocessor.messages[1]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[1, 0], [1, 1]]
      },
      excerpt: 'Missing terminating ‘"’'
    });
  });

  it("lexes unterminated quoted string", () => {
    preprocessor.setInput('"\n');
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe('"');
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 1]]
      },
      excerpt: 'Missing terminating ‘"’'
    });
  });

  it("lexes braced string", () => {
    const string = "{{\nhello,\nworld\n}}";
    preprocessor.setInput(string);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(string);
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes braced string with unrecognized escape sequence", () => {
    const string = "{{\\x}}";
    preprocessor.setInput(string);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(string);
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 2], [0, 4]]
      },
      excerpt: "Unknown escape sequence ‘\\x’"
    });
  });

  it("lexes unterminated braced string", () => {
    preprocessor.setInput("{{");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("{{");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 2]]
      },
      excerpt: "Missing terminating ‘}}’"
    });
  });

  it("lexes object-like macro definitions", () => {
    preprocessor.setInput(dedent`
      # \tdefineMACRO#macro body#
      #define/**/
      MACRO/**/
      #\\#macro
      body\\##
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" \n   ");
    expect(preprocessor.macrosByName.MACRO).toEqual({
      name: "MACRO",
      range: [[2, 0], [2, 5]],
      body: "#macro\nbody#"
    });
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[2, 0], [2, 5]]
      },
      excerpt: "‘MACRO’ macro redefined",
      trace: [{
        severity: "info",
        location: {
          file: undefined,
          position: [[0, 9], [0, 14]]
        },
        excerpt: "Previous definition is here"
      }]
    });
  });

  it("lexes #define without macro name", () => {
    preprocessor.setInput("#define ");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 7]]
      },
      excerpt: "Macro name missing"
    });
  });

  it("lexes #define followed by unexpected character", () => {
    preprocessor.setInput("#define ?");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 8], [0, 8]]
        },
        excerpt: "Macro name must be an identifier"
      });
    }
  });

  // https://github.com/csound/csound/issues/653
  it("lexes macro without body", () => {
    preprocessor.setInput("#define MACRO ");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 14], [0, 14]]
      },
      excerpt: "Expected ‘#’ after macro name"
    });
  });

  // https://github.com/csound/csound/issues/654
  it("lexes macro name followed by unexpected character", () => {
    for (const character of ["?", "0"]) {
      preprocessor.setInput(`#define MACRO ${character}`);
      try {
        preprocessor.lex();
        fail("Expected exception.");
      } catch (error) {
        expect(error.lintMessage).toEqual({
          severity: "error",
          location: {
            file: undefined,
            position: [[0, 14], [0, 14]]
          },
          excerpt: "Expected ‘#’ after macro name"
        });
      }
    }
  });

  // https://github.com/csound/csound/issues/542
  it("lexes unterminated macro body", () => {
    preprocessor.setInput("#define MACRO # ");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 14], [0, 15]]
      },
      excerpt: "Missing terminating ‘#’"
    });
  });

  it("lexes function-like macro definitions", () => {
    preprocessor.setInput(dedent`
      #defineMACRO(ARG1#ARG2)#macro body#
      #define/**/
      MACRO(ARG1'ARG2'ARG3)/**/
      #\\#macro
      body\\##
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" \n   ");
    expect(preprocessor.macrosByName.MACRO).toEqual({
      name: "MACRO",
      parameterNames: ["ARG1", "ARG2", "ARG3"],
      range: [[2, 0], [2, 5]],
      body: "#macro\nbody#"
    });
    expect(preprocessor.messages.length).toBe(2);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 17], [0, 18]]
      },
      excerpt: "‘#’ instead of single quote used to separate macro parameters"
    });
    expect(preprocessor.messages[1]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[2, 0], [2, 5]]
      },
      excerpt: "‘MACRO’ macro redefined",
      trace: [{
        severity: "info",
        location: {
          file: undefined,
          position: [[0, 7], [0, 12]]
        },
        excerpt: "Previous definition is here"
      }]
    });
  });

  it("lexes unterminated macro parameter name list", () => {
    preprocessor.setInput("#define MACRO( ");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 13], [0, 14]]
      },
      excerpt: "Missing terminating ‘)’"
    });
  });

  it("lexes unexpected character in macro parameter name list", () => {
    preprocessor.setInput("#define MACRO(?ARG1)");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 14], [0, 14]]
        },
        excerpt: "Expected macro parameter name"
      });
    }
  });

  it("lexes unexpected character after macro parameter name", () => {
    preprocessor.setInput("#define MACRO(ARG1?)");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 18], [0, 18]]
        },
        excerpt: "Expected single quote in macro parameter list"
      });
    }
  });

  // https://github.com/csound/csound/issues/663
  it("lexes 0-length parameter name", () => {
    preprocessor.setInput("#define MACRO(arg') #$arg $#");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 18], [0, 18]]
        },
        excerpt: "Expected macro parameter name"
      });
    }
  });

  it("lexes duplicate parameter name", () => {
    preprocessor.setInput("#define MACRO(arg'arg)");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 18], [0, 21]]
        },
        excerpt: "Duplicate macro parameter name ‘arg’"
      });
    }
  });

  it("lexes #undef", () => {
    preprocessor.setInput("#define MACRO ##\n#undef MACRO");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" \n");
    expect(preprocessor.macrosByName.MACRO).toBeUndefined();
    expect(preprocessor.messages.length).toBe(0);
  });

  it("warns about undefined macro following #undef", () => {
    preprocessor.setInput("#undef MACRO");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 7], [0, 12]]
      },
      excerpt: "‘MACRO’ macro is not defined"
    });
  });

  it("lexes #undef without macro name", () => {
    preprocessor.setInput("#undef ");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 6]]
      },
      excerpt: "Macro name missing"
    });
  });

  it("lexes #undef followed by unexpected character", () => {
    preprocessor.setInput("#undef ?");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 7], [0, 7]]
        },
        excerpt: "Macro name must be an identifier"
      });
    }
  });

  it("lexes true #ifdef", () => {
    preprocessor.setInput(dedent`
      #define MACRO ##
      #ifdef MACRO
        #define SUCCESS ##
      #else
        #undef MACRO
      #endif
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" \n\n   \n");
    expect(preprocessor.messages.length).toBe(0);
    expect(preprocessor.macrosByName.MACRO).toEqual({
      name: "MACRO",
      range: [[0, 8], [0, 13]],
      body: ""
    });
    expect(preprocessor.macrosByName.SUCCESS).toEqual({
      name: "SUCCESS",
      range: [[2, 10], [2, 17]],
      body: ""
    });
  });

  it("lexes false #ifdef", () => {
    preprocessor.setInput(dedent`
      #ifdef MACRO
        #define MACRO ##
      #else
        #define SUCCESS ##
      #endif
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("\n   \n");
    expect(preprocessor.messages.length).toBe(0);
    expect(preprocessor.macrosByName.SUCCESS).toEqual({
      name: "SUCCESS",
      range: [[3, 10], [3, 17]],
      body: ""
    });
    expect(preprocessor.macrosByName.MACRO).toBeUndefined();
  });

  it("lexes true #ifndef", () => {
    preprocessor.setInput(dedent`
      #ifndef MACRO
        #define SUCCESS ##
      #else
        #define MACRO ##
      #endif
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("\n   \n");
    expect(preprocessor.messages.length).toBe(0);
    expect(preprocessor.macrosByName.SUCCESS).toEqual({
      name: "SUCCESS",
      range: [[1, 10], [1, 17]],
      body: ""
    });
    expect(preprocessor.macrosByName.MACRO).toBeUndefined();
  });

  it("lexes false #ifndef", () => {
    preprocessor.setInput(dedent`
      #define MACRO ##
      #ifndef MACRO
        #undef MACRO
      #else
        #define SUCCESS ##
      #endif
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" \n\n   \n");
    expect(preprocessor.messages.length).toBe(0);
    expect(preprocessor.macrosByName.MACRO).toEqual({
      name: "MACRO",
      range: [[0, 8], [0, 13]],
      body: ""
    });
    expect(preprocessor.macrosByName.SUCCESS).toEqual({
      name: "SUCCESS",
      range: [[4, 10], [4, 17]],
      body: ""
    });
  });

  it("lexes #else after #else", () => {
    preprocessor.setInput("#ifndef MACRO\n#else\n#else\n#endif");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("\n");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[2, 0], [2, 5]]
      },
      excerpt: "#else after #else"
    });
  });

  it("lexes #ifdef without macro name", () => {
    preprocessor.setInput("#ifdef ");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 6]]
      },
      excerpt: "Macro name missing"
    });
  });

  it("lexes #ifdef followed by unexpected character", () => {
    preprocessor.setInput("#ifdef ?");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 7], [0, 7]]
        },
        excerpt: "Macro name must be an identifier"
      });
    }
  });

  it("lexes #ifdef without #endif", () => {
    preprocessor.setInput("#ifdef MACRO");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 6]]
      },
      excerpt: "Unterminated conditional directive"
    });
  });

  it("lexes #else without #ifdef or #ifndef", () => {
    preprocessor.setInput("#else");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 5]]
      },
      excerpt: "#else without #ifdef or #ifndef"
    });
  });

  it("lexes #endif without #ifdef or #ifndef", () => {
    preprocessor.setInput("#endif");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 6]]
      },
      excerpt: "#endif without #ifdef or #ifndef"
    });
  });

  it("expands object-like macro", () => {
    preprocessor.setInput('#define MACRO #prints "hello, world\\n"#$MACRO');
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(' prints "hello, world\\n"');
    expect(preprocessor.messages.length).toBe(0);
  });

  it("expands object-like macro in quoted string", () => {
    preprocessor.setInput('#define MACRO #hello, world#prints "$MACRO\\n"');
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(' prints "hello, world\\n"');
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 36], [0, 42]]
      },
      excerpt: "‘MACRO’ macro expanded in string"
    });
  });

  // https://github.com/csound/csound/issues/1128
  it("expands nested macros", () => {
    preprocessor.setInput("#define X#440##define XY# $X #i1 0 1 0.25 $XY");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("  i1 0 1 0.25  440 ");
    expect(preprocessor.messages.length).toBe(0);
  });

  // https://github.com/csound/csound/issues/682
  it("expands infinitely recursive macros", () => {
    preprocessor.setInput("#define FOO #$FOO#$FOO");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 18], [0, 22]]
        },
        excerpt: "Macro expanded too deeply"
      });
    }
  });

  it("expands function-like macro", () => {
    preprocessor.setInput(`#define MACRO(arg1'arg2'arg3) #$arg1 "$arg2$arg3\\n"#$MACRO(prints'hello', world)`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(' prints "hello, world\\n"');
    expect(preprocessor.messages.length).toBe(0);
  });

  it("expands function-like macro with too many arguments", () => {
    preprocessor.setInput(`#define MACRO(arg1'arg2'arg3) #$arg1 "$arg2$arg3\\n"#$MACRO(prints'hello', world'error)`);
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 80], [0, 85]]
        },
        excerpt: "Too many arguments provided to function-like macro",
        trace: [{
          severity: "info",
          location: {
            file: undefined,
            position: [[0, 8], [0, 13]]
          },
          excerpt: "Macro ‘MACRO’ defined here"
        }]
      });
    }
  });

  // https://github.com/csound/csound/issues/295
  it("expands function-like macro with parameter name of object-like macro", () => {
    preprocessor.setInput(dedent`
      #define PITCH #440#
      #define TEST_MACRO(PITCH) #$PITCH#
      $TEST_MACRO(880)
      $PITCH
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" \n \n880\n440");
    expect(preprocessor.messages.length).toBe(0);
  });

  // https://github.com/csound/csound/issues/664
  it("expands function-like macro with too few arguments", () => {
    preprocessor.setInput(`#define MACRO(arg1'arg2'arg3) #$arg1 "$arg2$arg3\\n"#$MACRO(prints'error)`);
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 71], [0, 71]],
        },
        excerpt: "Too few arguments provided to function-like macro",
        trace: [{
          severity: "info",
          location: {
            file: undefined,
            position: [[0, 8], [0, 13]],
          },
          excerpt: "Macro ‘MACRO’ defined here"
        }]
      });
    }
  });

  // https://github.com/csound/csound/issues/721
  it("expands function-like macros with right parentheses in arguments", () => {
    preprocessor.setInput(`#define MACRO(arg) #$arg#$MACRO(((x)))`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" ((x))");
    expect(preprocessor.messages.length).toBe(0);

    preprocessor.setInput(`#define PRINT(STRING) #prints $STRING#$PRINT(")")`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(' prints ")"');
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 46], [0, 47]]
      },
      excerpt: "‘)’ must be replaced with ‘\\)’",
      solutions: [{
        position: [[0, 46], [0, 47]],
        replaceWith: "\\)"
      }]
    });

    preprocessor.setInput(`#define PRINT(STRING) #prints $STRING#$PRINT({{)}})`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" prints {{)}}");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 47], [0, 48]]
      },
      excerpt: "‘)’ must be replaced with ‘\\)’",
      solutions: [{
        position: [[0, 47], [0, 48]],
        replaceWith: "\\)"
      }]
    });
  });

  it("lexes unterminated quoted string argument of function-like macro", () => {
    preprocessor.setInput(`#define PRINT(STRING) #prints $STRING#$PRINT(")`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" ");
    expect(preprocessor.messages.length).toBe(2);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 46], [0, 47]]
      },
      excerpt: "‘)’ must be replaced with ‘\\)’",
      solutions: [{
        position: [[0, 46], [0, 47]],
        replaceWith: "\\)"
      }]
    });
    expect(preprocessor.messages[1]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 45], [0, 46]]
      },
      excerpt: 'Missing terminating ‘"’'
    });
  });

  it("lexes unterminated braced string argument of function-like macro", () => {
    preprocessor.setInput(`#define PRINT(STRING) #prints $STRING#$PRINT({{)`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(" ");
    expect(preprocessor.messages.length).toBe(2);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 47], [0, 48]]
      },
      excerpt: "‘)’ must be replaced with ‘\\)’",
      solutions: [{
        position: [[0, 47], [0, 48]],
        replaceWith: "\\)"
      }]
    });
    expect(preprocessor.messages[1]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 45], [0, 47]]
      },
      excerpt: "Missing terminating ‘}}’"
    });
  });

  it("lexes #include directives", () => {
    const filePaths = [
      "opcode.udo",
      path.join(__dirname, "opcode.udo")
    ];
    for (const filePath of filePaths) {
      const file = fs.openSync(filePath, "w");
      fs.writeSync(file, 'prints "hello, world\\n"\n');
      fs.closeSync(file);
      preprocessor.setInput(`#include "${filePath}"`);
      preprocessor.lex();
      expect(preprocessor.getOutput()).toBe('prints "hello, world\\n"\n');
      expect(preprocessor.messages.length).toBe(0);
      fs.unlinkSync(filePath);
    }
  });

  it('warns about #include file path delimiters that are not ‘"’', () => {
    const filePath = path.join(__dirname, "opcode.udo");
    fs.closeSync(fs.openSync(filePath, "w"));
    preprocessor.setInput(`#include x${filePath}x`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "warning",
      location: {
        file: undefined,
        position: [[0, 9], [0, 9]]
      },
      excerpt: '‘x’ instead of ‘"’ used to enclose file path'
    });
    fs.unlinkSync(filePath);
  });

  it("lexes #include without file path", () => {
    preprocessor.setInput("#include ");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 0], [0, 8]]
        },
        excerpt: "File path missing"
      });
    }
  });

  it("lexes #include with unterminated file path", () => {
    preprocessor.setInput("#include |opcode.udo");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 9], [0, 9]]
        },
        excerpt: "Missing terminating ‘|’"
      });
    }
  });

  it("lexes #include with missing file", () => {
    preprocessor.setInput('#include "missing.udo"');
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 9], [0, 9]]
        },
        excerpt: "‘missing.udo’ file not found"
      });
    }
  });

  // https://github.com/csound/csound/issues/679
  it("lexes #include with directory", () => {
    const absolutePath = path.resolve(fs.mkdtempSync("tmp"));
    preprocessor.setInput(`#include "${absolutePath}"`);
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 9], [0, 9]]
        },
        excerpt: `‘${absolutePath}’ file not found`
      });
    }
    fs.rmdirSync(absolutePath);
  });

  // https://github.com/csound/csound/issues/681
  it("lexes infinitely nested #include directives", () => {
    const filePath = path.join(__dirname, "opcode.udo");
    const file = fs.openSync(filePath, "w");
    fs.writeSync(file, `#include "${filePath}"`);
    fs.closeSync(file);
    preprocessor.setInput(`#include "${filePath}"`);
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: filePath,
          position: [[0, 9], [0, 9]]
        },
        excerpt: "#include or #includestr nested too deeply"
      });
    }
    fs.unlinkSync(filePath);
  });

  // https://github.com/csound/csound/issues/973
  it("lexes #include directives in subdirectories", () => {
    const directoryPath = path.join(__dirname, "inc");
    fs.mkdirSync(directoryPath);
    const commonOrchestraPath = path.join(directoryPath, "common.orc");
    let file = fs.openSync(commonOrchestraPath, "w");
    fs.writeSync(file, 'prints "hello, world\\n"\n');
    fs.closeSync(file);
    const otherOrchestraPath = path.join(directoryPath, "other.orc");
    file = fs.openSync(otherOrchestraPath, "w");
    fs.writeSync(file, `#include "common.orc"`);
    fs.closeSync(file);
    preprocessor.setInput(`#include "${otherOrchestraPath}"`);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe('prints "hello, world\\n"\n');
    expect(preprocessor.messages.length).toBe(0);
    fs.unlinkSync(otherOrchestraPath);
    fs.unlinkSync(commonOrchestraPath);
    fs.rmdirSync(directoryPath);
  });

  it("lexes #includestr directives", () => {
    const filePaths = [
      "opcode.udo",
      path.join(__dirname, "opcode.udo")
    ];
    for (const filePath of filePaths) {
      const file = fs.openSync(filePath, "w");
      fs.writeSync(file, 'prints "hello, world\\n"\n');
      fs.closeSync(file);
      preprocessor.setInput(`#includestr "${filePath}"`);
      preprocessor.lex();
      expect(preprocessor.getOutput()).toBe('prints "hello, world\\n"\n');
      expect(preprocessor.messages.length).toBe(0);
      fs.unlinkSync(filePath);
    }
  });

  it("lexes #includestr with macro use in path", () => {
    const filePaths = [
      "opcode.udo",
      path.join(__dirname, "opcode.udo")
    ];
    for (const filePath of filePaths) {
      const file = fs.openSync(filePath, "w");
      fs.writeSync(file, 'prints "hello, world\\n"\n');
      fs.closeSync(file);
      preprocessor.setInput(`#define MACRO #${filePath}##includestr "${filePath}"`);
      preprocessor.lex();
      expect(preprocessor.getOutput()).toBe(' prints "hello, world\\n"\n');
      expect(preprocessor.messages.length).toBe(0);
      fs.unlinkSync(filePath);
    }
  });

  it("lexes #includestr without file path", () => {
    preprocessor.setInput("#includestr ");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 0], [0, 11]]
        },
        excerpt: "File path missing"
      });
    }
  });

  it("lexes #includestr with unterminated file path", () => {
    preprocessor.setInput('#includestr "opcode.udo');
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 12], [0, 13]]
      },
      excerpt: 'Missing terminating ‘"’'
    });
  });

  it("lexes next-power-of-2 expanders", () => {
    preprocessor.setInput(dedent`
      @0
      @10
      @@0
      @@10
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe(dedent`
      1
      16
      2
      17
    `);
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes next-power-of-2 expander followed by unexpected character", () => {
    preprocessor.setInput("@@@");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 2], [0, 2]]
        },
        excerpt: "Expected integer"
      });
    }
  });

  it("lexes next-power-of-2 expander without integer", () => {
    preprocessor.setInput("@");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 1], [0, 1]]
        },
        excerpt: "Expected integer"
      });
    }
  });

  it("expands score loop", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput("{ 3 I\n$I\n}");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("1\n2\n3\n");
    expect(preprocessor.messages.length).toBe(0);
  });

  it("expands nested score loops", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput(dedent`
      { 2 I
        { 3 J
          $I $J
        }
      }
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe([
      "      1 1",
      "      1 2",
      "      1 3",
      "  ",
      "      2 1",
      "      2 2",
      "      2 3",
      "  ",
      ""
    ].join("\n"));
    expect(preprocessor.messages.length).toBe(0);
    preprocessor.setInput(dedent`
      { 2 I
        { 3 J
          { 2 K
            $I $J $K
          }
        }
      }
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe([
      "            1 1 1",
      "          1 1 2",
      "    ",
      "            1 2 1",
      "          1 2 2",
      "    ",
      "            1 3 1",
      "          1 3 2",
      "    ",
      "  ",
      "            2 1 1",
      "          2 1 2",
      "    ",
      "            2 2 1",
      "          2 2 2",
      "    ",
      "            2 3 1",
      "          2 3 2",
      "    ",
      "  ",
      ""
    ].join("\n"));
    expect(preprocessor.messages.length).toBe(0);
  });

  // https://github.com/csound/csound/issues/987
  it("expands score loop with macro uses", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput(dedent`
      #define samdur #[@9472680/44100]#
      #define chunklen #.2#
      #define numchunks #[$samdur/$chunklen]#
      #define chunkbreak #.05#
      #define pos(P) #[($chunklen+$chunkbreak)*$P]#
      { 2 I
      i 107 $pos($I) 		$chunklen 	[16000+$I*100]   [44100/@9472680] 10	[($I+137)/$numchunks]
      }
      s
    `);
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe([
      " ",
      " ",
      " ",
      " ",
      " ",
      "i 107 [(.2+.05)*1] 		.2 	[16000+1*100]   [44100/16777216] 10	[(1+137)/[[16777216/44100]/.2]]",
      "i 107 [(.2+.05)*2] 		.2 	[16000+2*100]   [44100/16777216] 10	[(2+137)/[[16777216/44100]/.2]]",
      "",
      "s"
    ].join("\n"));
    expect(preprocessor.messages.length).toBe(0);
  });

  it("lexes score loop left brace followed by unexpected character", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput("{?}");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 1], [0, 1]]
        },
        excerpt: "Expected integer greater than 0"
      });
    }
  });

  it("lexes score loop repeat count followed by unexpected character", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput("{ 3 ?}");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 4], [0, 4]]
        },
        excerpt: "Expected macro name"
      });
    }
  });

  it("lexes score loop repetition macro name followed by unexpected character", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput("{ 3 I?}");
    try {
      preprocessor.lex();
      fail("Expected exception.");
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: "error",
        location: {
          file: undefined,
          position: [[0, 5], [0, 5]]
        },
        excerpt: "Expected newline"
      });
    }
  });

  it("lexes unterminated score loop", () => {
    preprocessor.isScorePreprocessor = true;
    preprocessor.setInput("{ 3 I\n$I\n");
    preprocessor.lex();
    expect(preprocessor.getOutput()).toBe("");
    expect(preprocessor.messages.length).toBe(1);
    expect(preprocessor.messages[0]).toEqual({
      severity: "error",
      location: {
        file: undefined,
        position: [[0, 0], [0, 1]]
      },
      excerpt: "Missing terminating ‘}’"
    });
  });

  describe("source map", () => {
    it("is defined", () => {
      preprocessor.setInput("");
      preprocessor.lex();
      expect(preprocessor.sourceMap).toBeDefined();
    });

    it("includes ends of lines", () => {
      preprocessor.setInput(dedent`
        instr 1
          until 1 == 1 do
          enduntil
        endin
      `);
      preprocessor.lex();
      expect(preprocessor.sourceMap.sourceRange([[2, 1], [2, 10]])).toEqual([[2, 1], [2, 10]]);
    });

    it("includes end of file", () => {
      preprocessor.setInput("x");
      preprocessor.lex();
      expect(preprocessor.sourceMap.sourceLocation([0, 1])).toEqual([0, 1]);
    });

    // https://github.com/csound/csound/issues/553
    it("handles line continuations", () => {
      preprocessor.setInput(dedent`
        prints \\
        "hello, world"error
      `);
      preprocessor.lex();
      expect(preprocessor.sourceMap.sourceRange([[0, 21], [0, 26]])).toEqual([[1, 14], [1, 19]]);
    });

    // https://github.com/csound/csound/issues/643
    it("handles function-like macros", () => {
      preprocessor.setInput(dedent`
        //
        #define MACRO(string) #prints $string#
        instr 1
          $MACRO("hello, world")
          error
        endin
      `);
      preprocessor.lex();
      expect(preprocessor.sourceMap.sourceRange([[4, 2], [4, 7]])).toEqual([[4, 2], [4, 7]]);
    });

    it("handles braced strings", () => {
      preprocessor.setInput(dedent`
        S_ = {{
        }}
        error

      `);
      preprocessor.lex();
      expect(preprocessor.sourceMap.sourceRange([[2, 0], [2, 0]])).toEqual([[2, 0], [2, 0]]);
    });
  });
});
