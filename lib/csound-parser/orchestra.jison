%start orchestra

%%

identifier
  : IDENTIFIER
    { $$ = new Identifier(@$, {string: $1}); };
global_value_identifier
  : GLOBAL_VALUE_IDENTIFIER
    { $$ = new Identifier(@$, {string: $1}); };
opcode
  : OPCODE
    { $$ = new Identifier(@$, {string: $1}); };
void_opcode
  : VOID_OPCODE
    { $$ = new Identifier(@$, {string: $1}); };

decimal_integer
  : DECIMAL_INTEGER
    {
      $$ = new NumberLiteral(@$, {string: $1});
    }
  ;

constant
  : decimal_integer
  | NUMBER
    {
      $$ = new NumberLiteral(@$, {string: $1});
    }
  | STRING
    {
      $$ = new StringLiteral(@$, {string: $1});
    }
  ;

primary_expression
  : identifier
  | global_value_identifier
  | constant
  | '(' conditional_expression ')'
    {
      $$ = $2;
    }
  | error
    {
      parser.parseError('', {}, {
        type: 'Error',
        text: 'Expected expression',
        range: parser.lexer.rangeFromPosition(@$.first_line, @$.first_column)
      });
    }
  ;

postfix_expression
  : primary_expression
  | postfix_expression '[' conditional_expression ']'
    {
      $$ = new ArrayMember(@$, {children: [$1, $3]});
    }
  | opcode '(' opcode_inputs ')'
    {
      $$ = new OpcodeInvocation(@$, {children: [$1, new ArgumentList(@3, {children: $3})]});
    }
  | opcode OPCODE_OUTPUT_TYPE_ANNOTATION '(' opcode_inputs ')'
    {
      $$ = new OpcodeInvocation(@$, {
        children: [$1, new ArgumentList(@4, {children: $4})],
        outputType: $2
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
      $$ = new UnaryOperation(@$, {children: [$1, $2]});
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
      $$ = new BinaryOperation(@$, {children: [$1, $2, $3]});
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
      $$ = new BinaryOperation(@$, {children: [$1, $2, $3]});
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
      $$ = new BinaryOperation(@$, {children: [$1, $2, $3]});
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
      $$ = new BinaryOperation(@$, {children: [$1, $2, $3]});
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
      $$ = new BinaryOperation(@$, {children: [$1, $2, $3]});
    }
  ;

and_expression
  : equality_expression
  | and_expression '&' equality_expression
    {
      $$ = new BinaryOperation(@$, {children: [$1, new BitwiseAND(@2), $3]});
    }
  ;

exclusive_or_expression
  : and_expression
  | exclusive_or_expression '#' and_expression
    {
      $$ = new BinaryOperation(@$, {children: [$1, new BitwiseXOR(@2), $3]});
    }
  ;

inclusive_or_expression
  : exclusive_or_expression
  | inclusive_or_expression '|' exclusive_or_expression
    {
      $$ = new BinaryOperation(@$, {children: [$1, new BitwiseOR(@2), $3]});
    }
  ;

logical_and_expression
  : inclusive_or_expression
  | logical_and_expression '&&' inclusive_or_expression
    {
      $$ = new BinaryOperation(@$, {children: [$1, new And(@2), $3]});
    }
  ;

logical_or_expression
  : logical_and_expression
  | logical_or_expression '||' logical_and_expression
    {
      $$ = new BinaryOperation(@$, {children: [$1, new Or(@2), $3]});
    }
  ;

conditional_expression
  : logical_or_expression
  | logical_or_expression '?' conditional_expression ':' conditional_expression
    {
      $$ = new ConditionalExpression(@$, {children: [$1, $2, $3]});
    }
  ;

labeled_statement
  : LABEL statement
    {
      $$ = new LabeledStatement(@$, {children: [$1, $2]});
    }
  | LABEL EOF
    {
      $$ = new LabeledStatement(@$, {children: [$1]});
    }
  ;

compound_assignment_operator
  : '+=' { $$ = new Plus(@$); }
  | '-=' { $$ = new Minus(@$); }
  | '*=' { $$ = new Multiplication(@$); }
  | '/=' { $$ = new Division(@$); }
  ;

declarator
  : identifier
  | declarator '[' ']'
    {
      $$ = new ArrayDeclarator(@$, {children: [$1]});
    }
  | declarator '[' conditional_expression ']'
    {
      $$ = new ArrayMember(@$, {children: [$1, $3]});
    }
  ;

opcode_outputs
  : declarator
    {
      $$ = [$1];
    }
  | opcode_outputs ',' declarator
    {
      $$.push($2);
    }
  ;

opcode_inputs
  : conditional_expression
    {
      $$ = [$1];
    }
  | opcode_inputs ',' conditional_expression
    {
      $$.push($3);
    }
  ;

assignment_statement
  : declarator '=' conditional_expression NEWLINE
    {
      $$ = new Assignment(@$, {children: [$1, $3]});
    }
  | identifier compound_assignment_operator conditional_expression NEWLINE
    {
      $$ = new CompoundAssignment(@$, {children: [$1, $2, $3]});
    }
  | opcode_outputs opcode opcode_inputs NEWLINE
    {
      $$ = new OpcodeStatement(@$, {children: [
        new ArgumentList(@1, {children: $1}),
        $2,
        new ArgumentList(@3, {children: $3})
      ]});
    }
  | opcode_outputs opcode NEWLINE
    {
      $$ = new OpcodeStatement(@$, {children: [
        new ArgumentList(@1, {children: $1}),
        $2
      ]});
    }
  ;

void_opcode_statement
  : void_opcode opcode_inputs NEWLINE
    {
      $$ = new VoidOpcodeStatement(@$, {children: [
        $1,
        new ArgumentList(@2, {children: $2})
      ]});
    }
  ;

goto_statement
  : GOTO identifier NEWLINE
    {
      $$ = new Goto(@$, {children: [$2]});
    }
  | GOTO decimal_integer NEWLINE
    {
      $$ = new Goto(@$, {children: [$2]});
    }
  | GOTO error
    {
      parser.messages.push({
        type: 'Error',
        text: 'Expected newline',
        range: parser.lexer.rangeFromPosition(@1.last_line, @1.last_column)
      });
    }
  ;

then_statement
  : THEN NEWLINE statements
    {
      $$ = new Then(@$, {children: $3});
    }
  | THEN NEWLINE
    {
      $$ = new Then(@$);
    }
  | THEN error
    {
      parser.messages.push({
        type: 'Error',
        text: 'Expected newline',
        range: parser.lexer.rangeFromPosition(@1.last_line, @1.last_column)
      });
    }
  ;

elseif_statement
  : ELSEIF equality_expression then_statement
    {
      $$ = new If(@$, {children: [$2, $3]});
    }
  ;

/* The lack of a NEWLINE after ELSE is intentional and matches Csound. */
else
  : ELSE statements
    {
      $$ = new Else(@$, {children: $2});
    }
  ;

elseif
  : elseif_statement
  | elseif elseif_statement
    {
      $$.children.push(new Else(@2, {children: [$2]}));
    }
  | elseif else
    {
      $$.children.push($2);
    }
  ;

if_statement
  : IF equality_expression goto_statement
    {
      $$ = new If(@$, {children: [$2, $3]});
    }
  | IF equality_expression then_statement ENDIF NEWLINE
    {
      $$ = new If(@$, {children: [$2, $3]});
    }
  | IF equality_expression then_statement else ENDIF NEWLINE
    {
      $$ = new If(@$, {children: [$2, $3, $4]});
    }
  | IF equality_expression then_statement elseif ENDIF NEWLINE
    {
      $$ = new If(@$, {children: [$2, $3, new Else(@4, {children: [$4]})]});
    }
  ;

/* The lack of a NEWLINE after DO and OD is intentional and matches Csound. */
do
  : DO
    {
      $$ = new Do(@$);
    }
  | DO statements
    {
      $$ = new Do(@$, {children: $2});
    }
  ;

loop_statement
  : WHILE equality_expression do OD
    {
      $$ = new While(@$, {children: [$2, $3]});
    }
  | UNTIL equality_expression do OD
    {
      $$ = new Until(@$, {children: [$2, $3]});
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
  ;

statements
  : statement
    {
      $$ = [$1];
    }
  | statements statement
    {
      $$.push($2);
    }
  ;

instrument_number_or_name
  : decimal_integer
  | identifier
  | '+' identifier
    {
      $$ = new UnaryOperation(@$, {children: [new UnaryPlus(@1), $2]});
    }
  ;

instrument_numbers_and_names
  : instrument_number_or_name
    {
      $$ = [$1];
    }
  | instrument_numbers_and_names ',' instrument_number_or_name
    {
      $$.push($3);
    }
  ;

instrument_number_and_name_list
  : instrument_numbers_and_names
    {
      $$ = new InstrumentNumberAndNameList(@$, {children: $1});
    }
  ;

instrument
  : INSTR instrument_number_and_name_list NEWLINE statements ENDIN NEWLINE
    {
      $4.splice(0, 0, $2);
      $$ = new Instrument(@$, {children: $4});
    }
  | INSTR instrument_number_and_name_list NEWLINE ENDIN NEWLINE
    {
      $$ = new Instrument(@$, {children: [$2]});
    }
  ;

opcode_output_types
  : OPCODE_OUTPUT_TYPES
    {
      $$ = new OpcodeOutputTypes(@$, {string: $1});
    }
  ;

opcode_input_types
  : OPCODE_INPUT_TYPES
    {
      $$ = new OpcodeInputTypes(@$, {string: $1});
    }
  ;

opcode_definition
  : OPCODE identifier ',' opcode_output_types ',' opcode_input_types NEWLINE statements ENDOP NEWLINE
    {
      $8.splice(0, 0, $2, $4, $6);
      $$ = new Opcode(@$, {children: $8});
    }
  | OPCODE identifier ',' opcode_output_types ',' opcode_input_types NEWLINE ENDOP NEWLINE
    {
      $$ = new Opcode(@$, {children: [$2, $4, $6]});
    }
  ;

orchestra_statement
  : global_value_identifier '=' decimal_integer NEWLINE
    {
      $$ = new Assignment(@$, {children: [$1, $3]});
    }
  | statement
  | instrument
  | opcode_definition
  ;

orchestra_statements
  : orchestra_statement
    {
      $$ = [$1];
    }
  | orchestra_statements orchestra_statement
    {
      $$.push($2);
    }
  ;

orchestra
  : orchestra_statements
    {
      $$ = new Orchestra(@$, {children: $1});
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
}

class Identifier extends ASTNode {}

class NumberLiteral extends ASTNode {
  constructor(rangeOrLocation, properties) {
    super(rangeOrLocation, properties);
    this.value = /^0[Xx]/.test(this.string) ? parseInt(this.string, 16) : Number(this.string);
  }
}
class StringLiteral extends ASTNode {}

class ArrayMember extends ASTNode {}
class OpcodeInvocation extends ASTNode {}

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

class LabeledStatement extends ASTNode {
  constructor(rangeOrLocation, properties) {
    super(rangeOrLocation, properties);
    this.children[0] = parser.lexer.nameFromLabel(this.children[0]);
  }
  get label() { return this.children[0]; }
  get statement() { return this.children[1]; }
}

class ArrayDeclarator extends ASTNode {}
class Assignment extends ASTNode {}
class CompoundAssignment extends ASTNode {}
class ArgumentList extends ASTNode {}
class VoidOpcodeStatement extends ASTNode {
  get identifier() { return this.children[0]; }
  get inputArgumentList() { return this.children[1]; }
}
class OpcodeStatement extends VoidOpcodeStatement {
  get outputArgumentList() { return this.children[0]; }
  get identifier() { return this.children[1]; }
  get inputArgumentList() { return this.children[2]; }
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

class InstrumentNumberAndNameList extends ASTNode {}
class Instrument extends ASTNode {
  get numberAndNameList() { return this.children[0]; }
}

class OpcodeOutputTypes extends ASTNode {}
class OpcodeInputTypes extends ASTNode {}
class Opcode extends ASTNode {
  get name() { return this.children[0]; }
  get outputTypes() { return this.children[1]; }
  get inputTypes() { return this.children[2]; }
}

class Orchestra extends ASTNode {}

Object.assign(parser, {
  Identifier: Identifier,
  NumberLiteral: NumberLiteral,
  StringLiteral: StringLiteral,

  ArrayMember: ArrayMember,
  OpcodeInvocation: OpcodeInvocation,

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

  OpcodeOutputTypes: OpcodeOutputTypes,
  OpcodeInputTypes: OpcodeInputTypes,
  Opcode: Opcode,

  Orchestra: Orchestra
});

class CsoundParserError extends Error {
  constructor(lintMessage) {
    super(lintMessage.text);
    this.name = 'CsoundParserError';
    this.lintMessage = lintMessage;
  }
}

parser.messages = [];

const original_parseError = parser.parseError;
parser.parseError = (function(str, hash, lintMessage) {
  if (arguments.length > 2)
    throw new CsoundParserError(lintMessage);
  original_parseError.apply(this, arguments);
}).bind(parser);

module.exports = parser;
