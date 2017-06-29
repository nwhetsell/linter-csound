const path = require('path');
const vm = require('vm');

require('csound-api').SetDefaultMessageCallback(() => {});
const SymbolTable = require(path.join('..', 'symbol-table.js'));

const filename = 'orchestra-parser.js';
const code = require('fs').readFileSync(path.join(__dirname, '..', filename), 'utf-8');

describe('Csound orchestra parser', () => {
  let parser;
  beforeEach(() => {
    parser = vm.runInThisContext(code, {filename: filename})(require);
    parser.lexer.SymbolTable = SymbolTable;
    parser.yy.pre_parse = yy => Object.assign(yy.lexer.symbolTable.identifiers, SymbolTable.builtInOpcodeSymbolTable.identifiers);
  });

  // The tests of expressions are based on tests in
  // https://github.com/python/cpython/blob/master/Lib/test/test_tokenize.py.

  const parseAssignmentValue = string => parser.parse(`${string}\n`).children[0].children[1];

  it('parses ‘1’', () => {
    expect(parseAssignmentValue('iValue = 1')).toEqual(
      new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'})
    );
    expect(parser.messages.length).toBe(0);
  });

  it('parses ‘1 + 1’', () => {
    expect(parseAssignmentValue('iValue = 1 + 1')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 14]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
        new parser.Plus([[0, 11], [0, 12]]),
        new parser.NumberLiteral([[0, 13], [0, 14]], {string: '1'})
      ]})
    );
  });

  it('parses ‘0xff <= 255’', () => {
    // This is not actually a valid Csound statement.
    expect(parseAssignmentValue('iValue = 0xff <= 255')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 20]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 13]], {string: '0xff'}),
        new parser.LessThanOrEqual([[0, 14], [0, 16]]),
        new parser.NumberLiteral([[0, 17], [0, 20]], {string: '255'})
      ]})
    );
  });
  it('parses ‘1234567 > ~0x15’', () => {
     // This is not actually a valid Csound statement.
    expect(parseAssignmentValue('iValue = 1234567 > ~0x15')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 24]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 16]], {string: '1234567'}),
        new parser.GreaterThan([[0, 17], [0, 18]]),
        new parser.UnaryOperation([[0, 19], [0, 24]], {children: [
          new parser.BitwiseComplement([[0, 19], [0, 20]]),
          new parser.NumberLiteral([[0, 20], [0, 24]], {string: '0x15'})
        ]})
      ]})
    );
  });
  it('parses ‘2134568 != 1231515’', () => {
     // This is not actually a valid Csound statement.
    expect(parseAssignmentValue('iValue = 2134568 != 1231515')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 27]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 16]], {string: '2134568'}),
        new parser.NotEqual([[0, 17], [0, 19]]),
        new parser.NumberLiteral([[0, 20], [0, 27]], {string: '1231515'}),
      ]})
    );
  });
  it('parses ‘(-124561-1) & 200000000’', () => {
    expect(parseAssignmentValue('iValue = (-124561-1) & 200000000')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 32]], {children: [
        new parser.BinaryOperation([[0, 10], [0, 19]], {children: [
          new parser.UnaryOperation([[0, 10], [0, 17]], {children: [
            new parser.UnaryMinus([[0, 10], [0, 11]]),
            new parser.NumberLiteral([[0, 11], [0, 17]], {string: '124561'})
          ]}),
          new parser.Minus([[0, 17], [0, 18]]),
          new parser.NumberLiteral([[0, 18], [0, 19]], {string: '1'})
        ]}),
        new parser.BitwiseAND([[0, 21], [0, 22]]),
        new parser.NumberLiteral([[0, 23], [0, 32]], {string: '200000000'}),
      ]})
    );
  });
  it('parses ‘0xFF & 0x15 | 1234’', () => {
    expect(parseAssignmentValue('iValue = 0xFF & 0x15 | 1234')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 27]], {children: [
        new parser.BinaryOperation([[0, 9], [0, 20]], {children: [
          new parser.NumberLiteral([[0, 9], [0, 13]], {string: '0xFF'}),
          new parser.BitwiseAND([[0, 14], [0, 15]]),
          new parser.NumberLiteral([[0, 16], [0, 20]], {string: '0x15'})
        ]}),
        new parser.BitwiseOR([[0, 21], [0, 22]]),
        new parser.NumberLiteral([[0, 23], [0, 27]], {string: '1234'}),
      ]})
    );
  });

  const parse = string => parser.parse(string.replace(/^\n/, ''));

  it('parses void opcode statement', () => {
    expect(parse('scoreline_i "e"\n')).toEqual(
      new parser.Orchestra([[0, 0], [1, 0]], {children: [
        new parser.VoidOpcodeStatement([[0, 0], [1, 0]], {children: [
          new parser.OpcodeExpression([[0, 0], [0, 15]], {children: [
            new parser.Identifier([[0, 0], [0, 11]], {string: 'scoreline_i'}),
            new parser.ArgumentList([[0, 12], [0, 15]], {children: [
              new parser.StringLiteral([[0, 12], [0, 15]], {string: '"e"'})
            ]})
          ]})
        ]})
      ]})
    );
  });

  it('parses if-goto', () => {
    expect(parse(`
      if 1 == 1 goto label
      label:
    `)).toEqual(
      new parser.Orchestra([[0, 6], [2, 4]], {children: [
        new parser.If([[0, 6], [1, 0]], {children: [
          new parser.BinaryOperation([[0, 9], [0, 15]], {children: [
            new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
            new parser.Equal([[0, 11], [0, 13]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Goto([[0, 16], [1, 0]], {children: [
            new parser.Identifier([[0, 21], [0, 26]], {string: 'label'})
          ]})
        ]}),
        new parser.LabeledStatement([[1, 0], [2, 4]], {children: [
          'label'
        ]})
      ]})
    );
  });

  it('parses if-then', () => {
    expect(parse(`
      if 1 == 1 then
      endif
    `)).toEqual(
      new parser.Orchestra([[0, 6], [2, 0]], {children: [
        new parser.If([[0, 6], [2, 0]], {children: [
          new parser.BinaryOperation([[0, 9], [0, 15]], {children: [
            new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
            new parser.Equal([[0, 11], [0, 13]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Then([[0, 16], [1, 0]])
        ]})
      ]})
    );
  });

  it('parses if-then-else', () => {
    expect(parse(`
      if 1 == 1 then
      else
      endif
    `)).toEqual(
      new parser.Orchestra([[0, 6], [3, 0]], {children: [
        new parser.If([[0, 6], [3, 0]], {children: [
          new parser.BinaryOperation([[0, 9], [0, 15]], {children: [
            new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
            new parser.Equal([[0, 11], [0, 13]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Then([[0, 16], [1, 0]]),
          new parser.Else([[1, 6], [2, 0]], {children: [
            new parser.Empty([[1, 10], [2, 0]])
          ]})
        ]})
      ]})
    );
  });

  it('parses if-then-elseif', () => {
    expect(parse(`
      if 1 == 1 then
      elseif 2 == 2 then
      elseif 3 != 3 then
      endif
    `)).toEqual(
      new parser.Orchestra([[0, 6], [4, 0]], {children: [
        new parser.If([[0, 6], [4, 0]], {children: [
          new parser.BinaryOperation([[0, 9], [0, 15]], {children: [
            new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
            new parser.Equal([[0, 11], [0, 13]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Then([[0, 16], [1, 0]]),
          new parser.Else([[1, 6], [3, 0]], {children: [
            new parser.If([[1, 6], [2, 0]], {children: [
              new parser.BinaryOperation([[1, 13], [1, 19]], {children: [
                new parser.NumberLiteral([[1, 13], [1, 14]], {string: '2'}),
                new parser.Equal([[1, 15], [1, 17]]),
                new parser.NumberLiteral([[1, 18], [1, 19]], {string: '2'})
              ]}),
              new parser.Then([[1, 20], [2, 0]]),
              new parser.Else([[2, 6], [3, 0]], {children: [
                new parser.If([[2, 6], [3, 0]], {children: [
                  new parser.BinaryOperation([[2, 13], [2, 19]], {children: [
                    new parser.NumberLiteral([[2, 13], [2, 14]], {string: '3'}),
                    new parser.NotEqual([[2, 15], [2, 17]]),
                    new parser.NumberLiteral([[2, 18], [2, 19]], {string: '3'})
                  ]}),
                  new parser.Then([[2, 20], [3, 0]])
                ]})
              ]})
            ]})
          ]})
        ]})
      ]})
    );
  });

  it('parses if-then-elseif-else', () => {
    expect(parse(`
      if 1 == 1 then
      elseif 2 == 2 then
      else
      endif
    `)).toEqual(
      new parser.Orchestra([[0, 6], [4, 0]], {children: [
        new parser.If([[0, 6], [4, 0]], {children: [
          new parser.BinaryOperation([[0, 9], [0, 15]], {children: [
            new parser.NumberLiteral([[0, 9], [0, 10]], {string: '1'}),
            new parser.Equal([[0, 11], [0, 13]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Then([[0, 16], [1, 0]]),
          new parser.Else([[1, 6], [3, 0]], {children: [
            new parser.If([[1, 6], [2, 0]], {children: [
              new parser.BinaryOperation([[1, 13], [1, 19]], {children: [
                new parser.NumberLiteral([[1, 13], [1, 14]], {string: '2'}),
                new parser.Equal([[1, 15], [1, 17]]),
                new parser.NumberLiteral([[1, 18], [1, 19]], {string: '2'})
              ]}),
              new parser.Then([[1, 20], [2, 0]]),
              new parser.Else([[2, 6], [3, 0]], {children: [
                new parser.Empty([[2, 10], [3, 0]])
              ]})
            ]})
          ]})
        ]})
      ]})
    );
  });

  it('parses while', () => {
    expect(parse(`
      while 0 == 1 do
      od
    `)).toEqual(
      new parser.Orchestra([[0, 6], [2, 0]], {children: [
        new parser.While([[0, 6], [1, 8]], {children: [
          new parser.BinaryOperation([[0, 12], [0, 18]], {children: [
            new parser.NumberLiteral([[0, 12], [0, 13]], {string: '0'}),
            new parser.Equal([[0, 14], [0, 16]]),
            new parser.NumberLiteral([[0, 17], [0, 18]], {string: '1'})
          ]}),
          new parser.Do([[0, 19], [1, 0]], {children: [
            new parser.Empty([[0, 21], [1, 0]])
          ]})
        ]}),
        new parser.Empty([[1, 8], [2, 0]])
      ]})
    );
  });

  it('parses until', () => {
    expect(parse(`
      until 1 == 1 do
      od
    `)).toEqual(
      new parser.Orchestra([[0, 6], [2, 0]], {children: [
        new parser.Until([[0, 6], [1, 8]], {children: [
          new parser.BinaryOperation([[0, 12], [0, 18]], {children: [
            new parser.NumberLiteral([[0, 12], [0, 13]], {string: '1'}),
            new parser.Equal([[0, 14], [0, 16]]),
            new parser.NumberLiteral([[0, 17], [0, 18]], {string: '1'})
          ]}),
          new parser.Do([[0, 19], [1, 0]], {children: [
            new parser.Empty([[0, 21], [1, 0]])
          ]})
        ]}),
        new parser.Empty([[1, 8], [2, 0]])
      ]})
    );
  });

  it('parses instrument', () => {
    expect(parse(`
      instr 1, N_a_M_e_1, +N_a_M_e_2
      endin
    `)).toEqual(
      new parser.Orchestra([[0, 6], [2, 0]], {children: [
        new parser.Instrument([[0, 6], [2, 0]], {children: [
          new parser.InstrumentNumberAndNameList([[0, 12], [0, 36]], {children: [
            new parser.NumberLiteral([[0, 12], [0, 13]], {string: '1'}),
            new parser.Identifier([[0, 15], [0, 24]], {string: 'N_a_M_e_1'}),
            new parser.UnaryOperation([[0, 26], [0, 36]], {children: [
              new parser.UnaryPlus([[0, 26], [0, 27]]),
              new parser.Identifier([[0, 27], [0, 36]], {string: 'N_a_M_e_2'})
            ]})
          ]})
        ]})
      ]})
    );
  });

  it('parses opcode definition', () => {
    expect(parse(`
      opcode anOpcode, a, k
      endop
    `)).toEqual(
      new parser.Orchestra([[0, 6], [2, 0]], {children: [
        new parser.Opcode([[0, 6], [2, 0]], {children: [
          new parser.Identifier([[0, 13], [0, 21]], {string: 'anOpcode'}),
          new parser.OpcodeOutputTypeSignature([[0, 23], [0, 24]], {string: 'a'}),
          new parser.OpcodeInputTypeSignature([[0, 26], [0, 27]], {string: 'k'})
        ]})
      ]})
    );
  });

  it('parses orchestra', () => {
    expect(parse(`
      0dbfs = 1
      giFunctionTableID ftgen 0, 0, 16384, 10, 1
      instr A440
        outc oscili(0.5 * 0dbfs, 440, giFunctionTableID)
      endin
    `)).toEqual(
      new parser.Orchestra([[0, 6], [5, 0]], {children: [
        new parser.Assignment([[0, 6], [1, 0]], {children: [
          new parser.Identifier([[0, 6], [0, 11]], {string: '0dbfs'}),
          new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
        ]}),
        new parser.OpcodeStatement([[1, 6], [2, 0]], {children: [
          new parser.ArgumentList([[1, 6], [1, 23]], {children: [
            new parser.Identifier([[1, 6], [1, 23]], {string: 'giFunctionTableID'})
          ]}),
          new parser.OpcodeExpression([[1, 24], [1, 48]], {children: [
            new parser.Identifier([[1, 24], [1, 29]], {string: 'ftgen'}),
            new parser.ArgumentList([[1, 30], [1, 48]], {children: [
              new parser.NumberLiteral([[1, 30], [1, 31]], {string: '0'}),
              new parser.NumberLiteral([[1, 33], [1, 34]], {string: '0'}),
              new parser.NumberLiteral([[1, 36], [1, 41]], {string: '16384'}),
              new parser.NumberLiteral([[1, 43], [1, 45]], {string: '10'}),
              new parser.NumberLiteral([[1, 47], [1, 48]], {string: '1'})
            ]})
          ]})
        ]}),
        new parser.Instrument([[2, 6], [5, 0]], {children: [
          new parser.InstrumentNumberAndNameList([[2, 12], [2, 16]], {children: [
            new parser.Identifier([[2, 12], [2, 16]], {string: 'A440'})
          ]}),
          new parser.VoidOpcodeStatement([[3, 8], [4, 0]], {children: [
            new parser.OpcodeExpression([[3, 8], [3, 56]], {children: [
              new parser.Identifier([[3, 8], [3, 12]], {string: 'outc'}),
              new parser.ArgumentList([[3, 13], [3, 56]], {children: [
                new parser.OpcodeExpression([[3, 13], [3, 56]], {children: [
                  new parser.Identifier([[3, 13], [3, 19]], {string: 'oscili'}),
                  new parser.ArgumentList([[3, 20], [3, 55]], {children: [
                    new parser.BinaryOperation([[3, 20], [3, 31]], {children: [
                      new parser.NumberLiteral([[3, 20], [3, 23]], {string: '0.5'}),
                      new parser.Multiplication([[3, 24], [3, 25]]),
                      new parser.Identifier([[3, 26], [3, 31]], {string: '0dbfs'})
                    ]}),
                    new parser.NumberLiteral([[3, 33], [3, 36]], {string: '440'}),
                    new parser.Identifier([[3, 38], [3, 55]], {string: 'giFunctionTableID'})
                  ]})
                ]})
              ]})
            ]})
          ]})
        ]})
      ]})
    );
  });

  // https://github.com/csound/csound/issues/544
  it('parses if-then with syntax error', () => {
    parse(`
      if 1 == 1 then + -
      endif
    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[0, 20], [0, 20]]
      },
      excerpt: 'Expected newline'
    });
  });

  // https://github.com/csound/csound/issues/546
  it('parses void opcode statement with syntax error', () => {
    parse(`
      prints
      "hello, world"
    `);
    expect(parser.messages.length).toBe(2);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[0, 12], [0, 12]]
      },
      excerpt: 'Expected expression'
    });
    expect(parser.messages[1]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 6], [1, 6]]
      },
      excerpt: 'Invalid statement'
    });
  });

  // https://github.com/csound/csound/issues/647
  it('parses while loop with syntax error', () => {
    parse(`
      iIndex = 0
      while iIndex < do
        iIndex += 1
      od
    `);
    expect(parser.messages.length).toBe(1);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[1, 21], [1, 21]]
      },
      excerpt: 'Expected expression'
    });
  });

  it('parses redefined instruments', () => {
    parse(`
      instr 1
      endin
      instr 1
      endin
      instr name
      endin
      instr +name
      endin
      instr 0
      endin
    `);
    expect(parser.messages.length).toBe(3);
    expect(parser.messages[0]).toEqual({
      severity: 'error',
      location: {
        position: [[2, 12], [2, 13]]
      },
      excerpt: 'Instrument 1 redefined',
      trace: [{
        severity: 'info',
        location: {
          position: [[0, 12], [0, 13]]
        },
        excerpt: `Previous definition is here`
      }]
    });
    expect(parser.messages[1]).toEqual({
      severity: 'error',
      location: {
        position: [[6, 13], [6, 17]]
      },
      excerpt: 'Instrument name redefined',
      trace: [{
        severity: 'info',
        location: {
          position: [[4, 12], [4, 16]]
        },
        excerpt: `Previous definition is here`
      }]
    });
    expect(parser.messages[2]).toEqual({
      severity: 'error',
      location: {
        position: [[8, 12], [8, 13]]
      },
      excerpt: 'Instrument number must be greater than 0'
    });
  });
});
