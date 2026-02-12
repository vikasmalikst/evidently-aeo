
import * as dotenv from 'dotenv';
import { groqCompoundService } from './services/recommendations/groq-compound.service';

dotenv.config();

async function testGroqIntegration() {
    console.log('🧪 Starting Groq Integration Test...\n');

    // Test 1: Strategy Generation Simulation (Standard Model + JSON Mode)
    console.log('--- TEST 1: Strategy Generation (Llama 3.3 70B, JSON Mode) ---');
    try {
        const strategyPrompt = `
        You are a strategist.
        Define a target audience for a CRM software.
        Return JSON with keys: 'audience', 'painPoint'.
        `;

        const startTime = Date.now();
        const response1 = await groqCompoundService.generateContent({
            systemPrompt: 'You are a helper.',
            userPrompt: strategyPrompt,
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5,
            maxTokens: 1000,
            jsonMode: true
        });
        const duration = Date.now() - startTime;

        console.log(`⏱️ Duration: ${duration}ms`);
        console.log('📦 Response:', response1.content);

        // Verify JSON parsing
        try {
            if (response1.content) {
                JSON.parse(response1.content);
                console.log('✅ JSON is valid.');
            } else {
                console.error('❌ Empty content.');
            }
        } catch (e) {
            console.error('❌ JSON parsing failed:', e);
        }

    } catch (error) {
        console.error('❌ Test 1 Failed:', error);
    }

    console.log('\n--------------------------------------------------\n');

    // Test 2: Content Generation Simulation (Compound Model + Web Search)
    console.log('--- TEST 2: Content Generation (Groq Compound, Web Search Enabled) ---');
    try {
        const contentPrompt = `
        Write a short paragraph about the latest specific feature updates in Next.js 14 (released late 2023/2024).
        GROUNDING RULE:
        - Use web search to verify facts.
        - Start with "According to recent documentation...".
        `;

        const startTime = Date.now();
        const response2 = await groqCompoundService.generateContent({
            systemPrompt: 'You are a tech reporter.',
            userPrompt: contentPrompt,
            model: 'groq/compound', // or 'llama-3.3-70b-versatile' if using tools manually, but service handles 'groq/compound' specifically
            temperature: 0.7,
            maxTokens: 1000,
            enableWebSearch: true
        });
        const duration = Date.now() - startTime;

        console.log(`⏱️ Duration: ${duration}ms`);
        console.log('TYPE:', typeof response2);
        console.log('📦 Response Content:', response2.content);

        // Verify content
        if (response2.content && response2.content.length > 50) {
            console.log('✅ Content generated successfully.');
        } else {
            console.warn('⚠️ Content seems short or empty.');
        }

    } catch (error) {
        console.error('❌ Test 2 Failed:', error);
    }
}

testGroqIntegration();
