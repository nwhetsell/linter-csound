class Opcode {
  constructor(name, outputTypeSignaturesByInputTypeSignature) {
    this.name = name;
    for (const inputTypeSignature of Object.keys(outputTypeSignaturesByInputTypeSignature)) {
      for (const outputTypeSignature of outputTypeSignaturesByInputTypeSignature[inputTypeSignature]) {
        if (outputTypeSignature.length > 0) {
          this.isVoid = false;
          return;
        }
      }
    }
    this.isVoid = true;
  }

  get kind() { return 'opcode'; }
}

class Variable {
  constructor(name, type, range) {
    this.name = name;
    this.type = type;
    this.range = range;
  }

  get kind() { return 'variable'; }
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

  addOpcode(name, outputTypeSignaturesByInputTypeSignature) {
    this.identifiers[name] = new Opcode(name, outputTypeSignaturesByInputTypeSignature);
  }

  addVariable(name, range, type) {
    const variable = this.identifiers[name];
    if (!variable)
      this.identifiers[name] = new Variable(name, range, type);
  }

  addLabel(name, range) {
    const label = this.labels[name];
    if (!label)
      this.labels[name] = new Label(name, range);
  }
}

// Make a symbol table containing Csound’s built-in opcodes.
const csound = require('csound-api');
const Csound = csound.Create();
const opcodeList = [];
csound.NewOpcodeList(Csound, opcodeList);
const opcodeInfo = {};
for (const opcodeEntry of opcodeList) {
  let outputTypeSignaturesByInputTypeSignature = opcodeInfo[opcodeEntry.opname];
  if (!outputTypeSignaturesByInputTypeSignature) {
    outputTypeSignaturesByInputTypeSignature = {};
    opcodeInfo[opcodeEntry.opname] = outputTypeSignaturesByInputTypeSignature;
  }

  // Fix typos in input type signatures
  // <https://github.com/csound/csound/issues/685>.
  let inputTypeSignature = opcodeEntry.intypes;
  switch (opcodeEntry.opname) {
    case 'FLslidBnk2':
      if (inputTypeSignature === 'Iiiiooooo')
        inputTypeSignature = 'iiiiooooo';
      break;
    case 'changed2':
      if (inputTypeSignature === '*[]')
        inputTypeSignature = '.[]';
      break;
    case 'spectrum':
      if (inputTypeSignature === 'siiiqoooo')
        inputTypeSignature = 'xiiiqoooo';
      break;
  }

  let outputTypeSignatures = outputTypeSignaturesByInputTypeSignature[inputTypeSignature];
  if (!outputTypeSignatures) {
    outputTypeSignatures = [];
    outputTypeSignaturesByInputTypeSignature[inputTypeSignature] = outputTypeSignatures;
  }
  // Don’t add duplicate opcode entries.
  if (outputTypeSignatures.indexOf(opcodeEntry.outypes) < 0)
    outputTypeSignatures.push(opcodeEntry.outypes);
}
csound.DisposeOpcodeList(Csound, opcodeList);
csound.Destroy(Csound);

SymbolTable.makeGlobalSymbolTable = () => {
  const symbolTable = new SymbolTable();
  for (const name of Object.keys(opcodeInfo)) {
    symbolTable.addOpcode(name, opcodeInfo[name]);
  }
  for (const name of ['0dbfs', 'A4', 'kr', 'ksmps', 'nchnls', 'nchnls_i', 'sr']) {
    symbolTable.addVariable(name, 'i');
  }
  return symbolTable;
};

module.exports = SymbolTable;
