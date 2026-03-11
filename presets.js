// Preset configurations per content type
// Implemented by Engineer A

/**
 * PRESETS - Maps content type to suggested and additional presets
 * COMMON_PRESETS - Shared presets available for all content types
 * getAllPresetsForType(contentType) - Returns merged preset list for a type
 */

const PRESETS = {
  code: {
    suggested: [
      { label: 'Explain code', instruction: 'Explain the following code' },
      { label: 'Debug this', instruction: 'Debug the following code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following code' },
    ],
    all: [
      { label: 'Add types', instruction: 'Add type annotations to the following code' },
      { label: 'Write tests', instruction: 'Write unit tests for the following code' },
      { label: 'Convert to...', instruction: 'Convert the following code to' },
    ]
  },
  foreign: {
    suggested: [
      { label: 'Translate', instruction: 'Translate the following to English' },
      { label: 'Explain', instruction: 'Explain the following text' },
    ],
    all: []
  },
  long: {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Key points', instruction: 'Extract the key points from the following' },
    ],
    all: []
  },
  default: {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Explain simply', instruction: 'Explain the following in simple terms' },
    ],
    all: []
  }
};

const COMMON_PRESETS = [
  { label: 'Summarize', instruction: 'Summarize the following' },
  { label: 'Explain', instruction: 'Explain the following' },
  { label: 'Translate', instruction: 'Translate the following to English' },
  { label: 'Rewrite', instruction: 'Rewrite the following more clearly' },
  { label: 'Expand', instruction: 'Expand on the following' },
  { label: 'Key points', instruction: 'Extract the key points from the following' },
];

function getAllPresetsForType(contentType) {
  const typeAll = PRESETS[contentType].all || [];
  const labels = new Set([
    ...PRESETS[contentType].suggested.map(p => p.label),
    ...typeAll.map(p => p.label),
  ]);
  const common = COMMON_PRESETS.filter(p => !labels.has(p.label));
  return [...typeAll, ...common];
}

// Export for testing (no-op in browser)
if (typeof module !== 'undefined') module.exports = { PRESETS, COMMON_PRESETS, getAllPresetsForType };
