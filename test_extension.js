const funscriptVariants = [
  'roll', 'twist', 'sway', 'surge', 'pitch',
  'vib', 'vib0', 'vib1', 'vib2', 
  'vibe', 'vibe0', 'vibe1', 'vibe2',
  'stroke', 'lube', 'heat'
];

function getFileExtension(filename) {
  const lower = filename.toLowerCase();
  
  // For funscript files, we need to handle both patterns:
  // 1. .funscript.variant (e.g., file.funscript.roll)
  // 2. .variant.funscript (e.g., file.roll.funscript)
  if (lower.includes('.funscript')) {
    // Pattern 1: .funscript and anything after
    const pattern1Match = filename.match(/\.funscript.*$/i);
    if (pattern1Match) {
      return pattern1Match[0];
    }
    
    // Pattern 2: Check for variant before .funscript
    for (const variant of funscriptVariants) {
      const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
      if (lower.match(pattern)) {
        const match = filename.match(new RegExp(`\\.${variant}\\.funscript$`, 'i'));
        return match ? match[0] : '';
      }
    }
    
    // Default funscript pattern
    return '.funscript';
  }
  
  // For video files, get the extension
  const videoExtensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg'];
  for (const ext of videoExtensions) {
    if (lower.endsWith(ext)) {
      return filename.slice(-ext.length);
    }
  }
  
  // Default: get everything after the last dot
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot) : '';
}

// Test cases
const test1 = '2b-loop2VR_8K120FPS_SBS_180.roll.funscript';
const test2 = '2b-loop2VR_8K120FPS_SBS_180.pitch.funscript';
const test3 = '2b-loop2VR_8K120FPS_SBS_180.funscript';

console.log('Test 1:', test1);
console.log('Extension:', getFileExtension(test1));

console.log('\nTest 2:', test2);
console.log('Extension:', getFileExtension(test2));

console.log('\nTest 3:', test3);
console.log('Extension:', getFileExtension(test3));
