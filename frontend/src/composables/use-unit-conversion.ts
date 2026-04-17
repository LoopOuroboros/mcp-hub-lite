import { watch } from 'vue';
import type { Ref } from 'vue';
import { unitFactors, type TimeUnit } from '../types/time';

/**
 * Watches a unit change and automatically converts the associated value.
 * When the unit changes, the value is converted to maintain the same actual time duration.
 *
 * @param unitRef - The ref holding the current unit (e.g., connectionTimeoutUnit)
 * @param valueRef - The ref holding the numeric value to be converted
 */
export function useUnitConversionWatcher(
  unitRef: Ref<TimeUnit>,
  valueRef: { value: number }
): void {
  watch(unitRef, (newUnit, oldUnit) => {
    if (oldUnit && newUnit !== oldUnit) {
      const factor = unitFactors[newUnit] / unitFactors[oldUnit];
      valueRef.value = Math.round(valueRef.value / factor);
    }
  });
}
