const csound = require('csound-api');
const dedent = require('dedent-js');
const path = require('path');

csound.SetDefaultMessageCallback(() => {});

const CsoundOrchestraParser = require(path.join('..', 'orchestra-parser.js')).Parser;
const SymbolTable = require(path.join('..', 'symbol-table.js'));

describe('Csound orchestra parser', () => {
  let parser;
  beforeEach(() => {
    parser = new CsoundOrchestraParser();
    parser.__lexer__ = parser.lexer;
    parser.lexer.SymbolTable = SymbolTable;
  });

  // The tests of expressions are based on tests in
  // https://github.com/python/cpython/blob/master/Lib/test/test_tokenize.py.

  function parseArithmeticExpression(string) { return parser.parse(`${string}\n`).children[0].children[1]; }
  function parseBooleanExpression(string) { return parser.parse(`${string} then\nendif\n`).children[0].children[0]; }

  it('parses ‘1’', () => {
    expect(parseArithmeticExpression('iValue = 1')).toEqual(
      new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses ‘1 + 1’', () => {
    expect(parseArithmeticExpression('iValue = 1 + 1')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 14]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
        new parser.Plus([[0, 11], [0, 12]], {string: '+'}),
        new parser.NumberLiteral([[0, 13], [0, 14]], {string: '1'})
      ]})
    );
  });

  it('parses ‘0xff <= 255’', () => {
    expect(parseBooleanExpression('if 0xff <= 255')).toEqual(
      new parser.BinaryOperation([[0, 3], [0, 14]], {children: [
        new parser.NumberLiteral([[0, 3], [0, 7]], {string: '0xff'}),
        new parser.LessThanOrEqual([[0, 8], [0, 10]], {string: '<='}),
        new parser.NumberLiteral([[0, 11], [0, 14]], {string: '255'})
      ]})
    );
  });
  it('parses ‘1234567 > ~0x15’', () => {
    expect(parseBooleanExpression('if 1234567 > ~0x15')).toEqual(
      new parser.BinaryOperation([[0, 3], [0, 18]], {children: [
        new parser.NumberLiteral([[0, 3], [0, 10]], {string: '1234567'}),
        new parser.GreaterThan([[0, 11], [0, 12]], {string: '>'}),
        new parser.UnaryOperation([[0, 13], [0, 18]], {children: [
          new parser.BitwiseComplement([[0, 13], [0, 14]], {string: '~'}),
          new parser.NumberLiteral([[0, 14], [0, 18]], {string: '0x15'})
        ]})
      ]})
    );
  });
  it('parses ‘2134568 != 1231515’', () => {
    expect(parseBooleanExpression('if 2134568 != 1231515')).toEqual(
      new parser.BinaryOperation([[0, 3], [0, 21]], {children: [
        new parser.NumberLiteral([[0, 3], [0, 10]], {string: '2134568'}),
        new parser.NotEqual([[0, 11], [0, 13]], {string: '!='}),
        new parser.NumberLiteral([[0, 14], [0, 21]], {string: '1231515'}),
      ]})
    );
  });
  it('parses ‘(-124561-1) & 200000000’', () => {
    expect(parseArithmeticExpression('iValue = (-124561-1) & 200000000')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 32]], {children: [
        new parser.BinaryOperation([[0, 10], [0, 19]], {children: [
          new parser.UnaryOperation([[0, 10], [0, 17]], {children: [
            new parser.UnaryMinus([[0, 10], [0, 11]], {string: '-'}),
            new parser.NumberLiteral([[0, 11], [0, 17]], {string: '124561'})
          ]}),
          new parser.Minus([[0, 17], [0, 18]], {string: '-'}),
          new parser.NumberLiteral([[0, 18], [0, 19]], {string: '1'})
        ]}),
        new parser.BitwiseAND([[0, 21], [0, 22]], {string: '&'}),
        new parser.NumberLiteral([[0, 23], [0, 32]], {string: '200000000'}),
      ]})
    );
  });
  it('parses ‘0xFF & 0x15 | 1234’', () => {
    expect(parseArithmeticExpression('iValue = 0xFF & 0x15 | 1234')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 27]], {children: [
        new parser.BinaryOperation([[0, 9], [0, 20]], {children: [
          new parser.NumberLiteral([[0, 9], [0, 13]], {string: '0xFF'}),
          new parser.BitwiseAND([[0, 14], [0, 15]], {string: '&'}),
          new parser.NumberLiteral([[0, 16], [0, 20]], {string: '0x15'})
        ]}),
        new parser.BitwiseOR([[0, 21], [0, 22]], {string: '|'}),
        new parser.NumberLiteral([[0, 23], [0, 27]], {string: '1234'}),
      ]})
    );
  });

  it('parses void opcode statements', () => {
    expect(parser.parse(dedent`
      scoreline_i "e"
      printf_i("\\n==> %d\\n\\n", 1, 42)
    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.VoidOpcodeStatement([[0, 0], [1, 0]], {children: [
          new parser.OpcodeExpression([[0, 0], [0, 15]], {children: [
            new parser.Identifier([[0, 0], [0, 11]], {string: 'scoreline_i'}),
            new parser.InputArgumentList([[0, 12], [0, 15]], {children: [
              new parser.StringLiteral([[0, 12], [0, 15]], {string: '"e"'})
            ]})
          ]})
        ]}),
        // https://github.com/nwhetsell/linter-csound/issues/6
        new parser.VoidOpcodeStatement([[1, 0], [2, 0]], {children: [
          new parser.OpcodeExpression([[1, 0], [1, 31]], {children: [
            new parser.Identifier([[1, 0], [1, 8]], {string: 'printf_i'}),
            new parser.InputArgumentList([[1, 9], [1, 30]], {children: [
              new parser.StringLiteral([[1, 9], [1, 23]], {string: '"\\n==> %d\\n\\n"'}),
              new parser.NumberLiteral([[1, 25], [1, 26]], {string: '1'}),
              new parser.NumberLiteral([[1, 28], [1, 30]], {string: '42'})
            ]})
          ]})
        ]})
      ]})
    );
  });

  it('parses void opcode with no inputs', () => {
    expect(parser.parse(dedent`
      opcode anOpcode, 0, 0
      endop
      anOpcode
    `)).toEqual(
      new parser.Orchestra([[0, 0], [3, 0]], {children: [
        new parser.Opcode([[0, 0], [2, 0]], {children: [
          new parser.Identifier([[0, 7], [0, 15]], {string: 'anOpcode'}),
          new parser.OpcodeOutputTypeSignature([[0, 17], [0, 18]], {string: '0'}),
          new parser.OpcodeInputTypeSignature([[0, 20], [0, 21]], {string: '0'})
        ]}),
        new parser.VoidOpcodeStatement([[2, 0], [3, 0]], {children: [
          new parser.OpcodeExpression([[2, 0], [2, 8]], {children: [
            new parser.Identifier([[2, 0], [2, 8]], {string: 'anOpcode'})
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses array declarations and member assignments', () => {
    expect(parser.parse(dedent`
      iArray1[] init 1
      iArray1[0] = 0
      iArray2[][] init 1, 1
      iArray2[0][0 == 1 ? 0 : 0] = 0

    `)).toEqual(
      new parser.Orchestra([[0, 0], [4, 0]], {children: [
        new parser.OpcodeStatement([[0, 0], [1, 0]], {children: [
          new parser.OutputArgumentList([[0, 0], [0, 9]], {children: [
            new parser.ArrayDeclarator([[0, 0], [0, 9]], {children: [
              new parser.Identifier([[0, 0], [0, 7]], {string: 'iArray1', type: 'i[]'})
            ]})
          ]}),
          new parser.OpcodeExpression([[0, 10], [0, 16]], {children: [
            new parser.Identifier([[0, 10], [0, 14]], {string: 'init'}),
            new parser.InputArgumentList([[0, 15], [0, 16]], {children: [
              new parser.NumberLiteral([[0, 15], [0, 16]], {string: '1'})
            ]})
          ]})
        ]}),
        new parser.Assignment([[1, 0], [2, 0]], {children: [
          new parser.ArrayMember([[1, 0], [1, 10]], {children: [
            new parser.Identifier([[1, 0], [1, 7]], {string: 'iArray1', type: 'i[]'}),
            new parser.NumberLiteral([[1, 8], [1, 9]], {string: '0'})
          ]}),
          new parser.NumberLiteral([[1, 13], [1, 14]], {string: '0'})
        ]}),
        new parser.OpcodeStatement([[2, 0], [3, 0]], {children: [
          new parser.OutputArgumentList([[2, 0], [2, 11]], {children: [
            new parser.ArrayDeclarator([[2, 0], [2, 11]], {children: [
              new parser.ArrayDeclarator([[2, 0], [2, 9]], {children: [
                new parser.Identifier([[2, 0], [2, 7]], {string: 'iArray2', type: 'i[][]'})
              ]})
            ]})
          ]}),
          new parser.OpcodeExpression([[2, 12], [2, 21]], {children: [
            new parser.Identifier([[2, 12], [2, 16]], {string: 'init'}),
            new parser.InputArgumentList([[2, 17], [2, 21]], {children: [
              new parser.NumberLiteral([[2, 17], [2, 18]], {string: '1'}),
              new parser.NumberLiteral([[2, 20], [2, 21]], {string: '1'})
            ]})
          ]})
        ]}),
        new parser.Assignment([[3, 0], [4, 0]], {children: [
          new parser.ArrayMember([[3, 0], [3, 26]], {children: [
            new parser.ArrayMember([[3, 0], [3, 10]], {children: [
              new parser.Identifier([[3, 0], [3, 7]], {string: 'iArray2', type: 'i[][]'}),
              new parser.NumberLiteral([[3, 8], [3, 9]], {string: '0'})
            ]}),
            // Csound doesn’t actually allow conditional expressions as array
            // member expressions.
            new parser.ConditionalExpression([[3, 11], [3, 25]], {children: [
              new parser.BinaryOperation([[3, 11], [3, 17]], {children: [
                new parser.NumberLiteral([[3, 11], [3, 12]], {string: '0'}),
                new parser.Equal([[3, 13], [3, 15]], {string: '=='}),
                new parser.NumberLiteral([[3, 16], [3, 17]], {string: '1'}),
              ]}),
              new parser.NumberLiteral([[3, 20], [3, 21]], {string: '0'}),
              new parser.NumberLiteral([[3, 24], [3, 25]], {string: '0'})
            ]})
          ]}),
          new parser.NumberLiteral([[3, 29], [3, 30]], {string: '0'})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  // https://github.com/nwhetsell/linter-csound/issues/6
  it('parses array assignments', () => {
    expect(parser.parse(dedent`
      giArray[] fillarray 1, 2
      iArray[] = giArray

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.OpcodeStatement([[0, 0], [1, 0]], {children: [
          new parser.OutputArgumentList([[0, 0], [0, 9]], {children: [
            new parser.ArrayDeclarator([[0, 0], [0, 9]], {children: [
              new parser.Identifier([[0, 0], [0, 7]], {string: 'giArray', type: 'i[]'})
            ]})
          ]}),
          new parser.OpcodeExpression([[0, 10], [0, 24]], {children: [
            new parser.Identifier([[0, 10], [0, 19]], {string: 'fillarray'}),
            new parser.InputArgumentList([[0, 20], [0, 24]], {children: [
              new parser.NumberLiteral([[0, 20], [0, 21]], {string: '1'}),
              new parser.NumberLiteral([[0, 23], [0, 24]], {string: '2'})
            ]})
          ]})
        ]}),
        new parser.Assignment([[1, 0], [2, 0]], {children: [
          new parser.ArrayDeclarator([[1, 0], [1, 8]], {children: [
            new parser.Identifier([[1, 0], [1, 6]], {string: 'iArray', type: 'i[]'})
          ]}),
          new parser.Identifier([[1, 11], [1, 18]], {string: 'giArray', type: 'i[]'})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses if-goto', () => {
    expect(parser.parse(dedent`
      if 1 == 1 goto label
      label:

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.If([[0, 0], [1, 0]], {children: [
          new parser.BinaryOperation([[0, 3], [0, 9]], {children: [
            new parser.NumberLiteral([[0, 3], [0, 4]], {string: '1'}),
            new parser.Equal([[0, 5], [0, 7]], {string: '=='}),
            new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
          ]}),
          new parser.Goto([[0, 10], [1, 0]], {children: [
            new parser.Identifier([[0, 15], [0, 20]], {string: 'label'})
          ]})
        ]}),
        new parser.LabeledStatement([[1, 0], [2, 0]], {children: [
          new parser.Label([[1, 0], [1, 6]], {string: 'label:'})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses if-then', () => {
    expect(parser.parse(dedent`
      if 1 == 1 then
      endif

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.If([[0, 0], [2, 0]], {children: [
          new parser.BinaryOperation([[0, 3], [0, 9]], {children: [
            new parser.NumberLiteral([[0, 3], [0, 4]], {string: '1'}),
            new parser.Equal([[0, 5], [0, 7]], {string: '=='}),
            new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
          ]}),
          new parser.Then([[0, 10], [1, 0]])
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses if-then with logical expression', () => {
    expect(parser.parse(dedent`
      if 1 == 1 || 2 == 2 then
      endif

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.If([[0, 0], [2, 0]], {children: [
          new parser.BinaryOperation([[0, 3], [0, 19]], {children: [
            new parser.BinaryOperation([[0, 3], [0, 9]], {children: [
              new parser.NumberLiteral([[0, 3], [0, 4]], {string: '1'}),
              new parser.Equal([[0, 5], [0, 7]], {string: '=='}),
              new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
            ]}),
            new parser.Or([[0, 10], [0, 12]], {string: '||'}),
            new parser.BinaryOperation([[0, 13], [0, 19]], {children: [
              new parser.NumberLiteral([[0, 13], [0, 14]], {string: '2'}),
              new parser.Equal([[0, 15], [0, 17]], {string: '=='}),
              new parser.NumberLiteral([[0, 18], [0, 19]], {string: '2'})
            ]})
          ]}),
          new parser.Then([[0, 20], [1, 0]])
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses if-then-else', () => {
    expect(parser.parse(dedent`
      if 1 == 1 then
      else
      endif

    `)).toEqual(
      new parser.Orchestra([[0, 0], [3, 0]], {children: [
        new parser.If([[0, 0], [3, 0]], {children: [
          new parser.BinaryOperation([[0, 3], [0, 9]], {children: [
            new parser.NumberLiteral([[0, 3], [0, 4]], {string: '1'}),
            new parser.Equal([[0, 5], [0, 7]], {string: '=='}),
            new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
          ]}),
          new parser.Then([[0, 10], [1, 0]]),
          new parser.Else([[1, 0], [2, 0]], {children: [
            new parser.Empty([[1, 4], [2, 0]])
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses if-then-elseif', () => {
    expect(parser.parse(dedent`
      if 1 == 1 then
      elseif 2 == 2 then
      elseif 3 != 3 then
      endif

    `)).toEqual(
      new parser.Orchestra([[0, 0], [4, 0]], {children: [
        new parser.If([[0, 0], [4, 0]], {children: [
          new parser.BinaryOperation([[0, 3], [0, 9]], {children: [
            new parser.NumberLiteral([[0, 3], [0, 4]], {string: '1'}),
            new parser.Equal([[0, 5], [0, 7]], {string: '=='}),
            new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
          ]}),
          new parser.Then([[0, 10], [1, 0]]),
          new parser.Else([[1, 0], [3, 0]], {children: [
            new parser.If([[1, 0], [2, 0]], {children: [
              new parser.BinaryOperation([[1, 7], [1, 13]], {children: [
                new parser.NumberLiteral([[1, 7], [1, 8]], {string: '2'}),
                new parser.Equal([[1, 9], [1, 11]], {string: '=='}),
                new parser.NumberLiteral([[1, 12], [1, 13]], {string: '2'})
              ]}),
              new parser.Then([[1, 14], [2, 0]]),
              new parser.Else([[2, 0], [3, 0]], {children: [
                new parser.If([[2, 0], [3, 0]], {children: [
                  new parser.BinaryOperation([[2, 7], [2, 13]], {children: [
                    new parser.NumberLiteral([[2, 7], [2, 8]], {string: '3'}),
                    new parser.NotEqual([[2, 9], [2, 11]], {string: '!='}),
                    new parser.NumberLiteral([[2, 12], [2, 13]], {string: '3'})
                  ]}),
                  new parser.Then([[2, 14], [3, 0]])
                ]})
              ]})
            ]})
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses if-then-elseif-else', () => {
    expect(parser.parse(dedent`
      if 1 == 1 then
      elseif 2 == 2 then
      else
      endif

    `)).toEqual(
      new parser.Orchestra([[0, 0], [4, 0]], {children: [
        new parser.If([[0, 0], [4, 0]], {children: [
          new parser.BinaryOperation([[0, 3], [0, 9]], {children: [
            new parser.NumberLiteral([[0, 3], [0, 4]], {string: '1'}),
            new parser.Equal([[0, 5], [0, 7]], {string: '=='}),
            new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
          ]}),
          new parser.Then([[0, 10], [1, 0]]),
          new parser.Else([[1, 0], [3, 0]], {children: [
            new parser.If([[1, 0], [2, 0]], {children: [
              new parser.BinaryOperation([[1, 7], [1, 13]], {children: [
                new parser.NumberLiteral([[1, 7], [1, 8]], {string: '2'}),
                new parser.Equal([[1, 9], [1, 11]], {string: '=='}),
                new parser.NumberLiteral([[1, 12], [1, 13]], {string: '2'})
              ]}),
              new parser.Then([[1, 14], [2, 0]]),
              new parser.Else([[2, 0], [3, 0]], {children: [
                new parser.Empty([[2, 4], [3, 0]])
              ]})
            ]})
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses while', () => {
    expect(parser.parse(dedent`
      while 0 == 1 do
      od

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.While([[0, 0], [1, 2]], {children: [
          new parser.BinaryOperation([[0, 6], [0, 12]], {children: [
            new parser.NumberLiteral([[0, 6], [0, 7]], {string: '0'}),
            new parser.Equal([[0, 8], [0, 10]], {string: '=='}),
            new parser.NumberLiteral([[0, 11], [0, 12]], {string: '1'})
          ]}),
          new parser.Do([[0, 13], [1, 0]], {children: [
            new parser.Empty([[0, 15], [1, 0]])
          ]})
        ]}),
        new parser.Empty([[1, 2], [2, 0]])
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses until', () => {
    expect(parser.parse(dedent`
      until 1 == 1 do
      od

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.Until([[0, 0], [1, 2]], {children: [
          new parser.BinaryOperation([[0, 6], [0, 12]], {children: [
            new parser.NumberLiteral([[0, 6], [0, 7]], {string: '1'}),
            new parser.Equal([[0, 8], [0, 10]], {string: '=='}),
            new parser.NumberLiteral([[0, 11], [0, 12]], {string: '1'})
          ]}),
          new parser.Do([[0, 13], [1, 0]], {children: [
            new parser.Empty([[0, 15], [1, 0]])
          ]})
        ]}),
        new parser.Empty([[1, 2], [2, 0]])
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses instrument', () => {
    expect(parser.parse(dedent`
      instr 1, N_a_M_e_1, +N_a_M_e_2
      endin

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.Instrument([[0, 0], [2, 0]], {children: [
          new parser.InstrumentNumberAndNameList([[0, 6], [0, 30]], {children: [
            new parser.NumberLiteral([[0, 6], [0, 7]], {string: '1'}),
            new parser.Identifier([[0, 9], [0, 18]], {string: 'N_a_M_e_1'}),
            new parser.UnaryOperation([[0, 20], [0, 30]], {children: [
              new parser.UnaryPlus([[0, 20], [0, 21]]),
              new parser.Identifier([[0, 21], [0, 30]], {string: 'N_a_M_e_2'})
            ]})
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses opcode definition', () => {
    expect(parser.parse(dedent`
      opcode anOpcode, a, k
      endop

    `)).toEqual(
      new parser.Orchestra([[0, 0], [2, 0]], {children: [
        new parser.Opcode([[0, 0], [2, 0]], {children: [
          new parser.Identifier([[0, 7], [0, 15]], {string: 'anOpcode'}),
          new parser.OpcodeOutputTypeSignature([[0, 17], [0, 18]], {string: 'a'}),
          new parser.OpcodeInputTypeSignature([[0, 20], [0, 21]], {string: 'k'})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses orchestra', () => {
    expect(parser.parse(dedent`
      0dbfs = 1
      giFunctionTableID ftgen 0, 0, 16384, 10, 1
      instr A440
        outc oscili(0.5 * 0dbfs, 440, giFunctionTableID)
      endin

    `)).toEqual(
      new parser.Orchestra([[0, 0], [5, 0]], {children: [
        new parser.Assignment([[0, 0], [1, 0]], {children: [
          new parser.Identifier([[0, 0], [0, 5]], {string: '0dbfs', type: 'i'}),
          new parser.NumberLiteral([[0, 8], [0, 9]], {string: '1'})
        ]}),
        new parser.OpcodeStatement([[1, 0], [2, 0]], {children: [
          new parser.OutputArgumentList([[1, 0], [1, 17]], {children: [
            new parser.Identifier([[1, 0], [1, 17]], {string: 'giFunctionTableID', type: 'i'})
          ]}),
          new parser.OpcodeExpression([[1, 18], [1, 42]], {children: [
            new parser.Identifier([[1, 18], [1, 23]], {string: 'ftgen'}),
            new parser.InputArgumentList([[1, 24], [1, 42]], {children: [
              new parser.NumberLiteral([[1, 24], [1, 25]], {string: '0'}),
              new parser.NumberLiteral([[1, 27], [1, 28]], {string: '0'}),
              new parser.NumberLiteral([[1, 30], [1, 35]], {string: '16384'}),
              new parser.NumberLiteral([[1, 37], [1, 39]], {string: '10'}),
              new parser.NumberLiteral([[1, 41], [1, 42]], {string: '1'})
            ]})
          ]})
        ]}),
        new parser.Instrument([[2, 0], [5, 0]], {children: [
          new parser.InstrumentNumberAndNameList([[2, 6], [2, 10]], {children: [
            new parser.Identifier([[2, 6], [2, 10]], {string: 'A440'})
          ]}),
          new parser.VoidOpcodeStatement([[3, 2], [4, 0]], {children: [
            new parser.OpcodeExpression([[3, 2], [3, 50]], {children: [
              new parser.Identifier([[3, 2], [3, 6]], {string: 'outc'}),
              new parser.InputArgumentList([[3, 7], [3, 50]], {children: [
                new parser.OpcodeExpression([[3, 7], [3, 50]], {children: [
                  new parser.Identifier([[3, 7], [3, 13]], {string: 'oscili'}),
                  new parser.InputArgumentList([[3, 14], [3, 49]], {children: [
                    new parser.BinaryOperation([[3, 14], [3, 25]], {children: [
                      new parser.NumberLiteral([[3, 14], [3, 17]], {string: '0.5'}),
                      new parser.Multiplication([[3, 18], [3, 19]], {string: '*'}),
                      new parser.Identifier([[3, 20], [3, 25]], {string: '0dbfs', type: 'i'})
                    ]}),
                    new parser.NumberLiteral([[3, 27], [3, 30]], {string: '440'}),
                    new parser.Identifier([[3, 32], [3, 49]], {string: 'giFunctionTableID', type: 'i'})
                  ]})
                ]})
              ]})
            ]})
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(0);
  });

  // https://github.com/csound/csound/issues/544
  it('parses if-then with syntax error', () => {
    parser.parse(dedent`
      if 1 == 1 then + -
      endif

    `);
    expect(parser.messages.length).toBe(2);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[0, 14], [0, 14]]
      },
      excerpt: 'Expected newline'
    });
    expect(parser.messages[1]).toEqual({
      severity: 'error',
      location: {
        position: [[0, 0], [0, 0]]
      },
      excerpt: 'Invalid if-statement'
    });
  });

  // https://github.com/csound/csound/issues/546
  it('parses void opcode statement with syntax error', () => {
    parser.parse(dedent`
      prints
      "hello, world"

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 0], [1, 0]]
      },
      excerpt: 'Invalid statement'
    });
  });

  // https://github.com/csound/csound/issues/647
  it('parses while loop with syntax error', () => {
    parser.parse(dedent`
      iIndex = 0
      while iIndex < do
        iIndex += 1
      od

    `);
    expect(parser.messages.length).toBe(3);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 15], [1, 15]]
      },
      excerpt: 'Expected expression'
    });
    expect(parser.messages[1]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 6], [1, 17]]
      },
      excerpt: 'Types of operands do not match type signatures of operator <'
    });
    expect(parser.messages[2]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 6], [1, 17]]
      },
      excerpt: 'Condition of while-loop is not a Boolean expression'
    });
  });

  it('parses invalid statement', () => {
    parser.parse(dedent`
      not_an_opcode(0)

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[0, 13], [0, 13]]
      },
      excerpt: 'Invalid statement'
    });
  });

  it('analyzes redefined instruments', () => {
    parser.parse(dedent`
      instr 1
      endin
      instr 1
      endin
      instr name
      endin
      instr +name
      endin

    `);
    expect(parser.messages.length).toBe(2);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[2, 6], [2, 7]]
      },
      excerpt: 'Instrument 1 redefined',
      trace: [{
        severity: 'info',
        location: {
          position: [[0, 6], [0, 7]]
        },
        excerpt: `Previous definition is here`
      }]
    });
    expect(parser.messages[1]).toEqual({
      severity: 'error',
      location: {
        position: [[6, 7], [6, 11]]
      },
      excerpt: 'Instrument name redefined',
      trace: [{
        severity: 'info',
        location: {
          position: [[4, 6], [4, 10]]
        },
        excerpt: `Previous definition is here`
      }]
    });
  });

  it('analyzes instrument with number 0', () => {
    parser.parse(dedent`
      instr 0
      endin

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[0, 6], [0, 7]]
      },
      excerpt: 'Instrument number must be greater than 0'
    });
  });

  it('analyzes global variable assignment', () => {
    const name = 'giVariable';
    parser.parse(`${name} = 0`);
    expect(parser.messages.length).toBe(0);
    expect(parser.lexer.globalSymbolTable.identifiers[name]).toBeDefined();
  });

  it('analyzes assignment of variable that does not begin with type characters', () => {
    parser.parse(dedent`
      instr 1
        xVariable = 1
      endin

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 2], [1, 11]]
      },
      excerpt: 'Variable name ‘xVariable’ does not begin with type characters'
    });
  });

  // https://github.com/csound/csound/issues/1124
  it('analyzes opcode output that does not begin with type characters', () => {
    parser.parse(dedent`
      instr 1
        g_peak[] init 2
      endin

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 2], [1, 8]]
      },
      excerpt: 'Variable name ‘g_peak’ does not begin with type characters'
    });
  });

  // https://github.com/csound/csound/issues/728
  it('analyzes variable redefined with different type', () => {
    parser.parse(dedent`
      instr 1
        kVariable[] init 1
        kVariable = 1
      endin

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[2, 2], [2, 11]]
      },
      excerpt: 'Redefinition of ‘kVariable’ with a different type',
      trace: [{
        severity: 'info',
        location: {
          position: [[1, 2], [1, 11]]
        },
        excerpt: `Previous definition is here`
      }]
    });
  });

  // https://github.com/nwhetsell/linter-csound/issues/5
  it('analyzes undefined variable', () => {
    parser.parse(dedent`
      instr 1
        out aUndefined
      endin

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 6], [1, 16]]
      },
      excerpt: 'Use of undefined variable ‘aUndefined’'
    });
  });

  // https://github.com/nwhetsell/linter-csound/issues/9
  it('analyzes p-fields', () => {
    expect(parser.parse(dedent`
      prints "%d\\n", p4
      instr 1
        prints "%d\\n", p0
        prints "%d\\n", p1
      endin

    `)).toEqual(
      new parser.Orchestra([[0, 0], [5, 0]], {children: [
        new parser.VoidOpcodeStatement([[0, 0], [1, 0]], {children: [
          new parser.OpcodeExpression([[0, 0], [0, 17]], {children: [
            new parser.Identifier([[0, 0], [0, 6]], {string: 'prints'}),
            new parser.InputArgumentList([[0, 7], [0, 17]], {children: [
              new parser.StringLiteral([[0, 7], [0, 13]], {string: '"%d\\n"'}),
              new parser.Identifier([[0, 15], [0, 17]], {string: 'p4', type: 'i'})
            ]})
          ]})
        ]}),
        new parser.Instrument([[1, 0], [5, 0]], {children: [
          new parser.InstrumentNumberAndNameList([[1, 6], [1, 7]], {children: [
            new parser.NumberLiteral([[1, 6], [1, 7]], {string: '1'})
          ]}),
          new parser.VoidOpcodeStatement([[2, 2], [3, 0]], {children: [
            new parser.OpcodeExpression([[2, 2], [2, 19]], {children: [
              new parser.Identifier([[2, 2], [2, 8]], {string: 'prints'}),
              new parser.InputArgumentList([[2, 9], [2, 19]], {children: [
                new parser.StringLiteral([[2, 9], [2, 15]], {string: '"%d\\n"'}),
                new parser.Identifier([[2, 17], [2, 19]], {string: 'p0', type: 'i'})
              ]})
            ]})
          ]}),
          new parser.VoidOpcodeStatement([[3, 2], [4, 0]], {children: [
            new parser.OpcodeExpression([[3, 2], [3, 19]], {children: [
              new parser.Identifier([[3, 2], [3, 8]], {string: 'prints'}),
              new parser.InputArgumentList([[3, 9], [3, 19]], {children: [
                new parser.StringLiteral([[3, 9], [3, 15]], {string: '"%d\\n"'}),
                new parser.Identifier([[3, 17], [3, 19]], {string: 'p1', type: 'i'})
              ]})
            ]})
          ]})
        ]})
      ]})
    );
    expect(parser.messages.length).toBe(2);
    expect(parser.messages[0]).toEqual({
      severity: 'warning',
      location: {
        position: [[0, 15], [0, 17]]
      },
      excerpt: 'Value of p-field is always 0'
    });
    expect(parser.messages[1]).toEqual({
      severity: 'warning',
      location: {
        position: [[2, 17], [2, 19]]
      },
      excerpt: 'Value of p-field is always 0'
    });
  });

  it('analyzes opcode with required input argument of type .[]', () => {
    parser.parse(dedent`
      iArray[][][] init 10, 9, 8
      iCount lenarray iArray

    `);
    expect(parser.messages.length).toBe(0);
  });

  describe('for opcode with optional input argument', () => {
    describe('of type o,', () => {
      it('analyzes default value', () => {
        parser.parse(dedent`
          instr 1
            aSignal oscili 0dbfs, 440, -1, 0
          endin

        `);
        expect(parser.messages.length).toBe(2);
        expect(parser.messages[0]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 33], [1, 34]]
          },
          excerpt: 'Passing default value of 0 is unnecessary'
        });
        expect(parser.messages[1]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 29], [1, 31]]
          },
          excerpt: 'Passing default value of -1 is unnecessary'
        });
      });

      it('analyzes other value', () => {
        parser.parse(dedent`
          instr 1
            aSignal oscili 0dbfs, 440, -1, 1
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes missing value', () => {
        parser.parse(dedent`
          instr 1
            aSignal oscili 0dbfs, 440, 1
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type j,', () => {
      it('analyzes default value', () => {
        parser.parse(dedent`
          instr 1
            aSignal oscili 0dbfs, 440, -1
          endin

        `);
        expect(parser.messages.length).toBe(1);
        expect(parser.messages[0]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 29], [1, 31]]
          },
          excerpt: 'Passing default value of -1 is unnecessary'
        });
      });

      it('analyzes other value', () => {
        parser.parse(dedent`
          instr 1
            aSignal oscili 0dbfs, 440, 1
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes missing value', () => {
        parser.parse(dedent`
          instr 1
            aSignal oscili 0dbfs, 440
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type v,', () => {
      it('analyzes default value', () => {
        parser.parse(dedent`
          instr 1
            aSignal rand 0dbfs, 0.50
          endin

        `);
        expect(parser.messages.length).toBe(1);
        expect(parser.messages[0]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 22], [1, 26]]
          },
          excerpt: 'Passing default value of 0.5 is unnecessary'
        });
      });

      it('analyzes other value', () => {
        parser.parse(dedent`
          instr 1
            aSignal rand 0dbfs, 2
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes missing value', () => {
        parser.parse(dedent`
          instr 1
            aSignal rand 0dbfs
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type p,', () => {
      it('analyzes default value', () => {
        parser.parse(dedent`
          instr 1
            iResult pow 1, 2, 1.0
          endin

        `);
        expect(parser.messages.length).toBe(1);
        expect(parser.messages[0]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 20], [1, 23]]
          },
          excerpt: 'Passing default value of 1 is unnecessary'
        });
      });

      it('analyzes other value', () => {
        parser.parse(dedent`
          instr 1
            iResult pow 1, 2, 2
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes missing value', () => {
        parser.parse(dedent`
          instr 1
            iResult pow 1, 2
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type q,', () => {
      it('analyzes default value', () => {
        parser.parse(dedent`
          instr 1
            kRMS rms rand(0dbfs), 0xA
          endin

        `);
        expect(parser.messages.length).toBe(1);
        expect(parser.messages[0]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 24], [1, 27]]
          },
          excerpt: 'Passing default value of 10 is unnecessary'
        });
      });

      it('analyzes other value', () => {
        parser.parse(dedent`
          instr 1
            kRMS rms rand(0dbfs), 100
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes missing value', () => {
        parser.parse(dedent`
          instr 1
            kRMS rms rand(0dbfs)
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type h,', () => {
      it('analyzes default value', () => {
        parser.parse(dedent`
          instr 1
            iResult veloc 0, 127
          endin

        `);
        expect(parser.messages.length).toBe(2);
        expect(parser.messages[0]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 19], [1, 22]]
          },
          excerpt: 'Passing default value of 127 is unnecessary'
        });
        expect(parser.messages[1]).toEqual({
          severity: 'warning',
          location: {
            position: [[1, 16], [1, 17]]
          },
          excerpt: 'Passing default value of 0 is unnecessary'
        });
      });

      it('analyzes other value', () => {
        parser.parse(dedent`
          instr 1
            iResult veloc 0, 1
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes missing value', () => {
        parser.parse(dedent`
          instr 1
            iResult veloc
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });
  });

  describe('for opcode with variable input arguments', () => {
    describe('of type m,', () => {
      it('analyzes zero values', () => {
        parser.parse(dedent`
          instr 1
            iResult[] fillarray
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes one value', () => {
        parser.parse(dedent`
          instr 1
            iResult[] fillarray 1
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes many values', () => {
        parser.parse(dedent`
          instr 1
            iResult[] fillarray 1, 2, 3, 4, 5, 6, 7, 8
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type z,', () => {
      it('analyzes zero values', () => {
        parser.parse(dedent`
          instr 1
            event "i", 1
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes one value', () => {
        parser.parse(dedent`
          instr 1
            event "i", 1, 0
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes many values', () => {
        parser.parse(dedent`
          kValue init 1
          instr 1
            event "i", 1, 0, kValue
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type n,', () => {
      it('analyzes zero values', () => {
        parser.parse(dedent`
          instr 1
            tablexseg 1, 0.5
          endin

        `);
        expect(parser.messages.length).toBe(1);
        expect(parser.messages[0]).toEqual({
          severity: 'error',
          location: {
            position: [[1, 2], [1, 11]]
          },
          excerpt: 'Types of input arguments do not match type signatures of opcode ‘tablexseg’'
        });
      });

      it('analyzes one value', () => {
        parser.parse(dedent`
          instr 1
            tablexseg 1, 0.5, 2
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });

      it('analyzes many values', () => {
        parser.parse(dedent`
          kValue init 1
          instr 1
            tablexseg 1, 0.5, 2, 0.5, 3
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });

    describe('of type Z,', () => {
      it('analyzes one value', () => {
        parser.parse(dedent`
          instr 1
            outch 1
          endin

        `);
        expect(parser.messages.length).toBe(1);
        expect(parser.messages[0]).toEqual({
          severity: 'error',
          location: {
            position: [[1, 2], [1, 7]]
          },
          excerpt: 'Types of input arguments do not match type signatures of opcode ‘outch’'
        });
      });

      it('analyzes many values', () => {
        parser.parse(dedent`
          kValue init 1
          instr 1
            outch 1, oscili(0dbfs, 440), 2, oscili(0dbfs, 440)
          endin

        `);
        expect(parser.messages.length).toBe(0);
      });
    });
  });

  it('analyzes opcode with input arguments matching multiple input type signatures', () => {
    parser.parse(dedent`
      instr 1
        aSignal oscili oscili(0dbfs, 1), oscili(440, 1000)
      endin

    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'warning',
      location: {
        position: [[1, 10], [1, 16]]
      },
      excerpt: 'Types of input arguments match multiple type signatures of opcode ‘oscili’'
    });
  });
});
