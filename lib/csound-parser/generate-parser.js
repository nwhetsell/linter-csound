const fs = require('fs');
const path = require('path');
const Jison = require(path.join('..', '..', 'node_modules', 'jison-gho', 'lib', 'jison.js'));
const RegExpLexer = require(path.join('..', '..', 'node_modules', 'jison-lex', 'regexp-lexer.js'));

let options = {
  moduleName: 'CsoundPreprocessor',
  moduleType: 'js',
  outfile: 'preprocessor.js'
};
let code = RegExpLexer.generate(fs.readFileSync('preprocessor.jisonlex', 'utf-8'), null, options);
let regex = new RegExp(`^var +${options.moduleName} *= *`, 'm');
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
const generator = new Jison.Generator(fs.readFileSync('orchestra.jison', 'utf-8'), fs.readFileSync('orchestra.jisonlex', 'utf-8'), options);
code = generator.generate(options);
regex = new RegExp(`^var +${options.moduleName} *= *`, 'm');
code =
`${code.replace(regex, '(function(require) {\nconst parser = ')}
return parser;
})
`;
fs.writeFileSync(options.outfile, code.replace(/ +$/gm, ''));
