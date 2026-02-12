
import { groqCompoundService } from './services/recommendations/groq-compound.service';

async function verify() {
    console.log('🧪 Diagnostic: Verifying Groq Tool Use / Compound Routing...');

    try {
        console.log('\n--- Test 1: Standard Groq (Llama 70B) ---');
        const res1 = await groqCompoundService.generateContent({
            systemPrompt: 'You are a helpful assistant.',
            userPrompt: 'What is 2+2?',
            model: 'llama-3.3-70b-versatile',
            maxTokens: 10
        });
        console.log('✅ Standard Groq Success:', res1.content);

        console.log('\n--- Test 2: Groq Compound (with Web Search) ---');
        const res2 = await groqCompoundService.generateContent({
            systemPrompt: 'You are a senior content strategist.',
            userPrompt: 'Tell me about Nike latest sustainability report.',
            enableWebSearch: true,
            maxTokens: 50
        });
        console.log('✅ Groq Compound Success:', res2.content);
        console.log('Executed Tools:', res2.executedTools);

    } catch (error: any) {
        console.error('❌ Diagnostic Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        }
    }
}

verify();
