const fs = require('fs');
const path = require('path');
const Jison = require(path.join('..', '..', 'node_modules', 'jison-gho', 'dist', 'jison-cjs-es5.js'));
const RegExpLexer = require(path.join('..', '..', 'node_modules', 'jison-gho', 'packages', 'jison-lex', 'dist', 'regexp-lexer-cjs-es5.js'));

let options = {
  moduleName: 'CsoundDocumentProcessor',
  outfile: 'document-processor.js'
};
let code = RegExpLexer.generate(fs.readFileSync('document-processor.jisonlex', 'utf-8'), null, options);
const istanbulIgnoreRegexes = [
  /^    editRemainingInput:/m,
  /^    input:/m,
  /^    unput:/m,
  /^    more:/m,
  /^    reject:/m,
  /^    less:/m,
  /^    pastInput:/m,
  /^    upcomingInput:/m,
  /^    showPosition:/m,
  /^    deriveLocationInfo:/m,
  /^    prettyPrintRange:/m,
  /^    describeYYLLOC:/m
];
const writeCode = code => {
  for (let regex of istanbulIgnoreRegexes) {
    const result = regex.exec(code);
    const index = result.index + result[0].length;
    code = code.substr(0, index) + ' /* istanbul ignore next */' + code.substr(index);
  }
  fs.writeFileSync(options.outfile, code.replace(/ +$/gm, '') + '\n');
};
writeCode(code);

options = {
  moduleName: 'CsoundPreprocessor',
  outfile: 'preprocessor.js'
};
code = RegExpLexer.generate(fs.readFileSync('preprocessor.jisonlex', 'utf-8'), null, options);
writeCode(code);

options = {
  moduleName: 'CsoundOrchestraParser',
  outfile: 'orchestra-parser.js'
};
options = Jison.mkStdOptions(options);
code = (new Jison.Generator(fs.readFileSync('orchestra.jison', 'utf-8'), fs.readFileSync('orchestra.jisonlex', 'utf-8'), options)).generate(options);
writeCode(code);
