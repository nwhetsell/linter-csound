describe 'linter-csound', ->
  lint = require('../lib/linter-csound').provideLinter().lint

  beforeEach ->
    waitsForPromise ->
      atom.packages.activatePackage 'linter-csound'

  it 'finds an unexpected untyped word', ->
    waitsForPromise ->
      atom.workspace.open().then (editor) ->
        editor.setText 'foo\n'
        lint(editor).then (messages) ->
          expect(messages.length).toEqual 1
          message = messages[0]
          expect(message.type).toEqual 'Error'
          expect(message.text).toEqual 'Unexpected untyped word foo when expecting a variable'

  it 'finds an unexpected string', ->
    waitsForPromise ->
      atom.workspace.open().then (editor) ->
        editor.setText '"foo"\n'
        lint(editor).then (messages) ->
          expect(messages.length).toEqual 1
          message = messages[0]
          expect(message.type).toEqual 'Error'
          expect(message.text).toEqual 'Unexpected string "foo"'

  it 'finds an unexpected end of line', ->
    waitsForPromise ->
      atom.workspace.open().then (editor) ->
        editor.setText '0dbfs = \n'
        lint(editor).then (messages) ->
          expect(messages.length).toEqual 1
          message = messages[0]
          expect(message.type).toEqual 'Error'
          expect(message.text).toEqual 'Unexpected end of line'
