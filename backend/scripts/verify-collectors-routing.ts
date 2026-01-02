
import { resolveCollectorsFromBrandMetadata } from '../src/cron/unified-job-worker';

function test(name: string, input: any, expected: any) {
  try {
    const result = resolveCollectorsFromBrandMetadata(input);
    const resultStr = JSON.stringify(result);
    const expectedStr = JSON.stringify(expected);
    if (resultStr === expectedStr) {
      console.log(`✅ ${name}: Passed`);
    } else {
      console.error(`❌ ${name}: Failed`);
      console.error(`   Expected: ${expectedStr}`);
      console.error(`   Actual:   ${resultStr}`);
    }
  } catch (e) {
    console.error(`❌ ${name}: Error`, e);
  }
}

console.log('Verifying collector routing logic...');

test('Empty metadata', {}, { kind: 'no_key' });
test('Metadata without ai_models', { foo: 'bar' }, { kind: 'no_key' });
test('Empty ai_models array', { ai_models: [] }, { kind: 'explicit_empty', collectors: [] });
test('Valid ai_models', { ai_models: ['chatgpt', 'google_aio'] }, { kind: 'selected', collectors: ['chatgpt', 'google_aio'] });
test('Mixed case and spacing', { ai_models: [' ChatGPT ', ' GROK '] }, { kind: 'selected', collectors: ['chatgpt', 'grok'] });
test('Unknown models', { ai_models: ['unknown_model'] }, { kind: 'selected', collectors: [] });
test('Mixed known and unknown', { ai_models: ['chatgpt', 'unknown'] }, { kind: 'selected', collectors: ['chatgpt'] });

console.log('Verification complete.');
