/*
 * This lexer assumes that its input orchestra has been preprocessed. This means
 * that the orchestra cannot contain preprocessor directives, macro uses, next-
 * power-of-2 expanders (@ or @@ followed by digits), line continuations, or
 * comments. Also, all line endings must be line feeds (\n, U+000A).
 */

/* These patterns need to be kept synchronized with skipWhitespaceAndNewline. */
whitespace [ \t]+
optional_whitespace [ \t]*

identifier [A-Z_a-z]\w*

decimal_integer \d+
signed_integer [-+]?{decimal_integer}
exponent_indicator [Ee]
exponent {exponent_indicator}{signed_integer}
decimal_number \d+\.?\d*{exponent}?|\.\d+{exponent}?
hexadecimal_integer "0"[Xx][0-9A-Fa-f]+

%x after_instr_keyword
%x after_instrument_number_or_identifier
%x after_instrument_plus_sign

%x after_opcode_keyword
%x after_opcode_name
%x before_opcode_output_type_signature
%x after_opcode_output_type_signature
%x before_opcode_input_type_signature

%x opcode_output_type_annotation

%options flex

%%

\n return 'NEWLINE';

<*>{whitespace} // Do nothing

/*
 * The Csound orchestra lexer allows most punctuation to be optionally followed
 * by whitespace and a newline, but the whitespace and newline is considered
 * part of the punctuation token. This throws off error reporting, so skip the
 * whitespace and newline.
 */
"("  this.skipWhitespaceAndNewline(); return '(';
")"                                   return ')';
"["  this.skipWhitespaceAndNewline(); return '[';
"]"                                   return ']';
"+"  this.skipWhitespaceAndNewline(); return '+';
"-"  this.skipWhitespaceAndNewline(); return '-';
"*"  this.skipWhitespaceAndNewline(); return '*';
"/"  this.skipWhitespaceAndNewline(); return '/';
"%"  this.skipWhitespaceAndNewline(); return '%';
"^"  this.skipWhitespaceAndNewline(); return '^';
"?"  this.skipWhitespaceAndNewline(); return '?';
":"                                   return ':';
","  this.skipWhitespaceAndNewline(); return ',';
"!"  this.skipWhitespaceAndNewline(); return '!';

/*
 * The -> operator is called S_ELIPSIS
 * <https://github.com/csound/csound/search?q=S_ELIPSIS+path%3AEngine+filename%3Acsound_orc.lex>.
 * It appears to be undocumented.
 */
"->"                                  return '->';

"!=" this.skipWhitespaceAndNewline(); return '!=';
"&&" this.skipWhitespaceAndNewline(); return '&&';
"||" this.skipWhitespaceAndNewline(); return '||';
"<<" this.skipWhitespaceAndNewline(); return '<<';
">>" this.skipWhitespaceAndNewline(); return '>>';
"<"  this.skipWhitespaceAndNewline(); return '<';
"<=" this.skipWhitespaceAndNewline(); return '<=';
"==" this.skipWhitespaceAndNewline(); return '==';
"+=" this.skipWhitespaceAndNewline(); return '+=';
"-=" this.skipWhitespaceAndNewline(); return '-=';
"*=" this.skipWhitespaceAndNewline(); return '*=';
"/=" this.skipWhitespaceAndNewline(); return '/=';
"="  this.skipWhitespaceAndNewline(); return '=';
">"  this.skipWhitespaceAndNewline(); return '>';
">=" this.skipWhitespaceAndNewline(); return '>=';
"|"  this.skipWhitespaceAndNewline(); return '|';
"&"  this.skipWhitespaceAndNewline(); return '&';
"#"  this.skipWhitespaceAndNewline(); return '#';

/*
 * For backward compatibility with ISO/IEC 8859-1
 * <https://en.wikipedia.org/wiki/ISO/IEC_8859-1> encoded files, the Csound
 * lexer began using the regex pattern \xC2?\xAC to match ¬ in commit a2adbcc
 * <https://github.com/csound/csound/commit/a2adbccac16e11062236f6dcdf982f4d289800f2>.
 * (UTF-8 encodes ¬ as the 2-byte sequence C2 A2, and ISO/IEC 8859-1 encodes ¬
 * as the single byte A2.) Strings in JavaScript are always Unicode, so just use
 * a literal ¬.
 */
[~¬] this.skipWhitespaceAndNewline(); return '~';

"if"       return 'IF';
"then"     return 'THEN';
"ithen"    return 'THEN';
"kthen"    return 'THEN';
"elseif"   return 'ELSEIF';
"else"     return 'ELSE';
"endif"    return 'ENDIF';
"fi"
%{
  this.messages.push({
    severity: 'warning',
    location: {
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `${this.quote(yytext)} instead of ${this.quote('endif')} used to end if statement`
  });
  return 'ENDIF';
%}
"until"    return 'UNTIL';
"while"    return 'WHILE';
"do"       return 'DO';
"od"       return 'OD';
"enduntil"
%{
  this.messages.push({
    severity: 'warning',
    location: {
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `${this.quote(yytext)} instead of ${this.quote('od')} used to end loop`
  });
  return 'OD';
%}

"goto"     return 'GOTO';
"igoto"    return 'GOTO';
"kgoto"    return 'GOTO';

^{optional_whitespace}\w+":"(?:{whitespace}|\n|$)
%{
  const labelName = this.nameFromLabel(yytext);
  const label = this.symbolTable.labels[labelName];
  if (label) {
    this.messages.push({
      severity: 'warning',
      location: {
        position: this.sourceMap.sourceRange([
          [yylloc.first_line - 1, yylloc.first_column],
          [yylloc.first_line - 1, yylloc.first_column + labelName.length]
        ])
      },
      excerpt: `Duplicate label ${this.quote(labelName)} ignored`,
      trace: [{
        severity: 'info',
        location: {
          position: label.range
        },
        excerpt: `Label ${this.quote(labelName)} is here`
      }]
    });
  } else {
    this.symbolTable.addLabel(labelName, this.sourceMap.sourceRange([
      [yylloc.first_line - 1, yylloc.first_column],
      [yylloc.first_line - 1, yylloc.first_column + labelName.length]
    ]));
  }
  return 'LABEL';
%}

"instr"
%{
  this.begin('after_instr_keyword');
  return 'INSTR';
%}
"endin" return 'ENDIN';

<after_instr_keyword>{decimal_integer}
%{
  this.popState();
  this.begin('after_instrument_number_or_identifier');
  return 'DECIMAL_INTEGER';
%}
<after_instr_keyword>{identifier}
%{
  this.popState();
  this.begin('after_instrument_number_or_identifier');
  return 'IDENTIFIER';
%}
<after_instr_keyword>"+"
%{
  this.popState();
  this.begin('after_instrument_plus_sign');
  return '+';
%}
<after_instr_keyword>.
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected instrument number or identifier'
  });
%}

<after_instrument_number_or_identifier>","
%{
  this.popState();
  this.begin('after_instr_keyword');
  this.skipWhitespaceAndNewline();
  return ',';
%}
<after_instrument_number_or_identifier>\n
%{
  this.popState();
  return 'NEWLINE';
%}
<after_instrument_number_or_identifier>[^,\n]
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected newline after instrument numbers and identifiers'
  });
%}

<after_instrument_plus_sign>{identifier}
%{
  this.popState();
  this.begin('after_instrument_number_or_identifier');
  return 'IDENTIFIER';
%}
<after_instrument_plus_sign>.
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected instrument identifier'
  });
%}

"opcode"
%{
  this.begin('after_opcode_keyword');
  return 'OPCODE';
%}
"endop" return 'ENDOP';

<after_opcode_keyword>{identifier}
%{
  this.popState();
  this.opcodeName = yytext;
  this.begin('after_opcode_name');
  return 'IDENTIFIER';
%}
<after_opcode_keyword>.
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected opcode name'
  });
%}

<after_opcode_name>","
%{
  this.popState();
  this.begin('before_opcode_output_type_signature');
  this.skipWhitespaceAndNewline();
  return ',';
%}
<after_opcode_name>[^,]
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected comma after opcode name'
  });
%}

/* https://csound.github.io/docs/manual/opcode.html */
<before_opcode_output_type_signature>"0"|(?:[aikftSK](?:\[\])*)+
%{
  this.popState();
  this.opcodeOutputTypeSignature = (yytext === '0') ? '' : yytext;
  this.begin('after_opcode_output_type_signature');
  return 'OPCODE_OUTPUT_TYPE_SIGNATURE';
%}
<before_opcode_output_type_signature>.
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected output type signature'
  });
%}

<after_opcode_output_type_signature>","
%{
  this.popState();
  this.begin('before_opcode_input_type_signature');
  this.skipWhitespaceAndNewline();
  return ',';
%}
<after_opcode_output_type_signature>[^,]
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected comma after output type signature'
  });
%}

/* https://csound.github.io/docs/manual/opcode.html */
<before_opcode_input_type_signature>"0"|(?:[aijkftKOJVPopS](?:\[\])*)+
%{
  this.popState();
  this.symbolTable.addOpcode(this.opcodeName, {[(yytext === '0') ? '' : yytext]: [this.opcodeOutputTypeSignature]});
  return 'OPCODE_INPUT_TYPE_SIGNATURE';
%}
<before_opcode_input_type_signature>.
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: 'Expected input type signature'
  });
%}

/* The Csound lexer does not emit integer tokens for hex integers. */
{hexadecimal_integer} return 'NUMBER';

{decimal_integer} return 'DECIMAL_INTEGER';

{decimal_number} return 'NUMBER';

"0dbfs"|"A4"|"k"(?:"r"|"smps")|"nchnls"(?:"_i")?|"sr" return 'GLOBAL_VALUE_IDENTIFIER';

{identifier}
%{
  const symbol = this.symbolTable.identifiers[yytext];
  if (symbol && symbol.kind === 'opcode') {
    if (symbol.isVoid)
      return 'VOID_OPCODE';

    const character = this.input();
    if (character === ':')
      this.begin('opcode_output_type_annotation');
    else
      this.unput(character);
    return 'OPCODE';
  }

  return 'IDENTIFIER';
%}

<opcode_output_type_annotation>[ak]
%{
  this.popState();
  return 'OPCODE_OUTPUT_TYPE_ANNOTATION';
%}
<opcode_output_type_annotation>[^ak]
%{
  throw new CsoundLexerError({
    severity: 'error',
    location: {
      position: this.rangeFromPosition(yylloc.first_line, yylloc.first_column)
    },
    excerpt: `Expected output type (${this.quote('a')} or ${this.quote('k')})`
  });
%}

\"(\\.|[^"])*\"|"{{"(?:[^}]|"}"[^}])*"}}" return 'STRING';

.
%{
  this.messages.push({
    severity: 'error',
    location: {
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `Unexpected character ${this.quote(yytext)}`
  });
%}

%%

lexer.nameFromLabel = label => label.trim().replace(/:$/, '');

lexer.quote = string => `‘${string}’`;

lexer.rangeFromLocation = (function(yylloc) {
  return [
    this.sourceMap.sourceLocation([yylloc.first_line - 1, yylloc.first_column]),
    this.sourceMap.sourceLocation([yylloc.last_line - 1, yylloc.last_column])
  ];
}).bind(lexer);

lexer.rangeFromPosition = (function(line, column) {
  const location = this.sourceMap.sourceLocation([line - 1, column]);
  return [location, location];
}).bind(lexer);

const original_setInput = lexer.setInput;
lexer.setInput = (function(input, yy) {
  if (yy && !yy.parser)
    return;
  this.messages = [];
  this.sourceMap = {
    sourceLocation: location => location,
    sourceRange: range => range
  };
  this.symbolTable = new this.SymbolTable();
  return original_setInput.apply(this, arguments);
}).bind(lexer);

lexer.skipWhitespaceAndNewline = (function() {
  for (let character = this.input(); character !== null; character = this.input()) {
    // This needs to be kept synchronized with the whitespace patterns.
    if (character !== ' ' && character !== '\t') {
      if (character !== '\n')
        this.unput(character);
      break;
    }
  }
}).bind(lexer);

class CsoundLexerError extends Error {
  constructor(lintMessage) {
    super(lintMessage.text);
    this.name = 'CsoundLexerError';
    this.lintMessage = lintMessage;
  }
}
