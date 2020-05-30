const {Range} = require("atom");
const path = require("path");

const documentProcessor = require(path.join(__dirname, "csound-parser", "document-processor.js")).lexer;
const preprocessor = require(path.join(__dirname, "csound-parser", "preprocessor.js")).lexer;
const CsoundOrchestraParser = require(path.join(__dirname, "csound-parser", "orchestra-parser.js")).Parser;
const SymbolTable = require(path.join(__dirname, "csound-parser", "symbol-table.js"));

module.exports = {
  config: {
    includeDirectories: {
      title: "Directories for included files",
      type: "array",
      description: "Comma-separated list of directories for `#include` search",
      default: [],
      items: {
        type: "string"
      }
    }
  },

  provideLinter() {
    return {
      name: "Csound",
      grammarScopes: ["source.csound", "source.csound-document"],
      scope: "file",
      lintsOnChange: true,

      lint(editor) {
        return new Promise(resolve => {
          let orchestraString;
          if (editor.getRootScopeDescriptor().getScopesArray()[0] === "source.csound-document") {
            documentProcessor.filePath = editor.getPath();
            documentProcessor.setInput(editor.getText());
            try {
              documentProcessor.lex();
            } catch (error) {
              if (error.lintMessage)
                return resolve([error.lintMessage]);
              throw error;
            }
            orchestraString = "\n".repeat(documentProcessor.orchestraElementRange[0][0]) + " ".repeat(documentProcessor.orchestraElementRange[1][1]) + documentProcessor.orchestra;
          } else {
            orchestraString = editor.getText();
          }

          // Preprocess the orchestra.
          preprocessor.filePath = editor.getPath();
          preprocessor.includeDirectories = atom.config.get("linter-csound.includeDirectories");
          preprocessor.setInput(orchestraString);
          preprocessor.currentDirectories = atom.project.getPaths();
          try {
            preprocessor.lex();
          } catch (error) {
            if (error.lintMessage)
              return resolve([error.lintMessage]);
            throw error;
          }
          for (const message of preprocessor.messages) {
            if (message.severity === "error")
              return resolve(preprocessor.messages);
          }

          // Parse the orchestra.
          const parser = new CsoundOrchestraParser();
          parser.__lexer__ = parser.lexer;
          parser.lexer.SymbolTable = SymbolTable;
          parser.yy.pre_parse = yy => yy.lexer.sourceMap = preprocessor.sourceMap;
          try {
            parser.parse(preprocessor.getOutput());
          } catch (error) {
            if (error.hash.exception) {
              const lintMessage = error.hash.exception.lintMessage;
              if (lintMessage) {
                lintMessage.location.file = editor.getPath();
                parser.messages.push(lintMessage);
              } else {
                parser.messages.push({
                  severity: "error",
                  location: {
                    file: editor.getPath(),
                    position: parser.lexer.rangeFromPosition(error.hash.loc.first_line, error.hash.loc.first_column)
                  },
                  excerpt: error.message
                });
              }
            }
          }

          // Combine messages from document processor, preprocessor, lexer, and
          // parser.
          const messages = [];
          if (documentProcessor.messages)
            messages.push(...documentProcessor.messages);
          messages.push(...preprocessor.messages);
          for (const message of [...parser.lexer.messages, ...parser.messages]) {
            message.location.file = editor.getPath();
            messages.push(message);
          }
          // Sort messages by position.
          messages.sort((message1, message2) => Range.fromObject(message1.location.position).compare(message2.location.position));
          // Add traces.
          for (let index = messages.length - 1; index >= 0; index--) {
            const message = messages[index];
            if (message.trace) {
              for (const trace of message.trace) {
                if (!trace.location.file)
                  trace.location.file = editor.getPath();
                messages.splice(index + 1, 0, trace);
              }
            }
          }

          resolve(messages);
        });
      }
    };
  }
};
