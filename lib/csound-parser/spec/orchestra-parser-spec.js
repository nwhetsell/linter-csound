const path = require('path');
const orchestraParserPath = path.resolve('orchestra-parser.js');

const csound = require('csound-api');
csound.SetDefaultMessageCallback(() => {});
const Csound = csound.Create();
const opcodeList = [];
csound.NewOpcodeList(Csound, opcodeList);
const builtInOpcodeSymbolTable = new (require(path.join('..', '..', 'csound-symbol-table', 'symbol-table.js')))();
for (const opcodeEntry of opcodeList) {
  builtInOpcodeSymbolTable.addOpcodeEntry(opcodeEntry);
}
csound.DisposeOpcodeList(Csound, opcodeList);
csound.Destroy(Csound);

describe('Csound orchestra parser', () => {
  let parser;
  beforeEach(() => {
    delete require.cache[orchestraParserPath];
    parser = require(orchestraParserPath);
    parser.yy.pre_parse = yy => Object.assign(yy.lexer.symbolTable.identifiers, builtInOpcodeSymbolTable.identifiers);
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
        new parser.Plus([[0, 11], [0, 13]]),
        new parser.NumberLiteral([[0, 13], [0, 14]], {string: '1'})
      ]})
    );
  });

  it('parses ‘0xff <= 255’', () => {
    // This is not actually a valid Csound statement.
    expect(parseAssignmentValue('iValue = 0xff <= 255')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 20]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 13]], {string: '0xff'}),
        new parser.LessThanOrEqual([[0, 14], [0, 17]]),
        new parser.NumberLiteral([[0, 17], [0, 20]], {string: '255'})
      ]})
    );
  });
  it('parses ‘1234567 > ~0x15’', () => {
     // This is not actually a valid Csound statement.
    expect(parseAssignmentValue('iValue = 1234567 > ~0x15')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 24]], {children: [
        new parser.NumberLiteral([[0, 9], [0, 16]], {string: '1234567'}),
        new parser.GreaterThan([[0, 17], [0, 19]]),
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
        new parser.NotEqual([[0, 17], [0, 20]]),
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
        new parser.BitwiseAND([[0, 21], [0, 23]]),
        new parser.NumberLiteral([[0, 23], [0, 32]], {string: '200000000'}),
      ]})
    );
  });
  it('parses ‘0xFF & 0x15 | 1234’', () => {
    expect(parseAssignmentValue('iValue = 0xFF & 0x15 | 1234')).toEqual(
      new parser.BinaryOperation([[0, 9], [0, 27]], {children: [
        new parser.BinaryOperation([[0, 9], [0, 20]], {children: [
          new parser.NumberLiteral([[0, 9], [0, 13]], {string: '0xFF'}),
          new parser.BitwiseAND([[0, 14], [0, 16]]),
          new parser.NumberLiteral([[0, 16], [0, 20]], {string: '0x15'})
        ]}),
        new parser.BitwiseOR([[0, 21], [0, 23]]),
        new parser.NumberLiteral([[0, 23], [0, 27]], {string: '1234'}),
      ]})
    );
  });

  const parse = string => parser.parse(string.replace(/^\n/, ''));

  it('parses void opcode statement', () => {
    expect(parse('scoreline_i "e"\n')).toEqual(
      new parser.Orchestra([[0, 0], [1, 0]], {children: [
        new parser.VoidOpcodeStatement([[0, 0], [1, 0]], {children: [
          new parser.Identifier([[0, 0], [0, 11]], {string: 'scoreline_i'}),
          new parser.ArgumentList([[0, 12], [0, 15]], {children: [
            new parser.StringLiteral([[0, 12], [0, 15]], {string: '"e"'})
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
            new parser.Equal([[0, 11], [0, 14]]),
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
            new parser.Equal([[0, 11], [0, 14]]),
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
            new parser.Equal([[0, 11], [0, 14]]),
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
            new parser.Equal([[0, 11], [0, 14]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Then([[0, 16], [1, 0]]),
          new parser.Else([[1, 6], [3, 0]], {children: [
            new parser.If([[1, 6], [2, 0]], {children: [
              new parser.BinaryOperation([[1, 13], [1, 19]], {children: [
                new parser.NumberLiteral([[1, 13], [1, 14]], {string: '2'}),
                new parser.Equal([[1, 15], [1, 18]]),
                new parser.NumberLiteral([[1, 18], [1, 19]], {string: '2'})
              ]}),
              new parser.Then([[1, 20], [2, 0]]),
              new parser.Else([[2, 6], [3, 0]], {children: [
                new parser.If([[2, 6], [3, 0]], {children: [
                  new parser.BinaryOperation([[2, 13], [2, 19]], {children: [
                    new parser.NumberLiteral([[2, 13], [2, 14]], {string: '3'}),
                    new parser.NotEqual([[2, 15], [2, 18]]),
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
            new parser.Equal([[0, 11], [0, 14]]),
            new parser.NumberLiteral([[0, 14], [0, 15]], {string: '1'})
          ]}),
          new parser.Then([[0, 16], [1, 0]]),
          new parser.Else([[1, 6], [3, 0]], {children: [
            new parser.If([[1, 6], [2, 0]], {children: [
              new parser.BinaryOperation([[1, 13], [1, 19]], {children: [
                new parser.NumberLiteral([[1, 13], [1, 14]], {string: '2'}),
                new parser.Equal([[1, 15], [1, 18]]),
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
            new parser.Equal([[0, 14], [0, 17]]),
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
            new parser.Equal([[0, 14], [0, 17]]),
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
            ]}),
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
          new parser.OpcodeOutputTypes([[0, 23], [0, 24]], {string: 'a'}),
          new parser.OpcodeInputTypes([[0, 26], [0, 27]], {string: 'k'})
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
      type: 'Error',
      text: 'Expected newline',
      range: [[0, 20], [0, 20]]
    });
  });

  // https://github.com/csound/csound/issues/647
  it('parses while loop with syntax error', () => {
    try {
      parse(`
        iIndex = 0
        while iIndex < do
          iIndex += 1
        od
      `);
      fail('Expected exception.');
    } catch (error) {
      expect(error.hash.exception.lintMessage).toEqual({
        type: 'Error',
        text: 'Expected expression',
        range: [[1, 23], [1, 23]]
      });
    }
  });
});