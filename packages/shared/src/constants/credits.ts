/**
 * Credit System Constants
 */

export const CREDIT_RULES = {
  generate: {
    '720p': 2,
    '1K': 4,
    '2K': 6,
    '4K': 8,
  },
  edit: 4,
  inpaint: 2,
  upscale: {
    '2K': 2,
    '4K': 4,
  },
} as const;

export const DAILY_FREE_CREDITS = 20;

export const DEFAULT_IMAGE_SIZE = {
  width: 1024,
  height: 1024,
};

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;
