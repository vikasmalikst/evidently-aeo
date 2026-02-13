
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// User specified "groq/compound" for native tool use
const TARGET_MODEL = 'groq/compound';

async function run() {
    console.log(`� Starting Groq Compound Test (Model: ${TARGET_MODEL})...`);

    const systemPrompt = `
You are a professional content writer and research agent specializing in SEO‑oriented, long‑form articles.
Your task is:
1. **Mandatory Web Search**: You MUST use your built-in web search tool effectively.
   - Trigger search IMMEDIATELY when asked for facts, statistics, pricing, or recent events (2024-2026).
   - Do NOT rely on training data for numbers or specific product details (like "Magnet Kitchens prices").
   - Verify every claim with live data.

2. **Research & Synthesis**: 
   - Research the topic thoroughly.
   - Synthesize clear, accurate, and well‑structured information.
   - Cite your sources where possible or mention "according to recent listings".

3. **Content Structure**:
   - Write a response in fluent, professional English.
   - Structure with a short introduction, 3–5 main sections with subheadings, and a conclusion.

4. **Tone & Style**:
   - Tone: Informative, accessible, expert, "no-fluff".
   - Audience: Homeowners and DIY enthusiasts (or specific audience from prompt).
`;

    const userPrompt = `
Craft an expert community response on reddit.com, providing detailed insights and advice on kitchen installation costs, including factors that affect pricing and tips for budgeting, showcasing Magnet Kitchens' expertise and commitment to customer education.
Focus on:
- Real-world pricing examples for 2025/2026.
- Hidden costs to watch out for.
- How Magnet compares to generic competitors.
`;

    try {
        const completion = await groq.chat.completions.create({
            model: TARGET_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ] as any,
            temperature: 0.7,
            max_tokens: 2000,
        });

        console.log("\n🤖 Final Response:\n");
        console.log(completion.choices[0].message.content);

        // Check for executed tools info if available in the raw response
        // Note: The Node SDK types might not strictly support 'executed_tools' yet on the message object,
        // so we access it safely if it exists on the 'any' typed object.
        const message: any = completion.choices[0].message;
        if (message.executed_tools) {
            console.log("\n🛠️ Tools Used:", JSON.stringify(message.executed_tools, null, 2));
        } else if (message.tool_calls) {
            console.log("\n🛠️ Tool Calls (Server-side):", JSON.stringify(message.tool_calls, null, 2));
        }

    } catch (error: any) {
        console.error("❌ Groq API Error:", error.result || error.message || error);

        // Detailed error logging to see if 'groq/compound' is rejected
        if (error.response) {
            console.error("Data:", error.response.data);
        }
    }
}

run();
