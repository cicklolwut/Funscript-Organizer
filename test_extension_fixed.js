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
    // Pattern 2 FIRST: Check for variant before .funscript
    for (const variant of funscriptVariants) {
      const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
      if (lower.match(pattern)) {
        const match = filename.match(new RegExp(`\\.${variant}\\.funscript$`, 'i'));
        return match ? match[0] : '';
      }
    }
    
    // Pattern 1 SECOND: .funscript and anything after
    const pattern1Match = filename.match(/\.funscript.*$/i);
    if (pattern1Match) {
      return pattern1Match[0];
    }
    
    // Default funscript pattern
    return '.funscript';
  }
  
  return '';
}

// Test cases
const test1 = '2b-loop2VR_8K120FPS_SBS_180.roll.funscript';
const test2 = '2b-loop2VR_8K120FPS_SBS_180.pitch.funscript';
const test3 = '2b-loop2VR_8K120FPS_SBS_180.funscript';
const test4 = '2b-loop2VR_8K120FPS_SBS_180.funscript.roll';

console.log('Test 1:', test1);
console.log('Extension:', getFileExtension(test1));

console.log('\nTest 2:', test2);
console.log('Extension:', getFileExtension(test2));

console.log('\nTest 3:', test3);
console.log('Extension:', getFileExtension(test3));

console.log('\nTest 4:', test4);
console.log('Extension:', getFileExtension(test4));

// Test renaming
const baseName = '2b-loop2VR_8K120FPS_SBS_180';
console.log('\nRename results:');
console.log(test1, '->', baseName + getFileExtension(test1));
console.log(test2, '->', baseName + getFileExtension(test2));
console.log(test3, '->', baseName + getFileExtension(test3));
console.log(test4, '->', baseName + getFileExtension(test4));
