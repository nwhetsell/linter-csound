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

  addLabel(name, range) {
    const label = this.labels[name];
    if (!label)
      this.labels[name] = new Label(name, range);
  }
}

// Make a symbol table containing Csound’s built-in opcodes.
const csound = require('csound-api');
csound.SetDefaultMessageCallback(() => {});
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

SymbolTable.builtInOpcodeSymbolTable = new SymbolTable();
for (const opcodeName of Object.keys(opcodeInfo)) {
  SymbolTable.builtInOpcodeSymbolTable.addOpcode(opcodeName, opcodeInfo[opcodeName]);
}

module.exports = SymbolTable;
