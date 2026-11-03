// Shared inventory of syntax accepted by the current SCL Lab interpreter.
// This is deliberately not a catalogue of every Siemens/TIA instruction.
export const declarationSections = Object.freeze(['VAR', 'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR_TEMP', 'VAR_CONSTANT', 'VAR_STAT']);
export const primitiveTypes = Object.freeze(['BOOL', 'INT', 'DINT', 'SINT', 'LINT', 'UINT', 'UDINT', 'USINT', 'ULINT', 'REAL', 'LREAL', 'TIME', 'LTIME', 'WORD', 'DWORD', 'BYTE', 'LWORD', 'STRING', 'CHAR']);
export const timerTypes = Object.freeze(['TON_TIME', 'TOF_TIME', 'TP_TIME', 'IEC_TIMER', 'TON', 'TOF', 'TP', 'R_TRIG', 'F_TRIG']);
export const supportedTypes = Object.freeze([...primitiveTypes, ...timerTypes, 'SILOWNIK']);
export const languageKeywords = Object.freeze([
  'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK', 'FUNCTION', 'END_FUNCTION', 'ORGANIZATION_BLOCK', 'END_ORGANIZATION_BLOCK',
  'VERSION', ...declarationSections, 'END_VAR', 'RETAIN', 'NON_RETAIN', 'BEGIN', 'VOID',
  'TYPE', 'END_TYPE', 'ARRAY', 'STRUCT', 'END_STRUCT', 'OF', 'IF', 'THEN', 'ELSIF', 'ELSE', 'END_IF', 'CASE', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR', 'WHILE', 'END_WHILE', 'REPEAT', 'UNTIL', 'END_REPEAT',
  'EXIT', 'CONTINUE', 'RETURN', 'REGION', 'END_REGION', 'TRUE', 'FALSE', 'AND', 'OR', 'NOT', 'XOR', 'MOD', 'DIV',
]);
