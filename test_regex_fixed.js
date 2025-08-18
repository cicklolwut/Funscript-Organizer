const funscriptVariants = [
  'roll', 'twist', 'sway', 'surge', 'pitch',
  'vib', 'vib0', 'vib1', 'vib2', 
  'vibe', 'vibe0', 'vibe1', 'vibe2',
  'stroke', 'lube', 'heat'
];

function getBaseName(filename) {
  let baseName = filename;
  
  // Pattern 2 FIRST: .variant.funscript
  for (const variant of funscriptVariants) {
    const pattern = new RegExp(`\\.${variant}\\.funscript$`, 'i');
    baseName = baseName.replace(pattern, '');
  }
  
  // Pattern 1 SECOND: .funscript and anything after
  baseName = baseName.replace(/\.funscript.*$/i, '');
  
  return baseName.toLowerCase();
}

// Test cases
const test1 = '2b-loop2VR_8K120FPS_SBS_180.pitch.funscript';
const test2 = '2b-loop2VR_8K120FPS_SBS_180.roll.funscript';
const test3 = '2b-loop2VR_8K120FPS_SBS_180.funscript.pitch';
const test4 = '2b-loop2VR_8K120FPS_SBS_180.funscript';

console.log('Test 1:', test1);
console.log('Result:', getBaseName(test1));

console.log('\nTest 2:', test2);
console.log('Result:', getBaseName(test2));

console.log('\nTest 3:', test3);
console.log('Result:', getBaseName(test3));

console.log('\nTest 4:', test4);
console.log('Result:', getBaseName(test4));

console.log('\nAll base names match:', 
  getBaseName(test1) === getBaseName(test2) && 
  getBaseName(test2) === getBaseName(test3) &&
  getBaseName(test3) === getBaseName(test4));
