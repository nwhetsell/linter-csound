const fs = require('fs');
const path = require('path');
const Jison = require(path.join('..', '..', 'node_modules', 'jison-gho', 'lib', 'jison.js'));
const RegExpLexer = require(path.join('..', '..', 'node_modules', 'jison-gho', 'lib', 'util', 'regexp-lexer.js'));

let options = {
  moduleName: 'CsoundDocumentProcessor',
  moduleType: 'js',
  outfile: 'document-processor.js'
};
let code = RegExpLexer.generate(fs.readFileSync('document-processor.jisonlex', 'utf-8'), null, options);
let regex = new RegExp(`^var +${options.moduleName} *= *`, 'm');
code =
`${code.replace(regex, '(function(require) {\nconst lexer = ')}
return lexer;
})
`;
fs.writeFileSync(options.outfile, code.replace(/ +$/gm, ''));

options = {
  moduleName: 'CsoundPreprocessor',
  moduleType: 'js',
  outfile: 'preprocessor.js'
};
code = RegExpLexer.generate(fs.readFileSync('preprocessor.jisonlex', 'utf-8'), null, options);
regex = new RegExp(`^var +${options.moduleName} *= *`, 'm');
code =
`${code.replace(regex, '(function(require) {\nconst lexer = ')}
return lexer;
})
`;
fs.writeFileSync(options.outfile, code.replace(/ +$/gm, ''));

options = {
  moduleName: 'CsoundOrchestraParser',
  moduleType: 'js',
  outfile: 'orchestra-parser.js'
};
options = Jison.mkStdOptions(options);

// This is a workaround for https://github.com/GerHobbelt/jison/issues/12.
const grammar = fs.readFileSync('orchestra.jison', 'utf-8').replace(
  /^    \{/gm,
  '    { @$ = {first_line: yylstack[yysp - (yyrulelength - 1)].first_line, first_column: yylstack[yysp - (yyrulelength - 1)].first_column, last_line: yylstack[yysp].last_line, last_column: yylstack[yysp].last_column};'
);

code = (new Jison.Generator(grammar, fs.readFileSync('orchestra.jisonlex', 'utf-8'), options)).generate(options);
regex = new RegExp(`^var +${options.moduleName} *= *`, 'm');
code =
`${code.replace(regex, '(function(require) {\nconst parser = ')}
return parser;
})
`;
fs.writeFileSync(options.outfile, code.replace(/ +$/gm, ''));
