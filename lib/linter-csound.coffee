csound = require 'csound-api'
path = require 'path'
preprocessor = require path.join __dirname, 'csound-parser', 'preprocessor.js'
{Range} = require 'atom'
SymbolTable = require path.join __dirname, 'csound-parser', 'symbol-table.js'

orchestraParserPath = path.join __dirname, 'csound-parser', 'orchestra-parser.js'

module.exports =
LinterCsound =
  provideLinter: ->
    return {
      name: 'Csound'
      grammarScopes: ['source.csound']
      scope: 'file'
      lintsOnChange: true

      lint: (editor) ->
        return new Promise (resolve, reject) ->
          # Preprocess the orchestra.
          preprocessor.filePath = editor.getPath()
          preprocessor.setInput editor.getText()
          try
            preprocessor.lex()
          catch error
            if error.lintMessage
              resolve [error.lintMessage]
            else
              throw error

          # Parse the orchestra.
          delete require.cache[orchestraParserPath]
          parser = require orchestraParserPath
          parser.yy.pre_parse = () ->
            parser.lexer.sourceMap = preprocessor.sourceMap
            Object.assign parser.lexer.symbolTable.identifiers, SymbolTable.builtInOpcodeSymbolTable.identifiers
          try
            orchestra = parser.parse preprocessor.getOutput()
          catch error
            lintMessage = error.hash.exception?.lintMessage
            if lintMessage
              lintMessage.location.file = editor.getPath()
              parser.messages.push lintMessage
            else
              parser.messages.push {
                severity: 'error'
                location: {
                  file: editor.getPath(),
                  position: parser.lexer.rangeFromPosition error.hash.loc.first_line, error.hash.loc.first_column
                }
                excerpt: error.message
              }

          # Combine messages from preprocessor, lexer, and parser.
          messages = preprocessor.messages
          for message in [parser.lexer.messages..., parser.messages...]
            message.location.file = editor.getPath()
            messages.push message
          # Sort messages by position.
          messages.sort (message1, message2) ->
            (Range.fromObject message1.location.position).compare message2.location.position
          # Add traces.
          for message, index in messages by -1
            continue unless message.trace
            for trace in message.trace
              trace.location.file ?= editor.getPath()
              messages.splice index + 1, 0, trace

          resolve messages
    }
