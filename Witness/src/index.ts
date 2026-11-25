/**
 * Witness: the instrumentation MikeVan's AI Development Toolkit owns.
 *
 * What a tool takes from here:
 *   - createInstrumenter(wasmDir): the instrumenter in the tool's own
 *     process, for the universe of files no test loads and for tests.
 *   - hooksDir(): the folder of hook files the tool copies into its own
 *     folder in a project (.deeptest/hooks, .untangleit/hooks) and loads
 *     from there: witness.cjs (the runtime), witness-loader.mjs (Node's
 *     loader), witness-vite.mjs (a Vite build), witness-playwright-loader.mjs
 *     and witness-playwright.template.ts (Playwright's workers), mocha.cjs
 *     (the Mocha boundary), witness-jest-runtime.cjs, witness-jest.cjs and
 *     witness-jest-transform.cjs (Jest's setup files and its transformer),
 *     and witness-instrument.cjs (the instrumenter, bundled whole for a
 *     process without this package's node_modules).
 *   - wasmDir(): the grammars and the tree-sitter runtime the hooks read
 *     through WITNESS_WASM_DIR.
 *   - The environment the hooks read, by name, so a tool sets exactly these.
 *
 * The records every hook writes are the same shape: one JSON line per test,
 * { test, files: { path: [lines] }, outcomes: { path: { branchId: [indices] } },
 * entered: { path: [functionIds] } }, and coverage-<pid>.json per process in
 * Istanbul's shape. The design is in docs/witness.md.
 */
export { Instrumenter, DECORATED_FIELD, MISPARSE } from './instrument';
export { BoundaryInstrumenter } from './boundary';
export type { BoundaryTarget, BoundaryMatch, BoundaryInstrumented, Captured, OutcomeKind, Observation, Problem, BoundaryRecord } from './boundary';
export { isProblem, readBoundaryRecords } from './boundary';
export type { Instrumented, WitnessMaps } from './instrument';
export { createInstrumenter } from './hook';
export type { WitnessInstrumenter, BoundaryEnvTarget } from './hook';
export { parseBoundaryTarget } from './hook';
export { initTreeSitter, loadLanguage, createParser, repoWasmDir } from './treeSitter';
export { isTestPath, hooksDir, wasmDir, HOOK_FILES, ENV, copyHooks, readPackageJson, findVitestConfig, resolveModuleDir, detectRunner, vitestWrapperConfig, witnessTransform, angularKarmaConfig, writeShadowTree, writeShadowTsConfig, parseTsConfigText, readTsPaths, renameTestFiles, posixPath, splitArgs, escapeRegex, instrumentedPathFor, writeInstrumented, detectPlaywrightCt, writePlaywrightFixture, playwrightWrapperConfig, detectAngularTestTarget, detectAngularRunner } from './delivery';
export type { Runner, ToolName, Rewrite, ShadowTree, TsPaths, JestResolvedConfig, AngularTestTarget } from './delivery';
export { pathCondition, pathConditionNote, upstreamPathFailure, presentPathFailure } from './compatibility';
export type { PathCondition, UpstreamPathFailure, PathFailurePresentation } from './compatibility';
export { runProcess } from './process';
export type { ProcessResult } from './process';
export type { BoundarySpec, BoundaryRecorder, RecorderContext, TypeScriptRecorderContext, PythonRecorderContext } from './behaviour/context';
export { locateBoundary, recordBoundary, saveBefore, loadBefore, clearBefore, verdictFor } from './behaviour/gate';
export type { BeforeRecord } from './behaviour/gate';
export { describePythonRecorder, recordPythonBoundary, moduleNameFor } from './behaviour/python';
export { describeTypeScriptRecorder, recordTypeScriptBoundary } from './behaviour/typescript';
export { compareValue, decide, sentence } from './behaviour/compare';
export type { Insufficient, Difference, Verdict, Comparison } from './behaviour/compare';
export { buildFailureBrief, unclassifiedPacket, unclassifiedGovernancePacket, describeRunner, instrumentationFailure } from './diagnosis';
export type { InstrumentationEvidence, InstrumentationCondition } from './diagnosis';
export type { ProblemPacket } from './diagnosis';

/**
 * The governance contract (1.0.21 Phase 2).
 *
 * `ProblemPacket` above is a compatibility view of `GovernancePacket` below,
 * and the conversion runs one way only. There is no `toGovernancePacket`,
 * deliberately: the old shape carries no typed evidence, structured
 * constraints, objective, validators, authorization boundary, or
 * verification rule, so a reverse conversion would invent all six.
 */
export { buildPacket, packetId, constraintIds, toProblemPacket, PacketError, EVIDENCE_ORIGINS, FAILURE_CLASSES, ONE_CORRECTION, NO_AUTHORIZATION_NEEDED, USER_AUTHORIZES_ATTEMPT, NOTHING_TO_VERIFY } from './governance/packet';
export type {
  GovernancePacket,
  PacketInput,
  EvidenceItem,
  EvidenceOrigin,
  Classification,
  FailureClass,
  Objective,
  ResponseShape,
  AllowedActions,
  CorrectionPolicy,
  AuthorizationRule,
  VerificationRule,
  MeasurementId,
  Fact,
  Offer,
  LegacyProblemPacketView,
} from './governance/packet';
export { STANDING_CONSTRAINTS, PATH_CONSTRAINTS, POLYGLOT_CONSTRAINTS, UNCLASSIFIED_CONSTRAINT, FINDING_CONDITIONS, findingConstraints, isFindingCondition, TOOL_FOLDERS, PARAMETER_BINDINGS, bindingFor, bindParameter, isConstraintId, isStandingConstraintId, assertConstraintShape } from './governance/constraints';
export type { Constraint, ConstraintId, ConstraintRule, StandingConstraintId, ConditionConstraintId, FindingCondition, PublicSurface, Coverage, ParameterBinding, ParameterSource } from './governance/constraints';
export { findingPacket, CAUSE_NOT_ESTABLISHED } from './governance/finding';
export { GOVERNANCE_FILE, GovernanceStoreError, appendGovernanceRecord, attachVerification, governancePath, readGovernance } from './governance/store';
export type { AttachResult, FoldedRecord, GovernanceHistory, RecordedOutcome, StoreFailure } from './governance/store';
export type { FindingInput } from './governance/finding';
export { recordVerification } from './governance/record';
export { isProvablyAdditive } from './governance/additive';
export type { AdditiveVerdict } from './governance/additive';
export { createTypeScriptSyntax } from './governance/syntax/typescript';
export { resolveVerification, VerificationError } from './governance/verification';
export type { VerificationOutcome, MeasurementOutcome, MeasurementResult } from './governance/verification';
export { anchorApplied, contentDigest } from './governance/anchor';
export type { ApplicationAnchor } from './governance/anchor';
export { validateSpec, registerInteraction, requireInteraction, isRegistered, registeredIds, clearRegistryForTests, RegistryError } from './governance/registry';
export type { InteractionSpec, InteractionId, SpecProblem, SpecValidation } from './governance/registry';
export { buildPrompt, hashOf } from './governance/prompt';
export type { GovernedPrompt } from './governance/prompt';
export { parseExplain, parsePropose, parseResponse, validatable, describeResponseShape } from './governance/response';
export type { ExplainResponse, ProposeResponse, ProposedEdit, ResponseClaims, ValidatableResponse, ParseResult } from './governance/response';
export { VALIDATOR_IDS, buildValidationResult, forbiddenPathsValidator, validatorFor, validatorImplemented, isValidatorId, normalizeSegments, requirePrerequisites, PrerequisiteError, coverageOf } from './governance/validators';
export type { Validator, ValidatorId, ValidatorInput, ValidatorOutcome, ValidationResult, InvalidCause, InvalidReason, PrerequisiteInput, PrerequisiteOutcome, MissingPrerequisite } from './governance/validators';
export { nodeRepository, memoryRepository, UNREADABLE } from './governance/repository';
export type { RepositoryPort, ReadResult, ResolveResult } from './governance/repository';
export type { SyntaxPort, Declaration, TestStructure } from './governance/syntax';
export { issueInteraction, redeemInteraction, capabilityIsLive, clearCapabilitiesForTests, newAttemptId, CapabilityError } from './governance/capability';
export type { InteractionCapability, Redeemed, AttemptId } from './governance/capability';
export { authorizationBrief, briefLines, authorizationEvent, AuthorizationError } from './governance/authorization';
export type { AuthorizationBrief, AuthorizationEvent } from './governance/authorization';
export { reconcileConstraints, ReconciliationError } from './governance/reconcile';
export type { EffectiveConstraints } from './governance/reconcile';
export { runGovernedInteraction, modelFailureSentence, ModelUnavailable } from './governance/interaction';
export type { ModelPort, SurfacePort, GovernedDeps, GovernedOutcome, AttemptIdentity } from './governance/interaction';
export { buildRecord, digest, RECORD_FIELDS } from './governance/record';
export type { GovernanceRecord, RecordInput, RecordedValidator } from './governance/record';

/** The Node the loader needs: module.registerHooks exists from 22.15.0 and 23.5.0. */
export function nodeSupportsWitness(version: string): boolean {
  const m = /v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) {
    return false;
  }
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > 23 || (major === 23 && minor >= 5) || (major === 22 && minor >= 15);
}
