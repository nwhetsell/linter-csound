const csound = require('csound-api');
const dedent = require('dedent-js');
const path = require('path');

csound.SetDefaultMessageCallback(() => {});

const parser = require(path.join('..', 'orchestra-parser.js')).parser;
const lexer = parser.lexer;
lexer.SymbolTable = require(path.join('..', 'symbol-table.js'));

describe('Csound orchestra lexer', () => {
  it('is defined', () => {
    expect(lexer).toBeDefined();
  });

  function tokens(string) {
    const tokens = [];
    lexer.setInput(string);
    while (!lexer.done) {
      tokens.push(parser.terminals_[lexer.lex()]);
    }
    if (tokens[tokens.length - 1] === 'EOF')
      tokens.pop();
    if (tokens[tokens.length - 1] === 'NEWLINE')
      tokens.pop();
    return tokens;
  }

  // The tests of expressions are based on tests in
  // https://github.com/python/cpython/blob/master/Lib/test/test_grammar.py
  // and
  // https://github.com/python/cpython/blob/master/Lib/test/test_tokenize.py.

  it('lexes numbers', () => {
    expect(tokens('3.14159')).toEqual(['NUMBER']);
    expect(tokens('314159.')).toEqual(['NUMBER']);
    expect(tokens('.314159')).toEqual(['NUMBER']);
    expect(tokens('3e14159')).toEqual(['NUMBER']);
    expect(tokens('3e-1415')).toEqual(['NUMBER']);
    expect(tokens('3.14e15')).toEqual(['NUMBER']);
  });

  it('lexes strings', () => {
    expect(tokens('"" {{}}')).toEqual(['STRING', 'STRING']);
    expect(tokens('"{{\\"" {{"}}')).toEqual(['STRING', 'STRING']);
    expect(tokens('{{\n}}')).toEqual(['STRING']);
  });

  // https://github.com/csound/csound/issues/661
  it('lexes quoted string ending with escaped backslash', () => {
    expect(tokens('"x\\\\"')).toEqual(['STRING']);
  });

  it('lexes unary expressions', () => {
    expect(tokens('+1')).toEqual(['+', 'DECIMAL_INTEGER']);
    expect(tokens('-1')).toEqual(['-', 'DECIMAL_INTEGER']);
    expect(tokens('!1')).toEqual(['!', 'DECIMAL_INTEGER']);
    expect(tokens('~1')).toEqual(['~', 'DECIMAL_INTEGER']);
    expect(tokens('¬1')).toEqual(['~', 'DECIMAL_INTEGER']);
    expect(tokens('iValue = +-!~1')).toEqual(['IDENTIFIER', '=', '+', '-', '!', '~', 'DECIMAL_INTEGER']);
  });

  it('lexes multiplicative expressions', () => {
    expect(tokens('1 * 1')).toEqual(['DECIMAL_INTEGER', '*', 'DECIMAL_INTEGER']);
    expect(tokens('1 / 1')).toEqual(['DECIMAL_INTEGER', '/', 'DECIMAL_INTEGER']);
    expect(tokens('1 % 1')).toEqual(['DECIMAL_INTEGER', '%', 'DECIMAL_INTEGER']);
    expect(tokens('1 ^ 1')).toEqual(['DECIMAL_INTEGER', '^', 'DECIMAL_INTEGER']);
    expect(tokens('iValue = 1*1/1^5%0x12')).toEqual(['IDENTIFIER', '=', 'DECIMAL_INTEGER', '*', 'DECIMAL_INTEGER', '/', 'DECIMAL_INTEGER', '^', 'DECIMAL_INTEGER', '%', 'NUMBER']);
  });

  it('lexes additive expressions', () => {
    expect(tokens('1 + 1')).toEqual(['DECIMAL_INTEGER', '+', 'DECIMAL_INTEGER']);
    expect(tokens('1 - 1 - 1')).toEqual(['DECIMAL_INTEGER', '-', 'DECIMAL_INTEGER', '-', 'DECIMAL_INTEGER']);
    expect(tokens('i1 = 1 - i2 + 15 - 1 + 0x124 + i3 + i4[5]')).toEqual(['IDENTIFIER', '=', 'DECIMAL_INTEGER', '-', 'IDENTIFIER', '+', 'DECIMAL_INTEGER', '-', 'DECIMAL_INTEGER', '+', 'NUMBER', '+', 'IDENTIFIER', '+', 'IDENTIFIER', '[', 'DECIMAL_INTEGER', ']']);
  });

  it('lexes shift expressions', () => {
    expect(tokens('1 << 1')).toEqual(['DECIMAL_INTEGER', '<<', 'DECIMAL_INTEGER']);
    expect(tokens('1 >> 1')).toEqual(['DECIMAL_INTEGER', '>>', 'DECIMAL_INTEGER']);
    expect(tokens('iValue = 1 << 1 >> 5')).toEqual(['IDENTIFIER', '=', 'DECIMAL_INTEGER', '<<', 'DECIMAL_INTEGER', '>>', 'DECIMAL_INTEGER']);
  });

  it('lexes bitwise expressions', () => {
    expect(tokens('1 & 1')).toEqual(['DECIMAL_INTEGER', '&', 'DECIMAL_INTEGER']);
    expect(tokens('1 # 1')).toEqual(['DECIMAL_INTEGER', '#', 'DECIMAL_INTEGER']);
    expect(tokens('1 | 1')).toEqual(['DECIMAL_INTEGER', '|', 'DECIMAL_INTEGER']);
    expect(tokens('~1 # 1 & 1 |1 # ¬0x1')).toEqual(['~', 'DECIMAL_INTEGER', '#', 'DECIMAL_INTEGER', '&', 'DECIMAL_INTEGER', '|', 'DECIMAL_INTEGER', '#', '~', 'NUMBER']);
  });

  it('lexes comparison expressions', () => {
    expect(tokens('1 == 1')).toEqual(['DECIMAL_INTEGER', '==', 'DECIMAL_INTEGER']);
    expect(tokens('1 != 1')).toEqual(['DECIMAL_INTEGER', '!=', 'DECIMAL_INTEGER']);
    expect(tokens('1 < 1')).toEqual(['DECIMAL_INTEGER', '<', 'DECIMAL_INTEGER']);
    expect(tokens('1 > 1')).toEqual(['DECIMAL_INTEGER', '>', 'DECIMAL_INTEGER']);
    expect(tokens('1 <= 1')).toEqual(['DECIMAL_INTEGER', '<=', 'DECIMAL_INTEGER']);
    expect(tokens('1 >= 1')).toEqual(['DECIMAL_INTEGER', '>=', 'DECIMAL_INTEGER']);
    expect(tokens('1 && 1')).toEqual(['DECIMAL_INTEGER', '&&', 'DECIMAL_INTEGER']);
    expect(tokens('1 || 1')).toEqual(['DECIMAL_INTEGER', '||', 'DECIMAL_INTEGER']);
    expect(tokens('1 < 1 > 1 == 1 >= 5 <= 0x15 != 1 && 1 || 1')).toEqual(['DECIMAL_INTEGER', '<', 'DECIMAL_INTEGER', '>', 'DECIMAL_INTEGER', '==', 'DECIMAL_INTEGER', '>=', 'DECIMAL_INTEGER', '<=', 'NUMBER', '!=', 'DECIMAL_INTEGER', '&&', 'DECIMAL_INTEGER', '||', 'DECIMAL_INTEGER']);
  });

  it('lexes assignment expressions', () => {
    expect(tokens('iValue = 1')).toEqual(['IDENTIFIER', '=', 'DECIMAL_INTEGER']);
    expect(tokens('iValue += 1')).toEqual(['IDENTIFIER', '+=', 'DECIMAL_INTEGER']);
    expect(tokens('iValue -= 1')).toEqual(['IDENTIFIER', '-=', 'DECIMAL_INTEGER']);
    expect(tokens('iValue *= 1')).toEqual(['IDENTIFIER', '*=', 'DECIMAL_INTEGER']);
    expect(tokens('iValue /= 1')).toEqual(['IDENTIFIER', '/=', 'DECIMAL_INTEGER']);
  });

  it('lexes conditional expression', () => {
    expect(tokens('label: 0 == 1 ? 0 : 1')).toEqual(['LABEL', 'DECIMAL_INTEGER', '==', 'DECIMAL_INTEGER', '?', 'DECIMAL_INTEGER', ':', 'DECIMAL_INTEGER']);
  });

  it('lexes keywords', () => {
    expect(tokens('do')).toEqual(['DO']);
    expect(tokens('else')).toEqual(['ELSE']);
    expect(tokens('elseif')).toEqual(['ELSEIF']);
    expect(tokens('endif')).toEqual(['ENDIF']);
    expect(tokens('endin')).toEqual(['ENDIN']);
    expect(tokens('enduntil')).toEqual(['OD']);
    expect(tokens('fi')).toEqual(['ENDIF']);
    expect(tokens('goto')).toEqual(['GOTO']);
    expect(tokens('if')).toEqual(['IF']);
    expect(tokens('igoto')).toEqual(['GOTO']);
    expect(tokens('ithen')).toEqual(['THEN']);
    expect(tokens('kgoto')).toEqual(['GOTO']);
    expect(tokens('kthen')).toEqual(['THEN']);
    expect(tokens('od')).toEqual(['OD']);
    expect(tokens('then')).toEqual(['THEN']);
    expect(tokens('until')).toEqual(['UNTIL']);
    expect(tokens('while')).toEqual(['WHILE']);
  });

  it('warns about ‘fi’ ending if statement', () => {
    expect(tokens('if 1 == 1 then\nfi')).toEqual(['IF', 'DECIMAL_INTEGER', '==', 'DECIMAL_INTEGER', 'THEN', 'NEWLINE', 'ENDIF']);
    expect(lexer.messages.length).toBe(1);
    expect(lexer.messages[0]).toEqual({
      severity: 'warning',
      location: {
        position: [[1, 0], [1, 2]]
      },
      excerpt: '‘fi’ instead of ‘endif’ used to end if statement'
    });
  });

  it('warns about ‘enduntil’ ending loop', () => {
    expect(tokens('while 1 == 1 do\nenduntil')).toEqual(['WHILE', 'DECIMAL_INTEGER', '==', 'DECIMAL_INTEGER', 'DO', 'NEWLINE', 'OD']);
    expect(lexer.messages.length).toBe(1);
    expect(lexer.messages[0]).toEqual({
      severity: 'warning',
      location: {
        position: [[1, 0], [1, 8]]
      },
      excerpt: '‘enduntil’ instead of ‘od’ used to end loop'
    });
  });

  it('lexes labeled statements', () => {
    const labelName = 'label';
    expect(tokens(`${labelName}:`)).toEqual(['LABEL']);
    expect(lexer.globalSymbolTable.labels[labelName]).toBeDefined();
    expect(tokens('label:\n0dbfs = 1')).toEqual(['LABEL', 'GLOBAL_VALUE_IDENTIFIER', '=', 'DECIMAL_INTEGER']);
    // https://github.com/csound/csound/issues/670
    expect(tokens('label: 0dbfs = 1')).toEqual(['LABEL', 'GLOBAL_VALUE_IDENTIFIER', '=', 'DECIMAL_INTEGER']);
  });

  it('warns about duplicate label', () => {
    expect(tokens('label:\nlabel:')).toEqual(['LABEL', 'LABEL']);
    expect(lexer.messages.length).toBe(1);
    expect(lexer.messages[0]).toEqual({
      severity: 'warning',
      location: {
        position: [[1, 0], [1, 5]]
      },
      excerpt: 'Duplicate label ‘label’ ignored',
      trace: [{
        severity: 'info',
        location: {
          position: [[0, 0], [0, 5]]
        },
        excerpt: 'Label ‘label’ is here'
      }]
    });
  });

  it('lexes instrument definition', () => {
    expect(tokens(`
      instr 1 , name_1 , +name_2
      endin
    `)).toEqual(['NEWLINE', 'INSTR', 'DECIMAL_INTEGER', ',', 'IDENTIFIER', ',', '+', 'IDENTIFIER', 'NEWLINE', 'ENDIN', 'NEWLINE']);
    expect(lexer.messages.length).toBe(0);
  });

  it('lexes unexpected character after instr keyword', () => {
    try {
      tokens('instr ?\nendin');
      fail('Expected exception.');
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: 'error',
        location: {
          position: [[0, 6], [0, 6]]
        },
        excerpt: 'Expected instrument number or identifier'
      });
    }
  });

  it('lexes opcode definition', () => {
    const opcodeName = 'name_0';
    expect(tokens(dedent`
      opcode ${opcodeName} , ai[]k[] , 0
      endop
    `)).toEqual(['OPCODE', 'IDENTIFIER', ',', 'OPCODE_OUTPUT_TYPE_SIGNATURE', ',', 'OPCODE_INPUT_TYPE_SIGNATURE', 'NEWLINE', 'ENDOP']);
    expect(lexer.messages.length).toBe(0);
    expect(lexer.globalSymbolTable.identifiers[opcodeName]).toBeDefined();
  });

  it('lexes global value identifiers', () => {
    expect(tokens('0dbfs')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
    expect(tokens('A4')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
    expect(tokens('kr')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
    expect(tokens('ksmps')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
    expect(tokens('nchnls')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
    expect(tokens('nchnls_i')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
    expect(tokens('sr')).toEqual(['GLOBAL_VALUE_IDENTIFIER']);
  });

  it('lexes orchestra', () => {
    expect(tokens(dedent`
      0dbfs = 1
      giFunctionTableID ftgen 0, 0, 16384, 10, 1
      instr A440
        outc oscili(0.5 * 0dbfs, 440, giFunctionTableID)
      endin
    `)).toEqual([
      'GLOBAL_VALUE_IDENTIFIER', '=', 'DECIMAL_INTEGER', 'NEWLINE',
      'IDENTIFIER', 'OPCODE', 'DECIMAL_INTEGER', ',', 'DECIMAL_INTEGER', ',', 'DECIMAL_INTEGER', ',', 'DECIMAL_INTEGER', ',', 'DECIMAL_INTEGER', 'NEWLINE',
      'INSTR', 'IDENTIFIER', 'NEWLINE',
      'VOID_OPCODE', 'WHITESPACE', 'OPCODE', '(', 'NUMBER', '*', 'GLOBAL_VALUE_IDENTIFIER', ',', 'DECIMAL_INTEGER', ',', 'IDENTIFIER', ')', 'NEWLINE',
      'ENDIN'
    ]);
  });

  // https://github.com/csound/csound/issues/649
  it('lexes unexpected characters', () => {
    expect(tokens(dedent`
      instr 1
        prints "hello, world\n"
        \`@.\\$•🎹
      endin
    `)).toEqual(['INSTR', 'DECIMAL_INTEGER', 'NEWLINE', 'VOID_OPCODE', 'WHITESPACE', 'STRING', 'NEWLINE', 'NEWLINE', 'ENDIN']);
    expect(lexer.messages.length).toBe(8);
    expect(lexer.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[3, 2], [3, 3]]
      },
      excerpt: 'Unexpected character ‘`’'
    });
  });
});
