const dedent = require('dedent-js');
const path = require('path');

const processor = require(path.join('..', 'document-processor.js')).lexer;

describe('Csound document processor', () => {
  it('lexes empty string', () => {
    processor.setInput('');
    try {
      processor.lex();
      fail('Expected exception.');
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: 'error',
        location: {
          file: undefined,
          position: [[0, 0], [0, 0]]
        },
        excerpt: 'No CsoundSynthesizer element'
      });
    }
  });

  it('lexes synthesizer end tag without start tag', () => {
    processor.setInput('</CsoundSynthesizer>');
    try {
      processor.lex();
      fail('Expected exception.');
    } catch (error) {
      expect(error.lintMessage).toEqual({
        severity: 'error',
        location: {
          file: undefined,
          position: [[0, 0], [0, 20]]
        },
        excerpt: 'End tag </CsoundSynthesizer> without start tag'
      });
    }
  });

  it('lexes synthesizer element with different start and end tags', () => {
    processor.setInput(dedent`
      <CsoundSynthesizer>
      <CsInstruments>
      </CsInstruments>
      </CsoundSynthesiser>
    `);
    processor.lex();
    expect(processor.orchestra).toBe('\n');
    expect(processor.messages.length).toBe(1);
    expect(processor.messages[0]).toEqual({
      severity: 'warning',
      location: {
        file: undefined,
        position: [[3, 0], [3, 20]]
      },
      excerpt: 'End tag </CsoundSynthesiser> does not match start tag <CsoundSynthesizer>',
      trace: [{
        severity: 'info',
        location: {
          file: this.filePath,
          position: [[0, 0], [0, 19]]
        },
        excerpt: 'Start tag is here'
      }]
    });
  });

  it('lexes synthesizer element without CsInstruments', () => {
    processor.setInput(dedent`
      <CsoundSynthesizer>
      </CsoundSynthesizer>
    `);
    processor.lex();
    expect(processor.messages.length).toBe(1);
    expect(processor.messages[0]).toEqual({
      severity: 'error',
      location: {
        file: undefined,
        position: [[1, 0], [1, 20]]
      },
      excerpt: 'No CsInstruments element'
    });
  });

  // https://github.com/csound/csound/issues/830
  it('lexes orchestra and score', () => {
    processor.setInput(dedent`
      <CsoundSynthesizer>
      <CsInstruments>
      0dbfs = 1
      /*
      </CsInstruments>*/
      prints "\\
      </CsInstruments>"
      prints {{
      </CsInstruments>}}
      </CsInstruments>
      <CsScore>
      e
      /*
      </CsScore>*/
      </CsScore>
      </CsoundSynthesizer>
    `);
    processor.lex();
    expect(processor.orchestra).toBe(dedent`

      0dbfs = 1
      /*
      </CsInstruments>*/
      prints "\\
      </CsInstruments>"
      prints {{
      </CsInstruments>}}

    `);
    expect(processor.orchestraElementRange).toEqual([[1, 0], [1, 15]]);
    expect(processor.score).toBe(dedent`

      e
      /*
      </CsScore>*/

    `);
    expect(processor.scoreElementRange).toEqual([[10, 0], [10, 9]]);
    expect(processor.messages.length).toBe(0);
  });

  it('lexes duplicate CsInstruments element', () => {
    processor.setInput(dedent`
      <CsoundSynthesizer>
      <CsInstruments>
      0dbfs = 32768
      </CsInstruments>
      <CsInstruments>
      0dbfs = 1
      </CsInstruments>
      </CsoundSynthesizer>
    `);
    processor.lex();
    expect(processor.orchestra).toBe(dedent`

      0dbfs = 1

    `);
    expect(processor.orchestraElementRange).toEqual([[4, 0], [4, 15]]);
    expect(processor.messages.length).toBe(1);
    expect(processor.messages[0]).toEqual({
      severity: 'warning',
      location: {
        file: undefined,
        position: [[1, 0], [1, 15]]
      },
      excerpt:  'Duplicate CsInstruments element ignored'
    });
  });

  it('lexes duplicate CsScore element', () => {
    processor.setInput(dedent`
      <CsoundSynthesizer>
      <CsInstruments>
      0dbfs = 1
      </CsInstruments>
      <CsScore>
      e
      </CsScore>
      <CsScore>
      </CsScore>
      </CsoundSynthesizer>
    `);
    processor.lex();
    expect(processor.orchestra).toBe(dedent`

      0dbfs = 1

    `);
    expect(processor.orchestraElementRange).toEqual([[1, 0], [1, 15]]);
    expect(processor.score).toBe(dedent`

      e

    `);
    expect(processor.scoreElementRange).toEqual([[4, 0], [4, 9]]);
    expect(processor.messages.length).toBe(1);
    expect(processor.messages[0]).toEqual({
      severity: 'warning',
      location: {
        file: undefined,
        position: [[7, 0], [7, 9]]
      },
      excerpt:  'Duplicate CsScore element ignored'
    });
  });
});
