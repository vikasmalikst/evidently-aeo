
import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

async function testGroq400() {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    console.log('🧪 Testing Groq Compound with tool_choice conflict...\n');

    try {
        const completionParams: any = {
            messages: [
                { role: 'system', content: 'You are a researcher.' },
                { role: 'user', content: 'What is the current price of Bitcoin? Use web search.' }
            ],
            model: 'groq/compound',
            temperature: 0.5,
            max_tokens: 1000,
            // NO tool_choice here initially (reproduce current state)
            compound_custom: {
                tools: {
                    enabled_tools: ["web_search"]
                }
            }
        };

        console.log('Case 1: No tool_choice (Current State)');
        try {
            const result = await groq.chat.completions.create(completionParams);
            console.log('✅ Case 1 Succeeded');
        } catch (e: any) {
            console.error('❌ Case 1 Failed:', e.message);
        }

        console.log('\nCase 2: tool_choice: "auto"');
        try {
            completionParams.tool_choice = 'auto';
            const result = await groq.chat.completions.create(completionParams);
            console.log('✅ Case 2 Succeeded');
        } catch (e: any) {
            console.error('❌ Case 2 Failed:', e.message);
        }

        console.log('\nCase 3: tool_choice: "none"');
        try {
            completionParams.tool_choice = 'none';
            const result = await groq.chat.completions.create(completionParams);
            console.log('✅ Case 3 Succeeded');
        } catch (e: any) {
            console.error('❌ Case 3 Failed:', e.message);
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

testGroq400();
