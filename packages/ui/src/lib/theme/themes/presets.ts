import type { Theme } from '@/types/theme';
import { withPrColors } from './prColors';

import dark_colorblind_high_contrast_Raw from './dark-colorblind-high-contrast.json';

export const presetThemes: Theme[] = [
  dark_colorblind_high_contrast_Raw as Theme,
].map((theme) => withPrColors(theme));
