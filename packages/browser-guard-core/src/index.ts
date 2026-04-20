export { enrichFieldMetadata, gatherPageContextFromField } from "./domContext.js";
export { fieldMetadataFromElement } from "./field.js";
export { sampleVisibleText } from "./pageSample.js";
export type { PasteDefenseInput, RulesBundle } from "./pasteDefense.js";
export {
  evaluatePasteDefense,
  evaluateSubmitDefense,
  pasteShouldBeBlocked,
  submitShouldBlock,
  submitShouldWarn,
  typingShouldBeBlocked,
} from "./pasteDefense.js";
