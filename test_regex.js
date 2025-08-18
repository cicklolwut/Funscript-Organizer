const funscriptVariants = [
  'roll', 'twist', 'sway', 'surge', 'pitch',
  'vib', 'vib0', 'vib1', 'vib2', 
  'vibe', 'vibe0', 'vibe1', 'vibe2',
  'stroke', 'lube', 'heat'
];

function getBaseName(filename) {
  let baseName = filename;
  
  // Pattern 1: .funscript and anything after
  console.log('Before pattern 1:', baseName);
  baseName = baseName.replace(/\.funscript.*$/i, '');
  console.log('After pattern 1:', baseName);
  
  // Pattern 2: .variant.funscript
  for (const variant of funscriptVariants) {
    const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
    if (pattern.test(baseName)) {
      console.log(`Matching pattern 2 for ${variant}:`, pattern);
      baseName = baseName.replace(pattern, '');
      console.log('After pattern 2:', baseName);
    }
  }
  
  return baseName.toLowerCase();
}

// Test cases
const test1 = '2b-loop2VR_8K120FPS_SBS_180.pitch.funscript';
const test2 = '2b-loop2VR_8K120FPS_SBS_180.roll.funscript';
const test3 = '2b-loop2VR_8K120FPS_SBS_180.funscript.pitch';
const test4 = '2b-loop2VR_8K120FPS_SBS_180.funscript';

console.log('\nTest 1:', test1);
console.log('Result:', getBaseName(test1));

console.log('\nTest 2:', test2);
console.log('Result:', getBaseName(test2));

console.log('\nTest 3:', test3);
console.log('Result:', getBaseName(test3));

console.log('\nTest 4:', test4);
console.log('Result:', getBaseName(test4));
