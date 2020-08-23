const csound = require('csound-api');

class Opcode {
  get kind() { return 'opcode'; }
  get inputTypeSignatures() { return Object.keys(this.outputTypeSignaturesByInputTypeSignature); }

  constructor(name, outputTypeSignaturesByInputTypeSignature) {
    this.name = name;
    this.outputTypeSignaturesByInputTypeSignature = outputTypeSignaturesByInputTypeSignature;
    for (const inputTypeSignature of this.inputTypeSignatures) {
      for (const outputTypeSignature of this.outputTypeSignaturesByInputTypeSignature[inputTypeSignature]) {
        if (outputTypeSignature.length > 0) {
          this.isVoid = false;
          return;
        }
      }
    }
    this.isVoid = true;
  }
}

class Variable {
  get kind() { return 'variable'; }

  constructor(name, type, range) {
    this.name = name;
    this.type = type;
    this.range = range;
  }
}

class Label {
  get kind() { return 'label'; }

  constructor(name, range) {
    this.name = name;
    this.range = range;
  }
}

class SymbolTable {
  constructor() {
    this.identifiers = {};
    this.labels = {};
  }

  addOpcode(name, outputTypeSignaturesByInputTypeSignature) {
    this.identifiers[name] = new Opcode(name, outputTypeSignaturesByInputTypeSignature);
  }

  addVariable(name, type, range) {
    const variable = this.identifiers[name];
    if (!variable)
      this.identifiers[name] = new Variable(name, type, range);
  }

  addLabel(name, range) {
    let label = this.identifiers[name];
    if (!label) {
      label = new Label(name, range);
      this.identifiers[name] = label;
      this.labels[name] = label;
    }
  }
}

// Make a symbol table containing Csound’s built-in opcodes.
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
    case 'OSCbundle':
      if (inputTypeSignature === 'kSkS[]S[]k[][]o')
        inputTypeSignature = 'kSkS[]S[]k[]o';
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
    symbolTable.addVariable(name, 'i'); // Csound uses a type of 'r'.
  }
  return symbolTable;
};

module.exports = SymbolTable;
