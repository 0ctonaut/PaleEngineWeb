// Rendering layers (0-31 available in Three.js)
export const Layers = {
  DEFAULT: 0,
  UI: 10,
  DEBUG: 11
} as const;

// Selection categories (stored in userData)
export const SelectionCategory = {
  SCENE_OBJECT: 'scene_object',   // Can be selected
  UI_HELPER: 'ui_helper',         // Cannot be selected (gizmo, etc.)
  DEBUG: 'debug'                  // Cannot be selected (debug viz)
} as const;

export type LayerType = typeof Layers[keyof typeof Layers];
export type SelectionCategoryType = typeof SelectionCategory[keyof typeof SelectionCategory];

