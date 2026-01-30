
import { detectContentAsset } from './new-content-factory';

const actionString = "Publish an Expert Article on Applied Clinical Trials Online outlining unified eClinical software leaders for global Phase III research.";

const result = detectContentAsset(actionString);

console.log(`Action: "${actionString}"`);
console.log(`Detected Asset: ${result.asset}`);
console.log(`Confidence: ${result.confidence}`);

// Check which keyword matched if any (simulating the logic)
const expertKeywords = ['expert community', 'forum response', 'quora', 'reddit', 'reddit response', 'community answer', 'expert answer'];
const match = expertKeywords.find(k => actionString.toLowerCase().includes(k));
console.log(`Matched Expert Keyword: ${match}`);
