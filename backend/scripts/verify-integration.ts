
import { recommendationV3Service } from '../src/services/recommendations/recommendation-v3.service';
import { domainReadinessService } from '../src/services/domain-readiness/domain-readiness.service';

async function verify() {
    console.log('✅ Importing services...');
    if (recommendationV3Service && domainReadinessService) {
        console.log('✅ Services instantiated successfully.');
    } else {
        console.error('❌ Failed to instantiate services.');
        process.exit(1);
    }

    console.log('✅ Integration verification passed (syntax check).');
}

verify().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
