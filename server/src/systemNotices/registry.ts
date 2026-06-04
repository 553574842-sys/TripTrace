import type { SystemNotice } from './types.js';

/**
 * System notices are intentionally empty for TripTrace's self-owned build.
 *
 * Keep the notice infrastructure available for future product announcements,
 * but do not show upstream upgrade, welcome, donation, or community popups to
 * users by default.
 */
export const SYSTEM_NOTICES: SystemNotice[] = [];
