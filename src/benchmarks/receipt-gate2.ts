export type Gate2TriggerClass = 'TRUE_POSITIVE' | 'TRUE_NEGATIVE' | 'FALSE_POSITIVE' | 'FALSE_NEGATIVE';

export function classifyGate2RecoveryTrigger(needed: boolean, triggered: boolean): Gate2TriggerClass {
  if (needed && triggered) return 'TRUE_POSITIVE';
  if (!needed && !triggered) return 'TRUE_NEGATIVE';
  if (!needed && triggered) return 'FALSE_POSITIVE';
  return 'FALSE_NEGATIVE';
}

export interface Gate2ShadowSelectionInput {
  primaryCompleteItems: number;
  recoveryCompleteItems: number;
  expectedItems: number;
  primaryAmountAccuracy?: number;
  recoveryAmountAccuracy?: number;
  primaryCandidateAccepted: boolean;
  recoveryCandidateAccepted: boolean;
  recoveryTriggered: boolean;
  catastrophicMoney: boolean;
  criticalUnresolvedAfter: number;
}

export type Gate2ShadowSelectionDecision = 'SELECT_RECOVERY' | 'KEEP_PRIMARY';

export function decideGate2ShadowSelection(input: Gate2ShadowSelectionInput): Gate2ShadowSelectionDecision {
  if (!input.recoveryTriggered) return 'KEEP_PRIMARY';
  if (!input.recoveryCandidateAccepted || input.catastrophicMoney || input.criticalUnresolvedAfter > 0) return 'KEEP_PRIMARY';
  if (input.recoveryCompleteItems < input.primaryCompleteItems) return 'KEEP_PRIMARY';
  const primaryAccuracy = input.primaryAmountAccuracy ?? 0;
  const recoveryAccuracy = input.recoveryAmountAccuracy ?? 0;
  const materiallyBetter = input.recoveryCompleteItems > input.primaryCompleteItems
    || recoveryAccuracy > primaryAccuracy + 1e-9;
  if (!materiallyBetter) return 'KEEP_PRIMARY';
  if (input.expectedItems > 0 && input.recoveryCompleteItems > input.expectedItems) return 'KEEP_PRIMARY';
  return 'SELECT_RECOVERY';
}


export interface Gate2SelectedPathSafetyInput {
  shadowSelection: Gate2ShadowSelectionDecision;
  triggerClass: Gate2TriggerClass;
  recoveryTriggered: boolean;
  recoveryCandidateAccepted: boolean;
  recoveryCatastrophicMoney: boolean;
  criticalUnresolvedAfter: number;
  primaryCompleteItems: number;
  recoveryCompleteItems: number;
  primaryAmountAccuracy?: number;
  recoveryAmountAccuracy?: number;
  selectedCatastrophicMoney: boolean;
  selectedFalseMonetaryItems: number;
  selectedFalseReconciled: boolean;
  selectedFinancialPassed: boolean;
  pageIsolationPassed: boolean;
  baselineEquivalent: boolean;
}

export interface Gate2SelectedPathSafetyResult {
  selectedPath: 'PRIMARY' | 'RECOVERY';
  baselineRegression: boolean;
  recoveryNotWorse: boolean;
  strictRecoverySafetyPassed: boolean;
}

export function evaluateGate2SelectedPathSafety(input: Gate2SelectedPathSafetyInput): Gate2SelectedPathSafetyResult {
  const selectedPath = input.shadowSelection === 'SELECT_RECOVERY' ? 'RECOVERY' : 'PRIMARY';
  const primaryAccuracy = input.primaryAmountAccuracy ?? 0;
  const recoveryAccuracy = input.recoveryAmountAccuracy ?? 0;
  const recoveryNotWorse = input.recoveryCompleteItems >= input.primaryCompleteItems
    && recoveryAccuracy + 1e-9 >= primaryAccuracy;
  const strictRecoverySafetyPassed = selectedPath === 'PRIMARY' || (
    input.triggerClass === 'TRUE_POSITIVE'
    && input.recoveryTriggered
    && input.recoveryCandidateAccepted
    && !input.recoveryCatastrophicMoney
    && input.criticalUnresolvedAfter === 0
    && input.pageIsolationPassed
    && !input.selectedCatastrophicMoney
    && input.selectedFalseMonetaryItems === 0
    && !input.selectedFalseReconciled
    && input.selectedFinancialPassed
    && recoveryNotWorse
  );
  return {
    selectedPath,
    baselineRegression: !input.baselineEquivalent,
    recoveryNotWorse,
    strictRecoverySafetyPassed,
  };
}

export interface Gate2LiveDecisionInput {
  allRequiredCaptured: boolean;
  falsePositiveTriggers: number;
  falseNegativeTriggers: number;
  selectedCatastrophicMoneyCases: number;
  selectedFalseMonetaryItems: number;
  selectedFalseReconciledCases: number;
  pageIsolationFailures: number;
  baselineRegressionCases: number;
  selectedRecoverySafetyFailures: number;
  recoveryPrecision?: number;
}

export type Gate2LiveDecision = 'LIVE_GATE_REQUIRED' | 'LIVE_FAIL' | 'LIVE_PASS';

export function decideGate2LiveDecision(input: Gate2LiveDecisionInput): Gate2LiveDecision {
  if (!input.allRequiredCaptured) return 'LIVE_GATE_REQUIRED';
  const recoveryPrecisionSafe = input.recoveryPrecision === undefined || input.recoveryPrecision >= 0.95;
  const safe = input.falsePositiveTriggers === 0
    && input.falseNegativeTriggers === 0
    && input.selectedCatastrophicMoneyCases === 0
    && input.selectedFalseMonetaryItems === 0
    && input.selectedFalseReconciledCases === 0
    && input.pageIsolationFailures === 0
    && input.baselineRegressionCases === 0
    && input.selectedRecoverySafetyFailures === 0
    && recoveryPrecisionSafe;
  return safe ? 'LIVE_PASS' : 'LIVE_FAIL';
}
