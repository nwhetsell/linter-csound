const fs = require("fs");
const path = require("path");
const Jison = require(path.join("..", "..", "node_modules", "jison-gho", "dist", "jison-cjs-es5.js"));
const RegExpLexer = require(path.join("..", "..", "node_modules", "jison-gho", "packages", "jison-lex", "dist", "regexp-lexer-cjs-es5.js"));

let options = {
  moduleName: "CsoundDocumentProcessor",
  outfile: "document-processor.js"
};
let code = RegExpLexer.generate(fs.readFileSync("document-processor.jisonlex", "utf-8"), null, options);
function writeCode(code) {
  fs.writeFileSync(options.outfile, code.replace(/ +$/gm, "") + "\n");
}
writeCode(code);

options = {
  moduleName: "CsoundPreprocessor",
  outfile: "preprocessor.js"
};
code = RegExpLexer.generate(fs.readFileSync("preprocessor.jisonlex", "utf-8"), null, options);
writeCode(code);

options = {
  moduleName: "CsoundOrchestraParser",
  outfile: "orchestra-parser.js"
};
options = Jison.mkStdOptions(options);
code = (new Jison.Generator(fs.readFileSync("orchestra.jison", "utf-8"), fs.readFileSync("orchestra.jisonlex", "utf-8"), options)).generate(options);
writeCode(code);
