path = require('path')
{Range} = require('atom')

documentProcessor = require(path.join(__dirname, 'csound-parser', 'document-processor.js')).lexer
preprocessor = require(path.join(__dirname, 'csound-parser', 'preprocessor.js')).lexer
CsoundOrchestraParser = require(path.join(__dirname, 'csound-parser', 'orchestra-parser.js')).Parser
SymbolTable = require(path.join(__dirname, 'csound-parser', 'symbol-table.js'))

module.exports =
LinterCsound =
  config:
    includeDirectories:
      title: 'Directories for included files'
      type: 'array'
      description: 'Comma-separated list of directories for `#include` search'
      default: []
      items:
        type: 'string'

  provideLinter: ->
    return {
      name: 'Csound'
      grammarScopes: ['source.csound', 'source.csound-document']
      scope: 'file'
      lintsOnChange: true

      lint: (editor) ->
        return new Promise((resolve) ->
          if editor.getRootScopeDescriptor().getScopesArray()[0] is 'source.csound-document'
            documentProcessor.filePath = editor.getPath()
            documentProcessor.setInput(editor.getText())
            try
              documentProcessor.lex()
            catch error
              if error.lintMessage
                return resolve([error.lintMessage])
              throw error
            orchestraString = '\n'.repeat(documentProcessor.orchestraElementRange[0][0]) + ' '.repeat(documentProcessor.orchestraElementRange[1][1]) + documentProcessor.orchestra
          else
            orchestraString = editor.getText()

          # Preprocess the orchestra.
          preprocessor.filePath = editor.getPath()
          preprocessor.includeDirectories = atom.config.get('linter-csound.includeDirectories')
          preprocessor.setInput(orchestraString)
          preprocessor.currentDirectories = atom.project.getPaths()
          try
            preprocessor.lex()
          catch error
            if error.lintMessage
              return resolve([error.lintMessage])
            throw error
          for message in preprocessor.messages
            if message.severity is 'error'
              return resolve(preprocessor.messages)

          # Parse the orchestra.
          parser = new CsoundOrchestraParser
          parser.__lexer__ = parser.lexer
          parser.lexer.SymbolTable = SymbolTable
          parser.yy.pre_parse = (yy) -> yy.lexer.sourceMap = preprocessor.sourceMap
          try
            parser.parse(preprocessor.getOutput())
          catch error
            lintMessage = error.hash.exception?.lintMessage
            if lintMessage
              lintMessage.location.file = editor.getPath()
              parser.messages.push(lintMessage)
            else
              parser.messages.push({
                severity: 'error'
                location: {
                  file: editor.getPath()
                  position: parser.lexer.rangeFromPosition(error.hash.loc.first_line, error.hash.loc.first_column)
                }
                excerpt: error.message
              })

          # Combine messages from document processor, preprocessor, lexer, and
          # parser.
          messages = []
          if documentProcessor
            messages.push(documentProcessor.messages...)
          messages.push(preprocessor.messages...)
          for message in [parser.lexer.messages..., parser.messages...]
            message.location.file = editor.getPath()
            messages.push(message)
          # Sort messages by position.
          messages.sort((message1, message2) -> Range.fromObject(message1.location.position).compare(message2.location.position))
          # Add traces.
          for message, index in messages by -1
            continue unless message.trace
            for trace in message.trace
              trace.location.file ?= editor.getPath()
              messages.splice(index + 1, 0, trace)

          resolve(messages)
        )
    }
