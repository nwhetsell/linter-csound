%start orchestra

%%

identifier
  : IDENTIFIER
    { $$ = new Identifier(@$, {string: $IDENTIFIER}); };
global_value_identifier
  : GLOBAL_VALUE_IDENTIFIER
    { $$ = new Identifier(@$, {string: $GLOBAL_VALUE_IDENTIFIER}); };
opcode
  : OPCODE
    { $$ = new Identifier(@$, {string: $OPCODE}); };
void_opcode
  : VOID_OPCODE
    { $$ = new Identifier(@$, {string: $VOID_OPCODE}); };

decimal_integer
  : DECIMAL_INTEGER
    {
      $$ = new NumberLiteral(@$, {string: $DECIMAL_INTEGER});
    }
  ;

constant
  : decimal_integer
  | NUMBER
    {
      $$ = new NumberLiteral(@$, {string: $NUMBER});
    }
  | STRING
    {
      $$ = new StringLiteral(@$, {string: $STRING});
    }
  ;

primary_expression
  : identifier
  | global_value_identifier
  | constant
  | '(' conditional_expression ')'
    {
      $$ = $conditional_expression;
    }
  | error
    {
      parser.addError({
        severity: 'error',
        location: {
          position: parser.lexer.rangeFromPosition(@$.first_line, @$.first_column)
        },
        excerpt: 'Expected expression'
      });
    }
  ;

array_member
  : identifier '[' conditional_expression ']'
    {
      $$ = new ArrayMember(@$, {children: [$identifier, $conditional_expression]});
    }
  | array_member '[' conditional_expression ']'
    {
      $$ = new ArrayMember(@$, {children: [$array_member, $conditional_expression]});
    }
  ;

postfix_expression
  : primary_expression
  | array_member
  | opcode '(' opcode_inputs ')'
    {
      $$ = new OpcodeExpression(@$, {children: [
        $opcode,
        new ArgumentList(@opcode_inputs, {children: $opcode_inputs})
      ]});
    }
  | opcode OPCODE_OUTPUT_TYPE_ANNOTATION '(' opcode_inputs ')'
    {
      $$ = new OpcodeExpression(@$, {outputTypeAnnotation: $OPCODE_OUTPUT_TYPE_ANNOTATION, children: [
        $opcode,
        new ArgumentList(@opcode_inputs, {children: $opcode_inputs})],
      });
    }
  ;

unary_operator
  : '+'  { $$ = new UnaryPlus(@$); }
  | '-'  { $$ = new UnaryMinus(@$); }
  | '~'  { $$ = new BitwiseComplement(@$); }
  | '!'  { $$ = new Not(@$); }
  ;

unary_expression
  : postfix_expression
  | unary_operator unary_expression
    {
      $$ = new UnaryOperation(@$, {children: [$unary_operator, $unary_expression]});
    }
  ;

multiplicative_operator
  : '*'  { $$ = new Multiplication(@$); }
  | '/'  { $$ = new Division(@$); }
  | '^'  { $$ = new Power(@$); }
  | '%'  { $$ = new Modulus(@$); }
  ;

multiplicative_expression
  : unary_expression
  | multiplicative_expression multiplicative_operator unary_expression
    {
      $$ = new BinaryOperation(@$, {children: [$multiplicative_expression, $multiplicative_operator, $unary_expression]});
    }
  ;

additive_operator
  : '+'  { $$ = new Plus(@$); }
  | '-'  { $$ = new Minus(@$); }
  ;

additive_expression
  : multiplicative_expression
  | additive_expression additive_operator multiplicative_expression
    {
      $$ = new BinaryOperation(@$, {children: [$additive_expression, $additive_operator, $multiplicative_expression]});
    }
  ;

shift_operator
  : '<<' { $$ = new LeftShift(@$); }
  | '>>' { $$ = new RightShift(@$); }
  ;

shift_expression
  : additive_expression
  | shift_expression shift_operator additive_expression
    {
      $$ = new BinaryOperation(@$, {children: [$shift_expression, $shift_operator, $additive_expression]});
    }
  ;

relational_operator
  : '<'  { $$ = new LessThan(@$); }
  | '>'  { $$ = new GreaterThan(@$); }
  | '<=' { $$ = new LessThanOrEqual(@$); }
  | '>=' { $$ = new GreaterThanOrEqual(@$); }
  ;

relational_expression
  : shift_expression
  | relational_expression relational_operator shift_expression
    {
      $$ = new BinaryOperation(@$, {children: [$relational_expression, $relational_operator, $shift_expression]});
    }
  ;

equality_operator
  : '==' { $$ = new Equal(@$); }
  | '!=' { $$ = new NotEqual(@$); }
  ;

equality_expression
  : relational_expression
  | equality_expression equality_operator relational_expression
    {
      $$ = new BinaryOperation(@$, {children: [$equality_expression, $equality_operator, $relational_expression]});
    }
  ;

and_expression
  : equality_expression
  | and_expression '&'[AND] equality_expression
    {
      $$ = new BinaryOperation(@$, {children: [$and_expression, new BitwiseAND(@AND), $equality_expression]});
    }
  ;

exclusive_or_expression
  : and_expression
  | exclusive_or_expression '#'[XOR] and_expression
    {
      $$ = new BinaryOperation(@$, {children: [$exclusive_or_expression, new BitwiseXOR(@XOR), $and_expression]});
    }
  ;

inclusive_or_expression
  : exclusive_or_expression
  | inclusive_or_expression '|'[OR] exclusive_or_expression
    {
      $$ = new BinaryOperation(@$, {children: [$inclusive_or_expression, new BitwiseOR(@OR), $exclusive_or_expression]});
    }
  ;

logical_and_expression
  : inclusive_or_expression
  | logical_and_expression '&&'[and] inclusive_or_expression
    {
      $$ = new BinaryOperation(@$, {children: [$logical_and_expression, new And(@and), $inclusive_or_expression]});
    }
  ;

logical_or_expression
  : logical_and_expression
  | logical_or_expression '||'[or] logical_and_expression
    {
      $$ = new BinaryOperation(@$, {children: [$logical_or_expression, new Or(@or), $logical_and_expression]});
    }
  ;

conditional_expression
  : logical_or_expression
  | logical_or_expression '?' conditional_expression ':' conditional_expression
    {
      $$ = new ConditionalExpression(@$, {children: [$logical_or_expression, $conditional_expression1, $conditional_expression2]});
    }
  ;

labeled_statement
  : LABEL statement
    {
      $$ = new LabeledStatement(@$, {children: [new Label(@LABEL, {string: $LABEL}), $statement]});
    }
  | LABEL EOF
    {
      $$ = new LabeledStatement(@$, {children: [new Label(@LABEL, {string: $LABEL})]});
    }
  ;

compound_assignment_operator
  : '+=' { $$ = new Plus(@$); }
  | '-=' { $$ = new Minus(@$); }
  | '*=' { $$ = new Multiplication(@$); }
  | '/=' { $$ = new Division(@$); }
  ;

array_declarator
  : identifier '[' ']'
    {
      $$ = new ArrayDeclarator(@$, {children: [$identifier]});
    }
  | array_declarator '[' ']'
    {
      $$ = new ArrayDeclarator(@$, {children: [$array_declarator]});
    }
  ;

declarator
  : identifier
  | array_declarator
  | array_member
  ;

opcode_outputs
  : declarator
    {
      $$ = [$declarator];
    }
  | opcode_outputs ',' declarator
    {
      $$.push($declarator);
    }
  ;

opcode_inputs
  : conditional_expression
    {
      $$ = [$conditional_expression];
    }
  | opcode_inputs ',' conditional_expression
    {
      $$.push($conditional_expression);
    }
  ;

opcode_expression
  : opcode
    {
      $$ = new OpcodeExpression(@$, {children: [$opcode]});
    }
  | opcode opcode_inputs
    {
      $$ = new OpcodeExpression(@$, {children: [
        $opcode,
        new ArgumentList(@opcode_inputs, {children: $opcode_inputs})
      ]});
    }
  ;

assignment_statement
  : identifier '=' conditional_expression NEWLINE
    {
      $$ = new Assignment(@$, {children: [$identifier, $conditional_expression]});
    }
  | array_member '=' conditional_expression NEWLINE
    {
      $$ = new Assignment(@$, {children: [$array_member, $conditional_expression]});
    }
  | identifier compound_assignment_operator conditional_expression NEWLINE
    {
      $$ = new CompoundAssignment(@$, {children: [$identifier, $compound_assignment_operator, $conditional_expression]});
    }
  | opcode_outputs opcode_expression NEWLINE
    {
      $$ = new OpcodeStatement(@$, {children: [
        new ArgumentList(@opcode_outputs, {children: $opcode_outputs}),
        $opcode_expression
      ]});
    }
  ;

void_opcode_statement
  : void_opcode opcode_inputs NEWLINE
    {
      $$ = new VoidOpcodeStatement(@$, {children: [
        new OpcodeExpression({
          first_line: @void_opcode.first_line,
          first_column: @void_opcode.first_column,
          last_line: @opcode_inputs.last_line,
          last_column: @opcode_inputs.last_column
        }, {children: [
          $void_opcode,
          new ArgumentList(@opcode_inputs, {children: $opcode_inputs})
        ]})
      ]});
    }
  ;

goto_statement
  : GOTO identifier NEWLINE
    {
      $$ = new Goto(@$, {children: [$identifier]});
    }
  | GOTO decimal_integer NEWLINE
    {
      $$ = new Goto(@$, {children: [$decimal_integer]});
    }
  | GOTO error NEWLINE
    {
      parser.addError({
        severity: 'error',
        location: {
          position: parser.lexer.rangeFromPosition(@GOTO.last_line, @GOTO.last_column)
        },
        excerpt: 'Expected newline'
      });
    }
  ;

then_statement
  : THEN NEWLINE statements
    {
      $$ = new Then(@$, {children: $statements});
    }
  | THEN NEWLINE
    {
      $$ = new Then(@$);
    }
  | THEN error NEWLINE
    {
      parser.addError({
        severity: 'error',
        location: {
          position: parser.lexer.rangeFromPosition(@THEN.last_line, @THEN.last_column)
        },
        excerpt: 'Expected newline'
      });
    }
  ;

elseif_statement
  : ELSEIF equality_expression then_statement
    {
      $$ = new If(@$, {children: [$equality_expression, $then_statement]});
    }
  ;

// The lack of a NEWLINE after ELSE is intentional and matches Csound.
else
  : ELSE statements
    {
      $$ = new Else(@$, {children: $statements});
    }
  ;

elseif
  : elseif_statement
  | elseif elseif_statement
    {
      $$.children.push(new Else(@elseif_statement, {children: [$elseif_statement]}));
    }
  | elseif else
    {
      $$.children.push($else);
    }
  ;

if_statement
  : IF equality_expression goto_statement
    {
      $$ = new If(@$, {children: [$equality_expression, $goto_statement]});
    }
  | IF equality_expression then_statement ENDIF NEWLINE
    {
      $$ = new If(@$, {children: [$equality_expression, $then_statement]});
    }
  | IF equality_expression then_statement else ENDIF NEWLINE
    {
      $$ = new If(@$, {children: [$equality_expression, $then_statement, $else]});
    }
  | IF equality_expression then_statement elseif ENDIF NEWLINE
    {
      $$ = new If(@$, {children: [$equality_expression, $then_statement, new Else(@elseif, {children: [$elseif]})]});
    }
  ;

// The lack of a NEWLINE after DO and OD is intentional and matches Csound.
do
  : DO
    {
      $$ = new Do(@$);
    }
  | DO statements
    {
      $$ = new Do(@$, {children: $statements});
    }
  ;

loop_statement
  : WHILE equality_expression do OD
    {
      $$ = new While(@$, {children: [$equality_expression, $do]});
    }
  | UNTIL equality_expression do OD
    {
      $$ = new Until(@$, {children: [$equality_expression, $do]});
    }
  ;

statement
  : labeled_statement
  | void_opcode_statement
  | assignment_statement
  | if_statement
  | loop_statement
  | goto_statement
  | NEWLINE
    {
      $$ = new Empty(@$);
    }
  | error
    {
      parser.addError({
        severity: 'error',
        location: {
          position: parser.lexer.rangeFromPosition(@$.first_line, @$.first_column)
        },
        excerpt: 'Invalid statement'
      });
    }
  ;

statements
  : statement
    {
      $$ = [$statement];
    }
  | statements statement
    {
      $$.push($statement);
    }
  ;

instrument_number_or_name
  : decimal_integer
  | identifier
  | '+'[plus] identifier
    {
      $$ = new UnaryOperation(@$, {children: [new UnaryPlus(@plus), $identifier]});
    }
  ;

instrument_numbers_and_names
  : instrument_number_or_name
    {
      $$ = [$instrument_number_or_name];
    }
  | instrument_numbers_and_names ',' instrument_number_or_name
    {
      $$.push($instrument_number_or_name);
    }
  ;

instrument_number_and_name_list
  : instrument_numbers_and_names
    {
      $$ = new InstrumentNumberAndNameList(@$, {children: $instrument_numbers_and_names});
    }
  ;

instrument
  : INSTR instrument_number_and_name_list NEWLINE statements ENDIN NEWLINE
    {
      $$ = new Instrument(@$, {children: [$instrument_number_and_name_list, ...$statements]});
    }
  | INSTR instrument_number_and_name_list NEWLINE ENDIN NEWLINE
    {
      $$ = new Instrument(@$, {children: [$instrument_number_and_name_list]});
    }
  ;

opcode_output_type_signature
  : OPCODE_OUTPUT_TYPE_SIGNATURE
    {
      $$ = new OpcodeOutputTypeSignature(@$, {string: $OPCODE_OUTPUT_TYPE_SIGNATURE});
    }
  ;

opcode_input_type_signature
  : OPCODE_INPUT_TYPE_SIGNATURE
    {
      $$ = new OpcodeInputTypeSignature(@$, {string: $OPCODE_INPUT_TYPE_SIGNATURE});
    }
  ;

opcode_definition
  : OPCODE identifier ',' opcode_output_type_signature ',' opcode_input_type_signature NEWLINE statements ENDOP NEWLINE
    {
      $$ = new Opcode(@$, {children: [$identifier, $opcode_output_type_signature, $opcode_input_type_signature, ...$statements]});
    }
  | OPCODE identifier ',' opcode_output_type_signature ',' opcode_input_type_signature NEWLINE ENDOP NEWLINE
    {
      $$ = new Opcode(@$, {children: [$identifier, $opcode_output_type_signature, $opcode_input_type_signature]});
    }
  ;

orchestra_statement
  : global_value_identifier '=' decimal_integer NEWLINE
    {
      $$ = new Assignment(@$, {children: [$global_value_identifier, $decimal_integer]});
    }
  | statement
  | instrument
  | opcode_definition
  ;

orchestra_statements
  : orchestra_statement
    {
      $$ = [$orchestra_statement];
    }
  | orchestra_statements orchestra_statement
    {
      $$.push($orchestra_statement);
    }
  ;

orchestra
  : orchestra_statements
    {
      $$ = new Orchestra(@$, {children: $orchestra_statements});
      $$.analyzeSemantics();
      return $$;
    }
  ;

%%

class ASTNode {
  constructor(rangeOrLocation, properties) {
    if (Array.isArray(rangeOrLocation)) {
      this.range = rangeOrLocation;
    } else {
      this.range = [
        parser.lexer.sourceMap.sourceLocation([rangeOrLocation.first_line - 1, rangeOrLocation.first_column]),
        parser.lexer.sourceMap.sourceLocation([rangeOrLocation.last_line - 1, rangeOrLocation.last_column])
      ];
    }
    Object.assign(this, properties);
  }

  analyzeSemantics() {
    if (this.children) {
      for (const child of this.children) {
        if (child.analyzeSemantics instanceof Function)
          child.analyzeSemantics();
      }
    }
  }

  analyzeSemanticsOfVariableDefinition(identifier, arrayDimension) {
    const name = identifier.string;

    let type;
    let symbolTable;
    let variable = parser.lexer.globalSymbolTable.identifiers[name];
    if (variable) {
      type = variable.type;
      symbolTable = parser.lexer.globalSymbolTable;
    } else {
      const result = /^(g)?([aikpSw])/.exec(name);
      if (result) {
        type = result[0];
        symbolTable = result[1] ? parser.lexer.globalSymbolTable : parser.localSymbolTable;
        variable = symbolTable.identifiers[name];
      } else {
        parser.addError({
          severity: 'error',
          location: {
            position: identifier.range
          },
          excerpt: `Variable name ${parser.lexer.quote(name)} does not begin with type characters`
        });
        symbolTable = parser.localSymbolTable;
      }
    }
    type += '[]'.repeat(arrayDimension);

    if (variable) {
      if (type !== variable.type) {
        const error = {
          severity: 'error',
          location: {
            position: identifier.range
          },
          excerpt: `Redefinition of ${parser.lexer.quote(name)} with a different type`
        };
        if (variable.range) {
          error.trace = [{
            severity: 'info',
            location: {
              position: variable.range
            },
            excerpt: 'Previous definition is here'
          }]
        }
        parser.addError(error);
      }
    } else {
      symbolTable.addVariable(name, type, identifier.range);
    }
  }
}

class Identifier extends ASTNode {
  analyzeSemantics() {
    if (!(parser.lexer.globalSymbolTable.identifiers[this.string] || parser.localSymbolTable.identifiers[this.string])) {
      parser.addError({
        severity: 'error',
        location: {
          position: this.range
        },
        excerpt: `Use of undefined variable ${parser.lexer.quote(this.string)}`
      });
    }
  }
}

class NumberLiteral extends ASTNode {
  constructor(rangeOrLocation, properties) {
    super(rangeOrLocation, properties);
    this.value = /^0[Xx]/.test(this.string) ? parseInt(this.string, 16) : Number(this.string);
  }
}
class StringLiteral extends ASTNode {}

class ArrayMember extends ASTNode {}

class OpcodeExpression extends ASTNode {
  get opcode() { return this.children[0]; }
}

class UnaryPlus extends ASTNode {}
class UnaryMinus extends ASTNode {}
class BitwiseComplement extends ASTNode {}
class Not extends ASTNode {}
class UnaryOperation extends ASTNode {
  get operator() { return this.children[0]; }
}

class Multiplication extends ASTNode {}
class Division extends ASTNode {}
class Power extends ASTNode {}
class Modulus extends ASTNode {}
class Plus extends ASTNode {}
class Minus extends ASTNode {}
class LeftShift extends ASTNode {}
class RightShift extends ASTNode {}

class LessThan extends ASTNode {}
class GreaterThan extends ASTNode {}
class LessThanOrEqual extends ASTNode {}
class GreaterThanOrEqual extends ASTNode {}
class Equal extends ASTNode {}
class NotEqual extends ASTNode {}
class BitwiseAND extends ASTNode {}
class BitwiseXOR extends ASTNode {}
class BitwiseOR extends ASTNode {}
class And extends ASTNode {}
class Or extends ASTNode {}

class BinaryOperation extends ASTNode {
  get operator() { return this.children[1]; }
}

class TestAndBodyNode extends ASTNode {
  get test() { return this.children[0]; }
  get body() { return this.children[1]; }
}

class ConditionalExpression extends TestAndBodyNode {
  get else() { return this.children[2]; }
}

class Label extends ASTNode {}
class LabeledStatement extends ASTNode {
  constructor(rangeOrLocation, properties) {
    super(rangeOrLocation, properties);
    this.children[0] = parser.lexer.nameFromLabel(this.children[0].string);
  }
  get label() { return this.children[0]; }
  get statement() { return this.children[1]; }
}

class ArrayDeclarator extends ASTNode {}
class Assignment extends ASTNode {
  analyzeSemantics() {
    const declarator = this.children[0];
    if (declarator instanceof Identifier)
      this.analyzeSemanticsOfVariableDefinition(declarator);
    super.analyzeSemantics();
  }
}
class CompoundAssignment extends ASTNode {}

class ArgumentList extends ASTNode {}
class VoidOpcodeStatement extends ASTNode {}
class OpcodeStatement extends VoidOpcodeStatement {
  analyzeSemantics() {
    const outputArguments = this.children[0].children;
    if (outputArguments.length === 1 && outputArguments[0] instanceof ArrayDeclarator) {
      let declarator = outputArguments[0];
      if (declarator instanceof ArrayDeclarator) {
        const opcodeExpression = this.children[1];
        if (opcodeExpression.opcode.string === 'init') {
          let arrayDimension = 0;
          do {
            arrayDimension++;
            declarator = declarator.children[0];
          } while (declarator instanceof ArrayDeclarator);
          this.analyzeSemanticsOfVariableDefinition(declarator, arrayDimension);
          opcodeExpression.analyzeSemantics();
          return;
        }
      }
    }

    super.analyzeSemantics();
  }
}

class Goto extends ASTNode {
  get label() { return this.children[0]; }
}

class If extends TestAndBodyNode {
  get else() { return this.children[2]; }
}
class Then extends ASTNode {}
class Else extends ASTNode {}

class While extends TestAndBodyNode {}
class Until extends TestAndBodyNode {}
class Do extends ASTNode {}

class Empty extends ASTNode {}

class InstrumentNumberAndNameList extends ASTNode {
  analyzeSemantics() {
    for (const child of this.children) {
      const numberOrName = (child instanceof UnaryOperation) ? child.children[1] : child;
      const string = numberOrName.string;
      if (string === '0') {
        parser.addError({
          severity: 'error',
          location: {
            position: numberOrName.range
          },
          excerpt: 'Instrument number must be greater than 0'
        });
        return;
      }

      const previousNumberOrName = parser.instrumentNumbersAndNamesByString[string];
      if (previousNumberOrName) {
        parser.addError({
          severity: 'error',
          location: {
            position: numberOrName.range
          },
          excerpt: `Instrument ${string} redefined`,
          trace: [{
            severity: 'info',
            location: {
              position: previousNumberOrName.range
            },
            excerpt: 'Previous definition is here'
          }]
        });
        return;
      }

      parser.instrumentNumbersAndNamesByString[string] = numberOrName;
    }
  }
}

class Instrument extends ASTNode {
  analyzeSemantics() {
    parser.symbolTables.push(new parser.lexer.SymbolTable());
    super.analyzeSemantics();
    parser.symbolTables.pop();
  }
}

class OpcodeOutputTypeSignature extends ASTNode {}
class OpcodeInputTypeSignature extends ASTNode {}
class Opcode extends ASTNode {
  get name() { return this.children[0]; }
  get outputTypes() { return this.children[1]; }
  get inputTypes() { return this.children[2]; }
}

class Orchestra extends ASTNode {
  analyzeSemantics() {
    parser.symbolTables = [parser.lexer.globalSymbolTable];
    super.analyzeSemantics();
  }
}

Object.assign(parser, {
  Identifier: Identifier,
  NumberLiteral: NumberLiteral,
  StringLiteral: StringLiteral,

  ArrayMember: ArrayMember,
  OpcodeExpression: OpcodeExpression,

  UnaryPlus: UnaryPlus,
  UnaryMinus: UnaryMinus,
  BitwiseComplement: BitwiseComplement,
  Not: Not,
  UnaryOperation: UnaryOperation,

  Multiplication: Multiplication,
  Division: Division,
  Power: Power,
  Modulus: Modulus,
  Plus: Plus,
  Minus: Minus,
  LeftShift: LeftShift,
  RightShift: RightShift,
  LessThan: LessThan,
  GreaterThan: GreaterThan,
  LessThanOrEqual: LessThanOrEqual,
  GreaterThanOrEqual: GreaterThanOrEqual,
  Equal: Equal,
  NotEqual: NotEqual,
  BitwiseAND: BitwiseAND,
  BitwiseXOR: BitwiseXOR,
  BitwiseOR: BitwiseOR,
  And: And,
  Or: Or,
  BinaryOperation: BinaryOperation,

  ConditionalExpression: ConditionalExpression,

  Label: Label,
  LabeledStatement: LabeledStatement,
  ArrayDeclarator: ArrayDeclarator,
  Assignment: Assignment,
  CompoundAssignment: CompoundAssignment,
  ArgumentList: ArgumentList,
  VoidOpcodeStatement: VoidOpcodeStatement,
  OpcodeStatement: OpcodeStatement,
  Goto: Goto,
  If: If,
  Then: Then,
  Else: Else,
  While: While,
  Until: Until,
  Do: Do,
  Empty: Empty,

  InstrumentNumberAndNameList: InstrumentNumberAndNameList,
  Instrument: Instrument,

  OpcodeOutputTypeSignature: OpcodeOutputTypeSignature,
  OpcodeInputTypeSignature: OpcodeInputTypeSignature,
  Opcode: Opcode,

  Orchestra: Orchestra
});

parser.addError = (function(error) {
  this.messages.push(error);
  if (this.messages.length === 10) {
    this.parseError('', {}, this.JisonParserError, {
      severity: 'error',
      location: error.location,
      excerpt: 'Too many errors emitted, stopping now'
    });
  }
}).bind(parser);

parser.instrumentNumbersAndNamesByString = {};

parser.messages = [];

Object.defineProperties(parser, {
  localSymbolTable: {
    get: (function() {
      return this.symbolTables[this.symbolTables.length - 1];
    }).bind(parser)
  }
});

class CsoundParserError extends Error {
  constructor(lintMessage) {
    super(lintMessage.text);
    this.name = 'CsoundParserError';
    this.lintMessage = lintMessage;
  }
}

const original_originalParseError = parser.originalParseError;
parser.originalParseError = (function() {
  if (arguments.length > 3)
    throw new CsoundParserError(arguments[3]);
  original_originalParseError.apply(this, arguments);
}).bind(parser);
