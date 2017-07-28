synthesizer_element_name "CsoundSynthesi"[sz]"er"
synthesizer_end_tag "</"{synthesizer_element_name}">"

newline \n|\r\n?

%x synthesizer

%x orchestra
%x score

%x block_comment

%x quoted_string
%x braced_string

%%

"<"{synthesizer_element_name}">"
%{
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.synthesizerElementName = yytext.substring(1, yyleng - 1);
  this.begin('synthesizer');
%}
{synthesizer_end_tag}
%{
  throw new CsoundDocumentProcessorError({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.rangeFromLocation(yylloc)
    },
    excerpt: `End tag ${yytext} without start tag`
  });
%}
<<EOF>>
%{
  if (!this.synthesizerElementName) {
    throw new CsoundDocumentProcessorError({
      severity: 'error',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: 'No CsoundSynthesizer element'
    });
  }
%}

<synthesizer>{synthesizer_end_tag}
%{
  this.popState();
  const startElementRange = this.startRanges.pop();
  if (this.synthesizerElementName !== yytext.substring(2, yyleng - 1)) {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: `End tag ${yytext} does not match start tag <${this.synthesizerElementName}>`,
      trace: [{
        severity: 'info',
        location: {
          file: this.filePath,
          position: startElementRange
        },
        excerpt: 'Start tag is here'
      }]
    });
  }
  if (!this.orchestraElementRange) {
    this.messages.push({
      severity: 'error',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: 'No CsInstruments element'
    });
  }
%}

<synthesizer>"<CsInstruments>"
%{
  if (this.orchestraElementRange) {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: this.orchestraElementRange
      },
      excerpt: 'Duplicate CsInstruments element ignored'
    });
    this.orchestra = '';
  }
  this.orchestraElementRange = this.rangeFromLocation(yylloc);
  this.stringName = 'orchestra';
  this.begin('orchestra');
%}
<orchestra>"</CsInstruments>"
%{
  this.popState();
  this.stringName = null;
%}

<synthesizer>"<CsScore>"
%{
  if (this.scoreElementRange) {
    this.messages.push({
      severity: 'warning',
      location: {
        file: this.filePath,
        position: this.rangeFromLocation(yylloc)
      },
      excerpt: 'Duplicate CsScore element ignored'
    });
  } else {
    this.stringName = 'score';
    this.scoreElementRange = this.rangeFromLocation(yylloc);
  }
  this.begin('score');
%}
<score>"</CsScore>"
%{
  this.popState();
  this.stringName = null;
%}

<orchestra,score>"/*"
%{
  this.begin('block_comment');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.appendToString(yytext);
%}
<block_comment>"*/"
%{
  this.startRanges.pop();
  this.popState();
  this.appendToString(yytext);
%}
<block_comment><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: 'Unterminated block comment'
  });
%}

<orchestra,score>\"
%{
  this.begin('quoted_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.appendToString(yytext);
%}
<quoted_string>\\.|[^"] this.appendToString(yytext);
<quoted_string>\"
%{
  this.startRanges.pop();
  this.popState();
  this.appendToString(yytext);
%}
<quoted_string><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote('"')}`
  });
%}

<orchestra,score>"{{"
%{
  this.begin('braced_string');
  this.startRanges.push(this.rangeFromLocation(yylloc));
  this.appendToString(yytext);
%}
<braced_string>(?:[^}]|"}"[^}])+ this.appendToString(yytext);
<braced_string>"}}"
%{
  this.startRanges.pop();
  this.popState();
  this.appendToString(yytext);
%}
<braced_string><<EOF>>
%{
  this.messages.push({
    severity: 'error',
    location: {
      file: this.filePath,
      position: this.startRanges.pop()
    },
    excerpt: `Missing terminating ${this.quote('}}')}`
  });
%}

<*>{newline} this.appendToString('\n');
<*>. this.appendToString(yytext);

%%

lexer.appendToString = (function(text) {
  if (this.stringName)
    this[this.stringName] += text;
}).bind(lexer);

lexer.rangeFromLocation = yylloc => {
  return [
    [yylloc.first_line - 1, yylloc.first_column],
    [yylloc.last_line - 1, yylloc.last_column]
  ];
};

const original_setInput = lexer.setInput;
lexer.setInput = (function(input, yy) {
  this.messages = [];
  this.orchestra = '';
  this.orchestraElementRange = null;
  this.score = '';
  this.scoreElementRange = null;
  this.startRanges = [];
  this.stringName = null;
  this.synthesizerElementName = null;
  return original_setInput.apply(this, arguments);
}).bind(lexer);

class CsoundDocumentProcessorError extends Error {
  constructor(lintMessage) {
    super(lintMessage.excerpt);
    this.name = 'CsoundDocumentProcessorError';
    this.lintMessage = lintMessage;
  }
}
