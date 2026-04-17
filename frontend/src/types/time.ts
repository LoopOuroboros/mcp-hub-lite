/**
 * Time unit types for configuration values
 */
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/**
 * Conversion factors from each time unit to seconds
 */
export const unitFactors: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400
};

/**
 * Unit priority for auto-selection (from largest to smallest)
 */
export const unitPriority: TimeUnit[] = ['days', 'hours', 'minutes', 'seconds'];

/**
 * Automatically selects the most appropriate unit based on seconds value.
 * @param seconds - The value in seconds
 * @returns The optimal time unit for display
 */
export function getOptimalUnit(seconds: number): TimeUnit {
  for (const unit of unitPriority) {
    const factor = unitFactors[unit];
    if (seconds >= factor) {
      return unit;
    }
  }
  return 'seconds';
}
