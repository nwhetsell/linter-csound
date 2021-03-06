// These patterns need to be kept synchronized with the check for unnecessary
// periods ending a use of a macro.
identifier [A-Z_a-z]\w*
macro_use \${identifier}\.?

// To match the behavior of the Csound preprocessor, enclose these directives in
// non-capturing groups so that Jison Lex doesn’t append word break patterns to
// them. Also, #define is the only directive that allows whitespace after the #.
include (?:"#include")
includestr (?:"#includestr")
define "#"[ \t]*(?:"define")
undef (?:"#undef")
ifdef_or_ifndef "#if""n"?(?:"def")

newline \n|\r\n?
single_line_comment (?:";"|"//").*(?:{newline}|$)

// The Csound preprocessor uses ; instead of a more general single-line comment
// pattern.
line_continuation \\[ \t]*(?:";".*)?{newline}

else "#else"
endif "#end"(?:"if")?\b

%x block_comment

%x quoted_string
%x braced_string

%s define_directive
%x macro_parameter_name_list
%x after_macro_parameter_name
%x after_macro_parameter_name_separator
%s before_macro_body
%x macro_body

%s undef_directive

%s ifdef_directive
%s ifndef_directive
%s ifdef_true
%x ifdef_false
%s else_true
%x else_false

%x include_directive
%x includestr_directive
%x includestr_directive_quoted_string

%x macro_parameter_value_list
%x macro_parameter_value
%x macro_parameter_value_quoted_string
%x macro_parameter_value_braced_string
%x macro_parameter_value_parenthetical

%x next_power_of_2
%x next_power_of_2_plus_1

%x score_loop
%x score_loop_after_left_brace
%x score_loop_after_repeat_count
%x score_loop_after_repetition_macro_name
%x inner_score_loop

%%

<INITIAL,quoted_string,macro_parameter_value_quoted_string,includestr_directive_quoted_string>{line_continuation}
%{
  this.currentTextNode = null;
  for (let i = yyleng - 1; i > 0; i--) {
    const character = yytext.charAt(i);
    if (character !== '\n' && character !== '\r') {
      this.messages.push({
        severity: 'warning',
        location: {
          file: this.filePath,
          position: [
            [yylloc.first_line - 1, yylloc.first_column],
            [yylloc.first_line - 1, yylloc.first_column + 1]
          ]
        },
        excerpt: 'Line continuation is not followed immediately by newline'
      });
      break;
    }
  }
%}

"/*"
%{
  this.begin('block_comment');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.addText(' ');
%}
<block_comment>"/*"
%{
  this.messages.push({
    severity: 'warning',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `${this.quote(yytext)} in block comment`
  });
%}
<block_comment>"*/"
%{
  this.startRanges.pop();
  this.popState();
%}
<block_comment>.|{newline} // Do nothing
<block_comment><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: 'Unterminated block comment'
  });
%}

{single_line_comment} this.addNewline();

<quoted_string,braced_string>"\\"[^abfnrtv"\\]
%{
  this.addText(yytext);
  this.messages.push({
    severity: 'warning',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `Unknown escape sequence ${this.quote(yytext)}`
  });
%}

\"
%{
  this.begin('quoted_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.addText(yytext);
%}
<quoted_string>\\.|[^$"\n\r] this.addText(yytext);
<quoted_string>\"
%{
  this.startRanges.pop();
  this.popState();
  this.addText(yytext);
%}
<quoted_string,macro_parameter_value_quoted_string,includestr_directive_quoted_string>{newline}|<<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote('"')}`
  });
  this.popState();
%}

"{{"
%{
  this.begin('braced_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.addText(yytext);
%}
<braced_string>{newline} this.addNewline();
<braced_string>[^}]|"}"[^}] this.addText(yytext);
<braced_string>"}}"
%{
  this.startRanges.pop();
  this.popState();
  this.addText(yytext);
%}
<braced_string,macro_parameter_value_braced_string><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote('}}')}`
  });
%}

<INITIAL,quoted_string,macro_parameter_value_quoted_string,includestr_directive_quoted_string>{macro_use}\(
%{
  let i = yyleng - 2;
  if (yytext.charAt(i) === '.') {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: [
          [yylloc.first_line - 1, yylloc.first_column + i],
          [yylloc.first_line - 1, yylloc.first_column + i + 1]
        ]
      },
      excerpt: `Unnecessary ${this.quote('.')} after macro name`
    });
  } else {
    i++;
  }
  this.macroUse = new MacroUseElement(this.getMacro(yytext.substring(1, i)), [
    [yylloc.first_line - 1, yylloc.first_column],
    [yylloc.first_line - 1, yylloc.first_column + i]
  ]);
  this.begin('macro_parameter_value_list');
%}

<macro_parameter_value_list>[^'#)]
%{
  this.unput(yytext);
  this.begin('macro_parameter_value');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.macroParameterValue = '';
%}
<macro_parameter_value_list>['#)]
%{
  {
    const macrosByName = this.macroUse.macrosByName;
    const parameterNameIndex = Object.keys(macrosByName).length;
    const macro = this.macroUse.macro;
    if (parameterNameIndex >= macro.parameterNames.length) {
      throw new CsoundPreprocessorError({
        severity: 'error',
        location: {
          file: this.filePath,
          position: [
            this.startRanges.pop()[0],
            [yylloc.last_line - 1, yylloc.last_column - 1]
          ]
        },
        excerpt: 'Too many arguments provided to function-like macro',
        trace: [{
          severity: 'info',
          location: {
            file: this.filePath,
            position: macro.range
          },
          excerpt: `Macro ${this.quote(macro.name)} defined here`
        }]
      });
    }
    const macroName = macro.parameterNames[parameterNameIndex];
    macrosByName[macroName] = {
      name: macroName,
      body: this.macroParameterValue
    };
    if (yytext === ')') {
      this.startRanges.pop();
      this.popState();
      this.expandMacro(YY_START);
    } else if (yytext !== "'") {
      this.messages.push({
        severity: 'warning',
        location: {
          file: this.filePath,
          position: this.rangeFromLocation(yylloc)
        },
        excerpt: `${this.quote(yytext)} instead of single quote used to separate macro parameters`
      });
    }
  }
%}

<macro_parameter_value>['#)]
%{
  this.unput(yytext);
  this.popState();
%}
<macro_parameter_value>\"
%{
  this.begin('macro_parameter_value_quoted_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.macroParameterValue += yytext;
%}
<macro_parameter_value>"{{"
%{
  this.begin('macro_parameter_value_braced_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.macroParameterValue += yytext;
%}
<macro_parameter_value>\(
%{
  this.begin('macro_parameter_value_parenthetical');
  this.macroParameterValue += yytext;
%}

<macro_parameter_value_quoted_string,macro_parameter_value_braced_string>[#')]
%{
  this.macroParameterValue += yytext;
  const solution = {
    position: this.rangeFromLocation(yylloc),
    replaceWith: '\\' + yytext
  };
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: solution.position
    },
    excerpt: `${this.quote(yytext)} must be replaced with ${this.quote(solution.replaceWith)}`,
    solutions: [solution]
  });
%}

<macro_parameter_value_quoted_string,macro_parameter_value_braced_string>\\[#')] this.macroParameterValue += yytext.charAt(yyleng - 1);

<macro_parameter_value_quoted_string>\"
%{
  this.macroParameterValue += yytext;
  this.startRanges.pop();
  this.popState();
%}

<macro_parameter_value_braced_string>"}}"
%{
  this.macroParameterValue += yytext;
  this.startRanges.pop();
  this.popState();
%}

<macro_parameter_value_parenthetical>\( this.macroParameterValue += yytext; this.begin(YY_START);
<macro_parameter_value_parenthetical>\) this.macroParameterValue += yytext; this.popState();

<macro_parameter_value,macro_parameter_value_braced_string,macro_parameter_value_parenthetical>.|{newline} this.macroParameterValue += yytext;
<macro_parameter_value_quoted_string>. this.macroParameterValue += yytext;

<INITIAL,quoted_string,macro_parameter_value_quoted_string,includestr_directive_quoted_string>{macro_use}
%{
  {
    let i = yyleng - 1;
    if (yytext.charAt(i) === '.') {
      const character = this.input();
      this.unput(character);
      // This needs to be kept synchronized with the macro name patterns.
      if (!/\w/.test(character)) {
        this.messages.push({
          severity: 'warning',
          location: {
            file: this.filePath,
            position: [
              [yylloc.first_line - 1, yylloc.first_column + i],
              [yylloc.first_line - 1, yylloc.first_column + i + 1]
            ]
          },
          excerpt: `Unnecessary ${this.quote('.')} after macro name`
        });
      }
    } else {
      i++;
    }
    this.macroUse = new MacroUseElement(this.getMacro(yytext.substring(1, i)), this.rangeFromLocation(yylloc));
    this.expandMacro(YY_START);
  }
%}

{define}
%{
  this.begin('define_directive');
  this.startRanges.push(this.rangeFromLocation(yylloc));
%}

<define_directive>{identifier}\(?
%{
  this.popState();
  const newMacro = {body: ''};
  const lastCharacterIndex = yyleng - 1;
  if (yytext.charAt(lastCharacterIndex) === '(') {
    this.begin('macro_parameter_name_list');
    this.startRanges.push([
      [yylloc.last_line - 1, yylloc.last_column - 1],
      [yylloc.last_line - 1, yylloc.last_column]
    ]);
    newMacro.name = yytext.substr(0, lastCharacterIndex);
    newMacro.parameterNames = [];
    newMacro.range = [
      [yylloc.first_line - 1, yylloc.first_column],
      [yylloc.last_line - 1, yylloc.last_column - 1]
    ];
  } else {
    this.begin('before_macro_body');
    newMacro.name = yytext;
    newMacro.range = this.rangeFromLocation(yylloc);
  }
  const macro = this.macrosByName[newMacro.name];
  if (macro) {
    const message = {
      severity: 'warning',
      location: {
        file: this.filePath,
        position: newMacro.range
      },
      excerpt: `${this.quote(newMacro.name)} macro redefined`
    };
    if (macro.range) {
      message.trace = [{
        severity: 'info',
        location: {
          file: this.filePath,
          position: macro.range
        },
        excerpt: 'Previous definition is here'
      }];
    } else {
      message.text += `, was ${this.quote(macro.body)}`;
    }
    this.messages.push(message);
  }
  this.macro = newMacro;
  this.macrosByName[newMacro.name] = newMacro;
%}

<macro_parameter_name_list,after_macro_parameter_name_separator>{identifier}
%{
  const parameterNames = this.macro.parameterNames;
  if (parameterNames.indexOf(yytext) >= 0) {
    throw new CsoundPreprocessorError({
      severity: 'error',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: `Duplicate macro parameter name ${this.quote(yytext)}`
    });
  }
  parameterNames.push(yytext);
  if ('after_macro_parameter_name_separator' === YY_START)
    this.popState();
  this.begin('after_macro_parameter_name');
%}
<macro_parameter_name_list>\)
%{
  this.startRanges.pop();
  this.begin('before_macro_body');
%}
<macro_parameter_name_list,after_macro_parameter_name_separator>\s+ // Do nothing
<macro_parameter_name_list,after_macro_parameter_name_separator>.
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected macro parameter name'
  });
%}
<macro_parameter_name_list><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote(')')}`
  });
%}

<after_macro_parameter_name>['#]
%{
  if (yytext !== "'") {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: `${this.quote(yytext)} instead of single quote used to separate macro parameters`
    });
  }
  this.popState()
  this.begin('after_macro_parameter_name_separator');
%}
<after_macro_parameter_name>\)
%{
  this.popState();
  this.popState();
  this.begin('before_macro_body');
%}
<after_macro_parameter_name>\s+ // Do nothing
<after_macro_parameter_name>.
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected single quote in macro parameter list'
  });
%}

<before_macro_body>"#"
%{
  this.popState();
  this.begin('macro_body');
  this.startRanges.push(this.rangeFromLocation(yylloc));
%}
<before_macro_body>\s+ // Do nothing
<before_macro_body>[^#]|<<EOF>>
%{
  const message = {
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: `Expected ${this.quote('#')} after macro name`
  };
  if (yytext.length > 0)
    throw new CsoundPreprocessorError(message);
  this.messages.push(message);
%}

<macro_body>"\\#" this.macro.body += '#';
<macro_body>[^#] this.macro.body += yytext;
<macro_body>"#"
%{
  this.startRanges.pop();
  this.popState();
  this.addText(' ');
%}
<macro_body><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote('#')}`
  });
%}

{undef}
%{
  this.begin('undef_directive');
  this.startRanges.push(this.rangeFromLocation(yylloc));
%}

<undef_directive>{identifier}
%{
  this.startRanges.pop();
  this.popState();
  if (this.macrosByName[yytext]) {
    delete this.macrosByName[yytext];
  } else {
    this.messages.push({
      severity: 'error',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: `${this.quote(yytext)} macro is not defined`
    });
  }
%}

{ifdef_or_ifndef}
%{
  this.begin(yytext.startsWith('#ifdef') ? 'ifdef_directive' : 'ifndef_directive');
  this.startRanges.push(this.rangeFromLocation(yylloc));
%}
<ifdef_directive>{identifier}  this.popState(); this.begin( this.macrosByName[yytext] ? 'ifdef_true' : 'ifdef_false');
<ifndef_directive>{identifier} this.popState(); this.begin(!this.macrosByName[yytext] ? 'ifdef_true' : 'ifdef_false');

<ifdef_true,ifdef_false,else_true,else_false>{endif}
%{
  this.startRanges.pop();
  this.popState();
%}

<else_true,else_false>{else}
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: '#else after #else'
  });
%}

<ifdef_true>{else}  this.popState(); this.begin('else_false');
<ifdef_false>{else} this.popState(); this.begin('else_true');

<ifdef_false,else_false>.|{newline} // Do nothing

<ifdef_true,ifdef_false,else_true,else_false><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: 'Unterminated conditional directive'
  });
%}

{endif}
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `${yytext} without #ifdef or #ifndef`
  });
%}

{else}
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: '#else without #ifdef or #ifndef'
  });
%}

{includestr}
%{
  this.begin('includestr_directive');
  this.startRanges.push(this.rangeFromLocation(yylloc));
%}
<includestr_directive>[ \t] // Do nothing
<includestr_directive>\"
%{
  this.begin('includestr_directive_quoted_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.includestrFilePath = '';
%}
<includestr_directive>.
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected double quote after #includestr'
  });
%}

<includestr_directive_quoted_string>\"
%{
  const includestrFilePathStartRange = this.startRanges.pop();
  this.popState();
  this.popState();
  this.includeFile(this.includestrFilePath, includestrFilePathStartRange);
%}
<includestr_directive_quoted_string>. this.includestrFilePath += yytext;

{include}
%{
  this.begin('include_directive');
  this.startRanges.push(this.rangeFromLocation(yylloc));
%}
<include_directive>[ \t] // Do nothing
<include_directive>[^ \t]
%{
  {
    const includeFilePathStartRange = this.rangeFromPosition(yylloc.first_line, yylloc.first_column);
    const delimiter = yytext;
    if (delimiter !== '"') {
      this.messages.push({
        severity: 'warning',
        location: {
          file: this.filePath,
          position: includeFilePathStartRange
        },
        excerpt: `${this.quote(delimiter)} instead of ${this.quote('"')} used to enclose file path`
      });
    }
    this.popState();
    let includeFilePath = '';
    for (let character = this.input(); character !== delimiter; character = this.input()) {
      if (character === '\n' || character === '\r' || !character) {
        throw new CsoundPreprocessorError({
          severity: 'error',
          location: {
            file: this.filePath,
            position: includeFilePathStartRange
          },
          excerpt: `Missing terminating ${this.quote(delimiter)}`
        });
      }
      includeFilePath += character;
    }
    this.includeFile(includeFilePath, includeFilePathStartRange);
  }
%}

<include_directive,includestr_directive>{newline}|<<EOF>>
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: 'File path missing'
  });
%}

<define_directive,undef_directive,ifdef_directive,ifndef_directive>\s+ // Do nothing
<define_directive,undef_directive,ifdef_directive,ifndef_directive>[^\s]
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Macro name must be an identifier'
  });
%}
<define_directive,undef_directive,ifdef_directive,ifndef_directive><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: 'Macro name missing'
  });
%}

<INITIAL,macro_parameter_value_list>"@" this.begin('next_power_of_2');
<next_power_of_2>"@" this.popState(); this.begin('next_power_of_2_plus_1');

<next_power_of_2>\d+
%{
  this.popState();
  this.addText(Math.pow(2, Math.ceil(Math.log2(Number(yytext) + 1))).toString());
%}
<next_power_of_2_plus_1>\d+
%{
  this.popState();
  this.addText((yytext === '0') ? '2' : (Math.pow(2, Math.ceil(Math.log2(Number(yytext)))) + 1).toString());
%}

<next_power_of_2,next_power_of_2_plus_1>[ \t]+
%{
  this.messages.push({
    severity: 'warning',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: 'Unnecessary whitespace in next-power-of-2 expander'
  });
%}

<next_power_of_2,next_power_of_2_plus_1>[^ \t\d]|<<EOF>>
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected integer'
  });
%}

"{"
%{
  if (this.isScorePreprocessor) {
    this.macro = {body: ''};
    this.startRanges.push(this.rangeFromLocation(yylloc));
    this.begin('score_loop');
    this.begin('score_loop_after_left_brace');
  } else {
    this.addText(yytext);
  }
%}

<score_loop_after_left_brace>[1-9]\d*
%{
  this.macro.repeatCount = Number(yytext);
  this.popState();
  this.begin('score_loop_after_repeat_count');
%}
<score_loop_after_left_brace>\s+ // Do nothing
<score_loop_after_left_brace>.|{newline}
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected integer greater than 0'
  });
%}

<score_loop_after_repeat_count>{identifier}
%{
  this.macro.repetitionMacro = {name: yytext};
  this.popState();
  this.begin('score_loop_after_repetition_macro_name');
%}
<score_loop_after_repeat_count>{newline} this.popState();
<score_loop_after_repeat_count>\s+ // Do nothing
<score_loop_after_repeat_count>.
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected macro name'
  });
%}

<score_loop_after_repetition_macro_name>{newline} this.popState();
<score_loop_after_repetition_macro_name>\s+ // Do nothing
<score_loop_after_repetition_macro_name>.
%{
  throw new CsoundPreprocessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected newline'
  });
%}

<score_loop,inner_score_loop>"{"
%{
  this.macro.body += yytext;
  this.begin('inner_score_loop');
%}
<score_loop>"}"
%{
  const repetitionMacro = this.macro.repetitionMacro;
  for (let repetition = 1; repetition <= this.macro.repeatCount; repetition++) {
    this.macroUse = new MacroUseElement(this.macro, this.rangeFromLocation(yylloc));
    if (repetitionMacro) {
      repetitionMacro.body = repetition.toString();
      this.macroUse.macrosByName[repetitionMacro.name] = repetitionMacro;
    }
    this.expandMacro(YY_START);
  }
  this.startRanges.pop();
  this.popState();
%}
<inner_score_loop>"}"
%{
  this.macro.body += yytext;
  this.popState();
%}
<score_loop,inner_score_loop>.|{newline} this.macro.body += yytext;
<score_loop,inner_score_loop><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote('}')}`
  });
%}

{newline} this.addNewline();

. this.addText(yytext);

%%

const fs = require('fs');
const path = require('path');

lexer.addNewline = function() {
  this.appendToCurrentTextNode('\n');
  this.generatedLineCount++;
  this.generatedColumnCount = 0;
};

lexer.addText = function(text) {
  this.appendToCurrentTextNode(text);
  this.generatedColumnCount += text.length;
};

lexer.appendToCurrentTextNode = function(text) {
  this.sourceMap.add(
    [this.yylloc.first_line - 1, this.yylloc.first_column],
    [this.generatedLineCount, this.generatedColumnCount]
  );
  if (this.currentTextNode) {
    this.currentTextNode.text += text;
  } else {
    this.currentTextNode = new CsoundPreprocessorTextNode(text);
    this.rootElement.childNodes.push(this.currentTextNode);
  }
};

lexer.expandMacro = function(YY_START) {
  const macrosByName = this.macroUse.macrosByName;
  const macro = this.macroUse.macro;
  if (macro.parameterNames && Object.keys(macrosByName).length < macro.parameterNames.length) {
    throw new CsoundPreprocessorError({
      severity: 'error',
      location: {
        file: this.filePath,
        position: lexer.rangeFromPosition(this.yylloc.first_line, this.yylloc.first_column)
      },
      excerpt: 'Too few arguments provided to function-like macro',
      trace: [{
        severity: 'info',
        location: {
          file: this.filePath,
          position: macro.range
        },
        excerpt: `Macro ${this.quote(macro.name)} defined here`
      }]
    });
  }
  if (this.expansionDepth === this.maximumExpansionDepth) {
    throw new CsoundPreprocessorError({
      severity: 'error',
      location: {
        file: this.filePath,
        position: this.macroUse.range
      },
      excerpt: 'Macro expanded too deeply'
    });
  }
  const preprocessor = this.makePreprocessor(macro.body);
  preprocessor.expansionDepth = this.expansionDepth + 1;
  preprocessor.filePath = this.filePath;
  Object.assign(preprocessor.macrosByName, macrosByName);
  try {
    preprocessor.lex();
  } catch (error) {
    if (error.lintMessage)
      error.lintMessage.location.position = this.macroUse.range;
    throw error;
  }
  this.macroUse.childNodes = preprocessor.rootElement.childNodes;
  this.rootElement.childNodes.push(this.macroUse);
  this.currentTextNode = null;
  if ('quoted_string' === YY_START) {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(this.yylloc)
      },
      excerpt: `${this.quote(macro.name)} macro expanded in string`
    });
  }
};

lexer.getMacro = function(macroName) {
  const macro = this.macrosByName[macroName];
  if (!macro) {
    throw new CsoundPreprocessorError({
      severity: 'error',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(this.yylloc)
      },
      excerpt: `${this.quote(macroName)} is not a macro or macro parameter`
    });
  }
  return macro;
};

lexer.getOutput = function() {
  return this.rootElement.getOutput();
};

lexer.includeFile = function(includeFilePath, includeFilePathStartRange) {
  if (includeFilePath.length > 0) {
    let paths = [];
    if (path.isAbsolute(includeFilePath)) {
      paths.push(includeFilePath);
    } else {
      // From https://csound.com/docs/manual/OrchDirFiles.html, first search the
      // current directory, then the directory of the file being preprocessed.
      paths.push(...this.currentDirectories);
      if (this.filePath)
        paths.push(path.dirname(this.filePath));
      // If there’s a file named .csound-include-directories in the current
      // directory, assume it contains a list of directory paths, one per line,
      // and also search those.
      for (const directory of this.currentDirectories) {
        const absolutePath = path.join(directory, '.csound-include-directories');
        try {
          const stats = fs.statSync(absolutePath);
          if (stats && stats.isFile())
            paths.push(...fs.readFileSync(absolutePath, 'utf8').trim().split(/\n|\r\n?/));
        } catch (error) {
          // Do nothing
        }
      }
      // Finally, if this lexer has an includeDirectories property, search
      // those.
      if (this.includeDirectories)
        paths.push(...this.includeDirectories);
      paths = paths.map(directory => path.join(directory, includeFilePath));
    }
    for (const absolutePath of paths) {
      let stats;
      try {
        stats = fs.statSync(absolutePath);
      } catch (error) {
        continue;
      }
      if (stats.isFile()) {
        if (this.includeDepth === this.maximumIncludeDepth) {
          throw new CsoundPreprocessorError({
            severity: 'error',
            location: {
              file: this.filePath,
              position: includeFilePathStartRange
            },
            excerpt: '#include or #includestr nested too deeply'
          });
        }
        const preprocessor = this.makePreprocessor(fs.readFileSync(absolutePath, 'utf8'));
        preprocessor.filePath = absolutePath;
        preprocessor.includeDepth = this.includeDepth + 1;
        preprocessor.lex();
        for (const childNode of preprocessor.rootElement.childNodes) {
          this.rootElement.childNodes.push(childNode);
        }
        this.currentTextNode = null;
        return;
      }
    }
    throw new CsoundPreprocessorError({
      severity: 'error',
      location: {
        file: this.filePath,
        position: includeFilePathStartRange
      },
      excerpt: `${this.quote(includeFilePath)} file not found`
    });
  } else {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: includeFilePathStartRange
      },
      excerpt: 'Empty file path'
    });
  }
};

const original_lex = lexer.lex;
lexer.lex = function() {
  const token = original_lex.apply(this, arguments);
  if (this.done) {
    this.sourceMap.add(
      [this.yylloc.first_line - 1, this.yylloc.first_column],
      [this.generatedLineCount, this.generatedColumnCount]
    );
  }
  return token;
};

lexer.makePreprocessor = function(input) {
  // A function like yy_scan_string is unavailable in Jison Lex.
  function Preprocessor() {
    this.yy = {};
  }
  Preprocessor.prototype = this;
  const preprocessor = new Preprocessor();
  preprocessor.includeDirectories = this.includeDirectories;
  preprocessor.isScorePreprocessor = this.isScorePreprocessor;
  preprocessor.setInput(input);
  preprocessor.currentDirectories = this.currentDirectories;
  Object.assign(preprocessor.macrosByName, this.macrosByName);
  return preprocessor;
};

lexer.maximumExpansionDepth = 100;

lexer.maximumIncludeDepth = 100;

lexer.quote = string => `‘${string}’`;

lexer.rangeFromLocation = yylloc => {
  return [
    [yylloc.first_line - 1, yylloc.first_column],
    [yylloc.last_line - 1, yylloc.last_column]
  ];
};

lexer.rangeFromPosition = (line, column) => {
  const lineMinus1 = line - 1;
  return [[lineMinus1, column], [lineMinus1, column]];
};

const original_setInput = lexer.setInput;
lexer.setInput = function(input, yy) {
  // This is an array because Atom::Project::getPaths
  // <https://atom.io/docs/api/latest/Project#instance-getPaths> returns an
  // array.
  this.currentDirectories = [path.resolve()];
  this.currentTextNode = null;
  this.expansionDepth = 0;
  this.includeDepth = 0;
  this.generatedColumnCount = 0;
  this.generatedLineCount = 0;
  // https://github.com/csound/csound/search?q=cs_init_math_constants_macros+path%3AEngine+filename%3Acsound_pre.lex
  this.macrosByName = {
    M_E:        {name: 'M_E',        body: '2.71828182845904523536'},
    M_LOG2E:    {name: 'M_LOG2E',    body: '1.44269504088896340736'},
    M_LOG10E:   {name: 'M_LOG10E',   body: '0.43429448190325182765'},
    M_LN2:      {name: 'M_LN2',      body: '0.69314718055994530942'},
    M_LN10:     {name: 'M_LN10',     body: '2.30258509299404568402'},
    M_PI:       {name: 'M_PI',       body: '3.14159265358979323846'},
    M_PI_2:     {name: 'M_PI_2',     body: '1.57079632679489661923'},
    M_PI_4:     {name: 'M_PI_4',     body: '0.78539816339744830962'},
    M_1_PI:     {name: 'M_1_PI',     body: '0.31830988618379067154'},
    M_2_PI:     {name: 'M_2_PI',     body: '0.63661977236758134308'},
    M_2_SQRTPI: {name: 'M_2_SQRTPI', body: '1.12837916709551257390'},
    M_SQRT2:    {name: 'M_SQRT2',    body: '1.41421356237309504880'},
    M_SQRT1_2:  {name: 'M_SQRT1_2',  body: '0.70710678118654752440'},
    M_INF:      {name: 'M_INF',      body: '800000000000.0'}
  };
  this.messages = [];
  this.rootElement = new CsoundPreprocessorElement();
  this.sourceMap = new SourceMap();
  this.startRanges = [];
  return original_setInput.apply(this, arguments);
};

class CsoundPreprocessorTextNode {
  constructor(text) {
    this.text = text;
  }

  getOutput() {
    return this.text;
  }
}

class CsoundPreprocessorElement {
  constructor() {
    this.childNodes = [];
  }

  getOutput() {
    let output = '';
    for (const childNode of this.childNodes) {
      output += childNode.getOutput();
    }
    return output;
  }
}

class MacroUseElement extends CsoundPreprocessorElement {
  constructor(macro, range) {
    super();
    this.macro = macro;
    this.macrosByName = {};
    this.range = range;
  }
}

// The LineMap and SourceMap classes are based on code in CoffeeScript
// (https://github.com/jashkenas/coffeescript/blob/master/src/sourcemap.litcoffee),
// which is MIT-licensed
// (https://github.com/jashkenas/coffeescript/blob/master/LICENSE).

class LineMap {
  constructor(line) {
    this.line = line;
    this.columnMaps = [];
  }

  add(column, sourceLocation) {
    this.columnMaps[column] = {
      line: this.line,
      column: column,
      sourceLine: sourceLocation[0],
      sourceColumn: sourceLocation[1]
    };
  }

  sourceLocation(column) {
    for ( ; column >= 0; column--) {
      const map = this.columnMaps[column];
      if (map)
        return [map.sourceLine, map.sourceColumn];
    }
    return null;
  }
}

class SourceMap {
  constructor(line) {
    this.lineMaps = [];
  }

  add(sourceLocation, generatedLocation) {
    const line = generatedLocation[0];
    let lineMap = this.lineMaps[line];
    if (!lineMap) {
      lineMap = new LineMap(line);
      this.lineMaps[line] = lineMap;
    }
    lineMap.add(generatedLocation[1], sourceLocation);
  }

  sourceLocation(location) {
    for (let line = location[0]; line >= 0; line--) {
      const lineMap = this.lineMaps[line];
      if (lineMap)
        return lineMap.sourceLocation(location[1]);
    }
    return null;
  }

  sourceRange(range) {
    return [this.sourceLocation(range[0]), this.sourceLocation(range[1])];
  }
}

class CsoundPreprocessorError extends Error {
  constructor(lintMessage) {
    super(lintMessage.excerpt);
    this.name = 'CsoundPreprocessorError';
    this.lintMessage = lintMessage;
  }
}
