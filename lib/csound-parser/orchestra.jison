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
        new InputArgumentList(@opcode_inputs, {children: $opcode_inputs})
      ]});
    }
  | opcode OPCODE_OUTPUT_TYPE_ANNOTATION '(' opcode_inputs ')'
    {
      $$ = new OpcodeExpression(@$, {outputTypeAnnotation: $OPCODE_OUTPUT_TYPE_ANNOTATION, children: [
        $opcode,
        new InputArgumentList(@opcode_inputs, {children: $opcode_inputs})],
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
      $$ = $1;
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
      $$ = $1;
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
        new InputArgumentList(@opcode_inputs, {children: $opcode_inputs})
      ]});
    }
  ;

assignment_statement
  : declarator '=' conditional_expression NEWLINE
    {
      $$ = new Assignment(@$, {children: [$declarator, $conditional_expression]});
    }
  | identifier compound_assignment_operator conditional_expression NEWLINE
    {
      $$ = new CompoundAssignment(@$, {children: [$identifier, $compound_assignment_operator, $conditional_expression]});
    }
  | opcode_outputs opcode_expression NEWLINE
    {
      $$ = new OpcodeStatement(@$, {children: [
        new OutputArgumentList(@opcode_outputs, {children: $opcode_outputs}),
        $opcode_expression
      ]});
    }
  ;

void_opcode_statement
  : void_opcode WHITESPACE opcode_inputs NEWLINE
    {
      $$ = new VoidOpcodeStatement(@$, {children: [
        new OpcodeExpression({
          first_line:   @void_opcode.first_line,
          first_column: @void_opcode.first_column,
          last_line:    @opcode_inputs.last_line,
          last_column:  @opcode_inputs.last_column
        }, {children: [
          $void_opcode,
          new InputArgumentList(@opcode_inputs, {children: $opcode_inputs})
        ]})
      ]});
    }
  | void_opcode '(' opcode_inputs ')'[right_parenthesis] NEWLINE
    {
      $$ = new VoidOpcodeStatement(@$, {children: [
        new OpcodeExpression({
          first_line:   @void_opcode.first_line,
          first_column: @void_opcode.first_column,
          last_line:    @right_parenthesis.last_line,
          last_column:  @right_parenthesis.last_column
        }, {children: [
          $void_opcode,
          new InputArgumentList(@opcode_inputs, {children: $opcode_inputs})
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
      $$ = $1;
      $$.children.push(new Else(@elseif_statement, {children: [$elseif_statement]}));
    }
  | elseif else
    {
      $$ = $1;
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
      yyclearin;
      yyerrok;
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
      $$ = $1;
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
      $$ = $1;
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
      $$ = $1;
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

const matchedInputTypeSignaturesSymbol = Symbol('matchedInputTypeSignaturesSymbol');
const optionalInputArgumentAnalyzersByMatchedInputTypeSignaturesSymbol = Symbol('optionalInputArgumentAnalyzersByMatchedInputTypeSignatures');

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

  canBeType(type, arraySuffixPredicate) {
    // Expressions will have matchedInputTypeSignatures defined.
    const matchedInputTypeSignatures = this[matchedInputTypeSignaturesSymbol];
    if (matchedInputTypeSignatures) {
      for (const inputTypeSignature of matchedInputTypeSignatures) {
        for (const outputTypeSignature of this.outputTypeSignaturesByInputTypeSignature[inputTypeSignature]) {
          let regex = /([ikaSfwbBs.])((?:\[\])*)$/;
          let result = regex.exec(outputTypeSignature);
          if (result) {
            let expectedTypes;
            const outputTypeCharacter = result[1];
            switch (outputTypeCharacter) {
              case 'i': // i-time scalar
              case 'k': // k-rate scalar
              case 'a': // a-rate vector
              case 'S': // string
              case 'f': // frequency-domain variable, used by phase vocoder opcodes
              case 'w': // frequency-domain variable, used by spectrum and related opcodes
              case 'b': // i-time Boolean
              case 'B': // k-rate Boolean
                expectedTypes = [outputTypeCharacter];
                break;
              case 's': // k-rate scalar or a-rate vector
                expectedTypes = ['k', 'a'];
                break;
              case '.': // any type
                expectedTypes = ['i', 'k', 'a', 'S', 'f', 'w'];
                break;
            }
            for (const expectedType of expectedTypes) {
              if (type.charAt(0) === expectedType && (!arraySuffixPredicate || arraySuffixPredicate(expectedType + result[2])))
                return true;
            }
          }
        }
      }
      return false;
    }

    // Variables will have a type property unless they’re undefined. If
    // this.type is undefined, there should already be an error about an
    // undefined variable; return true so that there isn’t another error about
    // an unmatched type.
    if (this.type === undefined)
      return true;

    return type.charAt(0) === this.type.charAt(0) && (!arraySuffixPredicate || arraySuffixPredicate(this.type));
  }

  analyzeSemantics() {
    if (this.children) {
      for (const child of this.children) {
        if (child.analyzeSemantics instanceof Function)
          child.analyzeSemantics();
      }
    }
  }

  analyzeSemanticsOfInputArguments(inputArguments, inputTypeSignatures) {
    class OptionalInputArgumentAnalyzer {
      constructor(defaultValue, inputArgument) {
        this.defaultValue = defaultValue;
        this.inputArgument = inputArgument;
      }

      analyze() {
        return this.inputArgument instanceof NumberLiteral && this.inputArgument.value === this.defaultValue;
      }
    }

    const matchedInputTypeSignatures = [];
    this[matchedInputTypeSignaturesSymbol] = matchedInputTypeSignatures;
    const optionalInputArgumentAnalyzersByMatchedInputTypeSignatures = {};
    this[optionalInputArgumentAnalyzersByMatchedInputTypeSignaturesSymbol] = optionalInputArgumentAnalyzersByMatchedInputTypeSignatures;

    for (const inputTypeSignature of inputTypeSignatures) {
      if (matchedInputTypeSignatures.indexOf(inputTypeSignature) >= 0)
        continue;

      let inputArgumentIndex = 0;
      let inputTypesMatchTypeSignature = true;

      // Maps from characters in input type signatures to input types, from
      // https://github.com/csound/csound/search?q=POLY_IN_TYPES+path%3AEngine+filename%3Acsound_standard_types.c

      // First, handle required (“poly”) input arguments.
      let regex = /([iaSfwblkxTUB.])((?:\[\])*)/y;
      let lastIndex = regex.lastIndex;
      let result;
      while ((result = regex.exec(inputTypeSignature))) {
        lastIndex = regex.lastIndex;

        let expectedTypes;
        let arraySuffixPredicate = type => type.substr(1) === result[2];
        const inputTypeCharacter = result[1];
        switch (inputTypeCharacter) {
          case 'i': // i-time scalar
          case 'a': // a-rate vector
          case 'S': // string
          case 'f': // frequency-domain variable, used by phase vocoder opcodes
          case 'w': // frequency-domain variable, used by spectrum and related opcodes
          case 'b': // i-time Boolean
          case 'l': // label, used by goto opcodes
            expectedTypes = [inputTypeCharacter];
            break;
          case 'k': // i-time or k-rate scalar
            expectedTypes = ['i', 'k'];
            break;
          case 'x': // i-time scalar, k-rate scalar, or a-rate vector
            expectedTypes = ['i', 'k', 'a'];
            break;
          case 'T': // i-time scalar or string
            expectedTypes = ['i', 'S'];
            break;
          case 'U': // i-time scalar, k-rate scalar, or string
            expectedTypes = ['i', 'k', 'S'];
            break;
          case 'B': // i-time or k-rate Boolean
            expectedTypes = ['b', 'B'];
            break;
          case '.': // any type
            // Technically 'b', 'B', and 'l' are also allowed; see
            // https://github.com/csound/csound/issues/685#issuecomment-236439968.
            expectedTypes = ['i', 'k', 'a', 'S', 'f', 'w'];
            arraySuffixPredicate = type => type.endsWith(result[2]);
            break;
        }

        const inputArgument = inputArguments[inputArgumentIndex];

        inputTypesMatchTypeSignature = false;
        if (inputArgument && inputArgument.canBeType instanceof Function) {
          for (const expectedType of expectedTypes) {
            if (inputArgument.canBeType(expectedType + result[2], arraySuffixPredicate)) {
              inputTypesMatchTypeSignature = true;
              break;
            }
          }
        }
        if (inputTypesMatchTypeSignature)
          inputArgumentIndex++;
        else
          break;
      }

      if (!inputTypesMatchTypeSignature)
        continue;

      // Next, handle optional input arguments.
      const optionalInputArgumentAnalyzers = [];

      regex = /[ojvpqhOJVP?]/y;
      regex.lastIndex = lastIndex;
      while (inputArgumentIndex < inputArguments.length && (result = regex.exec(inputTypeSignature))) {
        lastIndex = regex.lastIndex;

        let expectedTypes;
        let defaultValue;
        switch (result[0]) {
          case 'o': // i-time scalar defaulting to 0
            expectedTypes = ['i'];
            defaultValue = 0;
            break;
          case 'j': // i-time scalar defaulting to -1
            expectedTypes = ['i'];
            defaultValue = -1;
            break;
          case 'v': // i-time scalar defaulting to 0.5
            expectedTypes = ['i'];
            defaultValue = 0.5;
            break;
          case 'p': // i-time scalar defaulting to 1
            expectedTypes = ['i'];
            defaultValue = 1;
            break;
          case 'q': // i-time scalar defaulting to 10
            expectedTypes = ['i'];
            defaultValue = 10;
            break;
          case 'h': // i-time scalar defaulting to 127
            expectedTypes = ['i'];
            defaultValue = 127;
            break;
          case 'O': // i-time or k-rate scalar defaulting to 0
            expectedTypes = ['i', 'k'];
            defaultValue = 0;
            break;
          case 'J': // i-time or k-rate scalar defaulting to -1
            expectedTypes = ['i', 'k'];
            defaultValue = -1;
            break;
          case 'V': // i-time or k-rate scalar defaulting to 0.5
            expectedTypes = ['i', 'k'];
            defaultValue = 0.5;
            break;
          case 'P': // i-time or k-rate scalar defaulting to 1
            expectedTypes = ['i', 'k'];
            defaultValue = 1;
            break;
          case '?': // any (scalar) type
            expectedTypes = ['i', 'k', 'a', 'S', 'f', 'w'];
            break;
        }

        const inputArgument = inputArguments[inputArgumentIndex];

        let optionalInputArgumentAnalyzer;
        if (defaultValue === -1) {
          optionalInputArgumentAnalyzer = {
            defaultValue: defaultValue,
            inputArgument: inputArgument
          }
          optionalInputArgumentAnalyzer.analyze = (function() {
            if (this.inputArgument instanceof UnaryOperation && this.inputArgument.children[0] instanceof UnaryMinus) {
              const unaryExpression = this.inputArgument.children[1];
              return unaryExpression instanceof NumberLiteral && unaryExpression.value === 1;
            }
          }).bind(optionalInputArgumentAnalyzer);
        } else {
          optionalInputArgumentAnalyzer = new OptionalInputArgumentAnalyzer(defaultValue, inputArgument);
        }
        optionalInputArgumentAnalyzers.unshift(optionalInputArgumentAnalyzer);

        inputTypesMatchTypeSignature = false;
        if (inputArgument.canBeType instanceof Function) {
          for (const expectedType of expectedTypes) {
            if (inputArgument.canBeType(expectedType)) {
              inputTypesMatchTypeSignature = true;
              break;
            }
          }
        }
        if (inputTypesMatchTypeSignature)
          inputArgumentIndex++;
        else
          break;
      }

      if (!inputTypesMatchTypeSignature)
        continue;

      const lastOptionalInputArgumentIndex = inputArgumentIndex - 1;

      // Finally, handle a variable number of additional input arguments.
      regex = /[mzyWMNnZ*]/y;
      regex.lastIndex = lastIndex;
      // There should be only one variable argument type character.
      if ((result = regex.exec(inputTypeSignature))) {
        let countPredicate;
        let expectedTypesList;
        switch (result[0]) {
          case 'm': // any number of i-time scalars
            countPredicate = count => true;
            expectedTypesList = [['i']];
            break;
          case 'z': // i-time or k-rate scalars
            countPredicate = count => true;
            expectedTypesList = [['i', 'k']];
            break;
          case 'y': // a-rate vectors
            countPredicate = count => true;
            expectedTypesList = [['a']];
            break;
          case 'W': // strings
            countPredicate = count => true;
            expectedTypesList = [['S']];
            break;
          case 'M': // i-time scalars, k-rate scalars, and a-rate vectors
            countPredicate = count => true;
            expectedTypesList = [['i', 'k', 'a']];
            break;
          case 'N': // i-time scalars, k-rate scalars, a-rate vectors, and strings
            countPredicate = count => true;
            expectedTypesList = [['i', 'k', 'a', 'S']];
            break;
          case 'n': // odd number of i-time scalars, used only by tablexseg
            countPredicate = count => (count % 2) === 1;
            expectedTypesList = [['i']];
            break;
          case 'Z': // even number of alternating k-rate scalars and a-rate vectors
            countPredicate = count => count > 0 && (count % 2) === 0;
            expectedTypesList = [['i', 'k'], ['a']];
            break;
          case '*': // any types
            countPredicate = count => true;
            expectedTypes = ['i', 'k', 'a', 'S', 'f', 'w'];
            break;
        }

        if (!countPredicate(inputArguments.length - inputArgumentIndex))
          continue;

        let expectedTypesListIndex = 0;
        for ( ; inputArgumentIndex < inputArguments.length; inputArgumentIndex++) {
          const inputArgument = inputArguments[inputArgumentIndex]
          inputTypesMatchTypeSignature = false;
          if (inputArgument.canBeType instanceof Function) {
            const expectedTypes = expectedTypesList[expectedTypesListIndex];
            for (const expectedType of expectedTypes) {
              if (inputArgument.canBeType(expectedType)) {
                inputTypesMatchTypeSignature = true;
                break;
              }
            }
          }
          if (inputTypesMatchTypeSignature)
            break;
          expectedTypesListIndex++;
          if (expectedTypesListIndex >= expectedTypesList.length)
            expectedTypesListIndex = 0;
        }
      }

      if (!inputTypesMatchTypeSignature)
        continue;

      // The types of the input arguments match the input type signature.
      matchedInputTypeSignatures.push(inputTypeSignature);

      // If the last input argument is optional, save the optional input
      // argument analyzers to use after analyzing output arguments.
      if (lastOptionalInputArgumentIndex === inputArguments.length - 1)
        optionalInputArgumentAnalyzersByMatchedInputTypeSignatures[inputTypeSignature] = optionalInputArgumentAnalyzers;
    }
  }

  analyzeSemanticsOfDeclarator(declarator) {
    let identifier;
    let arrayDimension = 0;
    if (declarator instanceof ArrayDeclarator) {
      identifier = declarator;
      do {
        identifier = identifier.children[0];
        arrayDimension++;
      } while (identifier instanceof ArrayDeclarator);
    } else if (declarator instanceof Identifier) {
      identifier = declarator;
    } else {
      return;
    }

    let symbolTable;
    let type;

    const name = identifier.string;
    let variable = parser.lexer.globalSymbolTable.identifiers[name];
    if (variable) {
      symbolTable = parser.lexer.globalSymbolTable;
      type = variable.type;
    } else {
      const result = /^(g)?([afikSw])/.exec(name);
      if (result) {
        symbolTable = result[1] ? parser.lexer.globalSymbolTable : parser.localSymbolTable;
        type = result[2];
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

    if (type) {
      type += '[]'.repeat(arrayDimension);
      identifier.type = type;
    }

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

  analyzeSemanticsOfOutputTypes(outputTypes) {
    const matchedInputTypeSignatures = this[matchedInputTypeSignaturesSymbol];
    if (!matchedInputTypeSignatures)
      return;

    const possibleInputTypeSignatures = [];

    for (const inputTypeSignature of matchedInputTypeSignatures) {
      if (possibleInputTypeSignatures.indexOf(inputTypeSignature) >= 0)
        continue;

      const matchedOutputTypeSignatures = [];
      for (const outputTypeSignature of this.outputTypeSignaturesByInputTypeSignature[inputTypeSignature]) {
        let outputTypeIndex = 0;
        let outputTypesMatchTypeSignature = true;

        // Maps from characters in output type signatures to output types, from
        // https://github.com/csound/csound/search?q=POLY_OUT_TYPES+path%3AEngine+filename%3Acsound_standard_types.c

        // First, handle required (“poly”) output arguments.
        let regex = /([ikaSsfw.])((?:\[\])*)/y;
        let lastIndex = regex.lastIndex;
        let result;
        while ((result = regex.exec(outputTypeSignature))) {
          lastIndex = regex.lastIndex;

          let expectedTypes;
          let arraySuffixPredicate = type => type.substr(1) === result[2];
          const outputTypeCharacter = result[1];
          switch (outputTypeCharacter) {
            case 'i': // i-time scalar
            case 'k': // k-rate scalar
            case 'a': // a-rate vector
            case 'S': // string
            case 'f': // frequency-domain variable, used by phase vocoder opcodes
            case 'w': // frequency-domain variable, used by spectrum and related opcodes
              expectedTypes = [outputTypeCharacter];
              break;
            case 's': // k-rate scalar or a-rate vector
              expectedTypes = ['k', 'a'];
              break;
            case '.': // any type
              expectedTypes = ['i', 'k', 'a', 'S', 'f', 'w'];
              arraySuffixPredicate = type => type.endsWith(result[2]);
              break;
          }

          outputTypesMatchTypeSignature = false;
          const outputType = outputTypes[outputTypeIndex];
          for (const expectedType of expectedTypes) {
            if (outputType.charAt(0) === expectedType && arraySuffixPredicate(outputType)) {
              outputTypesMatchTypeSignature = true;
              break;
            }
          }
          if (outputTypesMatchTypeSignature)
            outputTypeIndex++;
          else
            break;
        }

        if (!outputTypesMatchTypeSignature)
          continue;

        // Then, handle a variable number of additional output arguments.
        regex = /[IzmXNF*]/y;
        regex.lastIndex = lastIndex;
        // Allow only one variable argument type character.
        if ((result = regex.exec(outputTypeSignature))) {
          let expectedTypes;
          switch (result[0]) {
            case 'I': // i-time scalars and strings
              expectedTypes = ['i', 'S'];
              break;
            case 'z': // k-rate scalars
              expectedTypes = ['k'];
              break;
            case 'm': // a-rate vectors
              expectedTypes = ['a'];
              break;
            case 'X': // i-time scalars, k-rate scalars, and a-rate vectors
              expectedTypes = ['i', 'k', 'a'];
              break;
            case 'N': // i-time scalars, k-rate scalars, a-rate vectors, and strings
              expectedTypes = ['i', 'k', 'a', 'S'];
              break;
            case 'F': // frequency-domain variables
              expectedTypes = ['f'];
              break;
            case '*': // any types
              expectedTypes = ['i', 'k', 'a', 'S', 'f', 'w'];
              break;
          }

          for ( ; outputTypeIndex < outputTypes.length && outputTypesMatchTypeSignature; outputTypeIndex++) {
            outputTypesMatchTypeSignature = expectedTypes.indexOf(outputTypes[outputTypeIndex]) >= 0;
          }
        }

        if (outputTypesMatchTypeSignature)
          matchedOutputTypeSignatures.push(outputTypeSignature);
      }

      if (matchedOutputTypeSignatures.length > 0)
        possibleInputTypeSignatures.push(inputTypeSignature);
    }

    if (possibleInputTypeSignatures.length === 0) {
      const error = this.makeTypeSemanticsError();
      error.severity = 'error';
      error.excerpt = `Output argument types do not match type signatures${error.excerpt}`;
      parser.addError(error);
      return;
    }

    if (possibleInputTypeSignatures.length > 1) {
      const error = this.makeTypeSemanticsError();
      error.severity = 'warning';
      error.excerpt = `Input arguments match multiple type signatures${error.excerpt}`;
      parser.addError(error);
    }

    const optionalInputArgumentAnalyzers = this[optionalInputArgumentAnalyzersByMatchedInputTypeSignaturesSymbol][possibleInputTypeSignatures[0]];
    if (optionalInputArgumentAnalyzers) {
      for (const optionalInputArgumentAnalyzer of optionalInputArgumentAnalyzers) {
        if (optionalInputArgumentAnalyzer.analyze()) {
          parser.messages.push({
            severity: 'warning',
            location: {
              position: optionalInputArgumentAnalyzer.inputArgument.range
            },
            excerpt: `Passing default value of ${optionalInputArgumentAnalyzer.defaultValue} is unnecessary`
          });
        } else {
          break;
        }
      }
    }
  }

  makeTypeSemanticsError() {
    return {
      location: {
        position: this.range
      },
      excerpt: ''
    };
  }
}

class Identifier extends ASTNode {
  analyzeSemantics() {
    let symbol = parser.localSymbolTable.identifiers[this.string];
    if (!symbol)
      symbol = parser.lexer.globalSymbolTable.identifiers[this.string];
    if (symbol) {
      if (symbol.kind === 'variable')
        this.type = symbol.type;
    } else {
      // Check whether the identifier is for a p-field.
      const result = /p(\d+)/.exec(this.string);
      if (result) {
        this.type = 'i'; // Csound uses a type of 'p' for p-fields.
        if (parser.localSymbolTable === parser.lexer.globalSymbolTable || result[1] === '0') {
          parser.messages.push({
            severity: 'warning',
            location: {
              position: this.range
            },
            excerpt: 'Value of p-field is always 0'
          });
        }
      } else {
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
}

class ArrayDeclarator extends ASTNode {
  get type() { return this.children[0].type; }
}

class NumberLiteral extends ASTNode {
  constructor(rangeOrLocation, properties) {
    super(rangeOrLocation, properties);
    this.value = /^0[Xx]/.test(this.string) ? parseInt(this.string, 16) : Number(this.string);
  }
  get type() { return 'i'; } // Csound uses a type of 'c' for numeric constants.
}

class StringLiteral extends ASTNode {
  get type() { return 'S'; }
}

class ArrayMember extends ASTNode {}

class OpcodeExpression extends ASTNode {
  get opcodeIdentifier() { return this.children[0]; }
  get opcode() { return parser.lexer.globalSymbolTable.identifiers[this.opcodeIdentifier.string]; }
  get inputTypeSignatures() { return this.opcode.inputTypeSignatures; }
  get outputTypeSignaturesByInputTypeSignature() { return this.opcode.outputTypeSignaturesByInputTypeSignature; }

  analyzeSemantics() {
    super.analyzeSemantics();

    if (this.children.length > 1) {
      this.analyzeSemanticsOfInputArguments(this.children[1].children, this.inputTypeSignatures);
      if (this[matchedInputTypeSignaturesSymbol].length === 0) {
        const error = this.makeTypeSemanticsError();
        error.severity = 'error';
        error.excerpt = `Input argument types do not match type signatures${error.excerpt}`;
        parser.addError(error);
      }
    }
  }

  makeTypeSemanticsError() {
    return {
      location: {
        position: this.opcodeIdentifier.range
      },
      excerpt: ` of opcode ${parser.lexer.quote(this.opcodeIdentifier.string)}`
    };
  }
}

class UnaryOperator extends ASTNode {
  get outputTypeSignaturesByInputTypeSignature() {
    return {
      'i': 'i',
      'k': 'k'
    };
  }
  get inputTypeSignatures() { return Object.keys(this.outputTypeSignaturesByInputTypeSignature); }
}
class UnaryPlus extends UnaryOperator {}
class UnaryMinus extends UnaryOperator {}
class BitwiseComplement extends UnaryOperator {}

class UnaryOperation extends ASTNode {
  get operator() { return this.children[0]; }
  get outputTypeSignaturesByInputTypeSignature() { return this.operator.outputTypeSignaturesByInputTypeSignature; }
  get inputTypeSignatures() { return this.operator.inputTypeSignatures; }

  analyzeSemantics() {
    super.analyzeSemantics();
    this.analyzeSemanticsOfInputArguments([this.children[1]], this.inputTypeSignatures);
  }
}

class Not extends ASTNode {}

class BinaryOperator extends ASTNode {
  get inputTypeSignatures() { return Object.keys(this.outputTypeSignaturesByInputTypeSignature); }
}

class ArithmeticOperator extends BinaryOperator {
  get outputTypeSignaturesByInputTypeSignature() {
    return {
      'ii': 'i',
      'kk': 'k',
      'ka': 'a',
      'ak': 'a',
      'aa': 'a'
    };
  }
}
class Plus extends ArithmeticOperator {}
class Minus extends ArithmeticOperator {}
class Multiplication extends ArithmeticOperator {}
class Division extends ArithmeticOperator {}
class Modulus extends ArithmeticOperator {}
class Power extends ArithmeticOperator {}

class BitwiseAND extends ArithmeticOperator {}
class BitwiseOR extends ArithmeticOperator {}
class BitwiseXOR extends ArithmeticOperator {}
class LeftShift extends ArithmeticOperator {}
class RightShift extends ArithmeticOperator {}

class RelationalOperator extends BinaryOperator {
  get outputTypeSignaturesByInputTypeSignature() {
    return {
      'ii': 'b',
      'kk': 'B'
    };
  }
}
class LessThan extends RelationalOperator {}
class GreaterThan extends RelationalOperator {}
class LessThanOrEqual extends RelationalOperator {}
class GreaterThanOrEqual extends RelationalOperator {}
class Equal extends RelationalOperator {}
class NotEqual extends RelationalOperator {}

class LogicalOperator extends BinaryOperator {
  get outputTypeSignaturesByInputTypeSignature() {
    return {
      'bb': 'b',
      'BB': 'B'
    };
  }
}
class And extends LogicalOperator {}
class Or extends LogicalOperator {}

class BinaryOperation extends ASTNode {
  get operator() { return this.children[1]; }
  get outputTypeSignaturesByInputTypeSignature() { return this.operator.outputTypeSignaturesByInputTypeSignature; }
  get inputTypeSignatures() { return this.operator.inputTypeSignatures; }

  analyzeSemantics() {
    super.analyzeSemantics();
    this.analyzeSemanticsOfInputArguments([this.children[0], this.children[2]], this.inputTypeSignatures);
  }
}

class TestAndBodyNode extends ASTNode {
  get test() { return this.children[0]; }
  get body() { return this.children[1]; }
}

class ConditionalExpression extends TestAndBodyNode {
  get outputTypeSignaturesByInputTypeSignature() {
    return {
      'bii': 'i',
      'Bkk': 'k',
      'Bxx': 'a',
      'BSS': 'S'
    };
  }
  get inputTypeSignatures() { return Object.keys(this.outputTypeSignaturesByInputTypeSignature); }

  analyzeSemantics() {
    super.analyzeSemantics();

    this.analyzeSemanticsOfInputArguments([this.test], this.inputTypeSignatures);
    if (!(this.test.canBeType('b') || this.test.canBeType('B'))) {
      parser.messages.push({
        severity: 'error',
        location: {
          position: this.test.range
        },
        excerpt: 'Condition of conditional expression is not a Boolean expression'
      });
    }
  }
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

class Assignment extends ASTNode {
  get declarator() { return this.children[0]; }
  get expression() { return this.children[1]; }
  get outputTypeSignaturesByInputTypeSignature() {
    return {
      'S': 'S',

      // TODO: This is in
      // https://github.com/csound/csound/search?q=strcpy_opcode_p+path%3AEngine+filename%3Aentry1.c,
      // seemingly for assigning to a string variable from a p-field, but it
      // permits statements like STest = 0dbfs.
      'i': 'S',

      'i': 'i',
      'k': 'k',
      'a': 'a',
      'k': 'a',
      'a': 'k'
    };
  }
  get inputTypeSignatures() { return Object.keys(this.outputTypeSignaturesByInputTypeSignature); }

  analyzeSemantics() {
    this.analyzeSemanticsOfDeclarator(this.declarator);

    super.analyzeSemantics();

    this.analyzeSemanticsOfInputArguments([this.expression], this.inputTypeSignatures);
  }
}
class CompoundAssignment extends ASTNode {}

class InputArgumentList extends ASTNode {}
class OutputArgumentList extends ASTNode {
  analyzeSemantics() {
    for (const outputArgument of this.children) {
      this.analyzeSemanticsOfDeclarator(outputArgument);
    }
  }
}

class VoidOpcodeStatement extends ASTNode {}

class OpcodeStatement extends VoidOpcodeStatement {
  get opcodeExpression() { return this.children[1]; }

  analyzeSemantics() {
    super.analyzeSemantics();

    const outputTypes = [];
    for (const declarator of this.children[0].children) {
      outputTypes.push(declarator.type);
    }
    this.opcodeExpression.analyzeSemanticsOfOutputTypes(outputTypes);
  }
}

class Goto extends ASTNode {
  get label() { return this.children[0]; }

  analyzeSemantics() {
    if (!parser.localSymbolTable.labels[this.label.string]) {
      parser.addError({
        severity: 'error',
        location: {
          position: this.range
        },
        excerpt: `Use of undefined label ${parser.lexer.quote(this.label.string)}`
      });
    }
  }
}

class If extends TestAndBodyNode {
  analyzeSemantics() {
    super.analyzeSemantics();

    if (!(this.test.canBeType('b') || this.test.canBeType('B'))) {
      parser.messages.push({
        severity: 'error',
        location: {
          position: this.test.range
        },
        excerpt: 'Condition of if-statement is not a Boolean expression'
      });
    }
  }
}
class Then extends ASTNode {}
class Else extends ASTNode {}

class While extends TestAndBodyNode {
  analyzeSemantics() {
    super.analyzeSemantics();

    if (!(this.test.canBeType('b') || this.test.canBeType('B'))) {
      parser.messages.push({
        severity: 'error',
        location: {
          position: this.test.range
        },
        excerpt: 'Condition of while-loop is not a Boolean expression'
      });
    }
  }
}
class Until extends TestAndBodyNode {
  analyzeSemantics() {
    super.analyzeSemantics();

    if (!(this.test.canBeType('b') || this.test.canBeType('B'))) {
      parser.messages.push({
        severity: 'error',
        location: {
          position: this.test.range
        },
        excerpt: 'Condition of until-loop is not a Boolean expression'
      });
    }
  }
}
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
  InputArgumentList: InputArgumentList,
  OutputArgumentList: OutputArgumentList,
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
