class Opcode {
  constructor(opcodeEntry) {
    this.name = opcodeEntry.opname;
    this.inputTypeStrings = [];
    this.inputTypeStringsByLengthByOutputTypeString = {};
    this.addOpcodeEntry(opcodeEntry);
  }

  get kind() { return 'opcode'; }

  addOpcodeEntry(opcodeEntry) {
    const inputTypeString = opcodeEntry.intypes;
    // According to
    // https://github.com/csound/csound/blob/develop/Engine/entry1.c, the output
    // type ‘s’ is deprecated but means either a k- or a-rate output.
    const outputTypes = (opcodeEntry.outypes === 's') ? ['k', 'a'] : [opcodeEntry.outypes];
    for (const outputType of outputTypes) {
      const inputTypeStringsByLength = this.inputTypeStringsByLengthByOutputTypeString[outputType];
      if (inputTypeStringsByLength) {
        const inputTypeStrings = inputTypeStringsByLength[inputTypeString.length];
        if (inputTypeStrings) {
          if (inputTypeStrings.indexOf(inputTypeString) < 0)
            inputTypeStrings.push(inputTypeString);
        } else {
          inputTypeStringsByLength[inputTypeString.length] = [inputTypeString];
        }
      } else {
        this.inputTypeStringsByLengthByOutputTypeString[outputType] = {[inputTypeString.length]: [inputTypeString]};
      }
    }
  }
}

class Label {
  constructor(name, range) {
    this.name = name;
    this.range = range;
  }
  get kind() { return 'label'; }
}

class SymbolTable {
  constructor() {
    this.identifiers = {};
    this.labels = {};
  }

  addLabel(name, range) {
    const label = this.labels[name];
    if (!label)
      this.labels[name] = new Label(name, range);
  }

  addOpcodeEntry(opcodeEntry) {
    const identifier = opcodeEntry.opname;
    const opcode = this.identifiers[identifier];
    if (opcode)
      opcode.addOpcodeEntry(opcodeEntry);
    else
      this.identifiers[identifier] = new Opcode(opcodeEntry);
  }
}

module.exports = SymbolTable;
