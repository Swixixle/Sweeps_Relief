export type {
  Action,
  FieldMetadata,
  KnownDomainsConfig,
  PageContextAugment,
  ProtectedMatchType,
  ProtectedPatternsConfig,
  RiskEngineInput,
  RiskPolicyOverrides,
  RiskResult,
  RiskTermsConfig,
  ScoringConfig,
  SubmitInterceptionConfig,
  SurfaceType,
} from "./types.js";
export { debugEvaluationShape } from "./debug.js";
export {
  classifySurface,
  detectProtectedMatch,
  evaluateRisk,
  evaluateSubmitRisk,
  matchesKnownDomain,
  SUBMIT_INTERCEPT_SURFACES,
} from "./evaluate.js";
