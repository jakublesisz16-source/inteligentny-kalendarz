export interface AvailabilityEligibilityInput {
  weekday: number;
  excluded: boolean;
  allowSaturday: boolean;
  allowTradingSunday: boolean;
  tradingSunday: boolean;
}

export interface AvailabilityEligibilityResult {
  eligible: boolean;
  manualEligible: boolean;
  exclusionReason?: string;
}

/**
 * Pure weekday eligibility used by both the service and regression tests.
 * Missing day rules are not an exclusion - they are handled by automatic calendar bounds.
 */
export function resolveAvailabilityEligibility(input: AvailabilityEligibilityInput): AvailabilityEligibilityResult {
  if (input.excluded) {
    return { eligible: false, manualEligible: false, exclusionReason: 'dzień wykluczony z dyspozycyjności' };
  }

  const manualEligible = input.weekday !== 0 || input.tradingSunday;
  if (input.weekday === 6 && !input.allowSaturday) {
    return { eligible: false, manualEligible, exclusionReason: 'sobota jest wyłączona dla automatycznych propozycji' };
  }
  if (input.weekday === 0 && (!input.allowTradingSunday || !input.tradingSunday)) {
    return { eligible: false, manualEligible, exclusionReason: 'niedziela nie jest dopuszczoną niedzielą handlową' };
  }
  return { eligible: true, manualEligible };
}
