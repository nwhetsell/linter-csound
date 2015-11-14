csound = require 'csound-api'

module.exports =
LinterCsound =
  provideLinter: ->
    return {
      name: 'Csound'
      grammarScopes: ['source.csound', 'source.csound-document']
      scope: 'file'
      lintOnFly: true

      lint: (editor) ->
        return new Promise (resolve, reject) ->
          messages = []

          Csound = csound.Create()
          csound.CreateMessageBuffer Csound
          if editor.getGrammar().name is 'Csound Document'
            # The Csound API function csoundCompileCsd can call csoundCompile,
            # which calls csoundStart
            # (https://github.com/csound/csound/blob/develop/Top/main.c#L494).
            # FLTK windows are created when Csound starts
            # (https://github.com/csound/csound/issues/555), so csoundCompileCsd
            # cannot be used for linting CSD files. The API function
            # csoundCompileCsdText added in commit 6770316
            # (https://github.com/csound/csound/commit/6770316cd9fd6e9c55f9730910a0a6c09a671c20)
            # calls csoundCompileCsd with the path of a temporary CSD file, so
            # it cannot be used for linting CSD files either.
            csound.CompileArgs Csound, ['csound', editor.getPath()]
            parseRow = (rowString) -> return Number(rowString) - 1
          else
            csound.CompileOrc Csound, editor.getText()
            # Before version 6.06.0, Csound numbered lines in orchestras
            # starting from 0 and lines in CSD files starting from 1; see
            # https://github.com/csound/csound/issues/546.
            if csound.GetVersion() < 6060
              parseRow = (rowString) -> return Number rowString
            else
              parseRow = (rowString) -> return Number(rowString) - 1
          csound.Cleanup Csound

          while csound.GetMessageCnt(Csound) > 0
            errorMessage = csound.GetFirstMessage Csound
            csound.PopFirstMessage Csound

            # Error messages begin with “error:”.
            regex = /^error:/gm
            result = regex.exec errorMessage
            continue unless result

            result = /from file/.exec csound.GetFirstMessage Csound
            if result
              csound.PopFirstMessage Csound

            # Get the line at which the error occurs and proceed only if it is
            # between 0 and the number of lines in the text editor. Csound
            # versions 6.05.0 and likely earlier have an issue where repeated
            # compilation can result in invalid lines being reported; see
            # https://github.com/csound/csound/issues/540.
            result = /line (-?\d+):/.exec csound.GetFirstMessage Csound
            csound.PopFirstMessage Csound
            continue unless result
            row = parseRow result[1]
            continue unless 0 <= row <= editor.getLineCount()

            # Token types are preceded by the word “unexpected”.
            lastIndex = regex.lastIndex
            regex = /unexpected (\w+|'.')/g
            regex.lastIndex = lastIndex
            result = regex.exec errorMessage
            continue unless result
            tokenType = result[1]

            # Find where the token begins in the error message.
            lastIndex = regex.lastIndex
            regex = /\(token "/g
            regex.lastIndex = lastIndex
            result = regex.exec errorMessage
            continue unless result

            # The token may be a quoted string. Count the number of quotes at
            # the beginning of the string to determine where the token ends.
            quoteCount = 0
            index = regex.lastIndex
            while errorMessage.charAt(index) is '"' and index < errorMessage.length
              quoteCount++
              index++
            while index < errorMessage.length
              character = errorMessage.charAt index
              if character is '\\'
                index++
              # Csound seems to use the line where a token ends when reporting
              # syntax errors. If a token contains a newline, then the error
              # will be marked at the wrong line; see
              # https://github.com/csound/csound/issues/544.
              else if character is '\n'
                row--
              else if character is '"'
                if quoteCount is 0
                  token = errorMessage.substring(regex.lastIndex, index).trim()
                  break
                quoteCount--
              index++

            lintMessage = {
              type: 'Error'
              filePath: editor.getPath()
            }
            messages.push lintMessage

            switch tokenType
              when 'NEWLINE'
                csound.PopFirstMessage Csound until /<<</.test csound.GetFirstMessage Csound
                csound.PopFirstMessage Csound
                lintMessage.text = csound.GetFirstMessage(Csound).trim()
                csound.PopFirstMessage Csound
                result = /Unexpected untyped word (\w+)/.exec lintMessage.text
                if result
                  token = result[1]
                  result = (new RegExp '\\b' + token + '\\b').exec editor.lineTextForBufferRow row
                  if result
                    lintMessage.range = [[row, result.index], [row, result.index + token.length]]
                else
                  length = editor.lineTextForBufferRow(row).length
                  if length > 0
                    lintMessage.range = [[row, length - 1], [row, length]]
                  lintMessage.text = 'Unexpected end of line'
              when 'STRING_TOKEN'
                lintMessage.text = 'Unexpected string '
                # If an unexpected string token is an empty string, then token
                # will be undefined.
                if token is undefined
                  lintMessage.text += '""'
                else
                  lintMessage.text += token
              else
                lintMessage.text = 'Unexpected token ' + token

            if lintMessage.range is undefined
              lintMessage.range = [[row, 0], [row, 0]]

          csound.DestroyMessageBuffer Csound
          csound.Destroy Csound

          resolve messages
    }
