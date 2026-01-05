# Frequently Asked Questions (FAQ)

## Table of Contents
1. [Getting Started](#getting-started)
2. [Onboarding & Setup](#onboarding--setup)
3. [Understanding Your Data](#understanding-your-data)
4. [Dashboard & Metrics](#dashboard--metrics)
5. [Data Collection & Processing](#data-collection--processing)
6. [Recommendations](#recommendations)
7. [Topics & Queries](#topics--queries)
8. [Competitors & Benchmarking](#competitors--benchmarking)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)
11. [Technical Questions](#technical-questions)

---

## Getting Started

### What is AnswerIntel (AEO Platform)?

AnswerIntel is an Answer Engine Optimization (AEO) platform that helps brands monitor and improve their visibility in AI-powered answer engines like ChatGPT, Claude, Perplexity, Gemini, Bing Copilot, and Grok. The platform tracks how often your brand appears in AI responses, analyzes sentiment, measures your share of answers, and provides actionable recommendations to improve your AI visibility.

### Who should use AnswerIntel?

AnswerIntel is designed for:
- **Marketing teams** looking to optimize brand visibility in AI search results
- **SEO professionals** expanding their strategy to include answer engine optimization
- **Brand managers** monitoring how their brand is represented in AI responses
- **Competitive intelligence teams** tracking brand performance vs. competitors
- **Content strategists** seeking data-driven insights for content optimization

### What do I need to get started?

To get started with AnswerIntel, you'll need:
- A registered account
- Your brand name or website URL
- Basic information about your industry
- (Optional) Competitor names for benchmarking

No technical setup or API keys are required on your end - everything is handled by the platform.

---

## Onboarding & Setup

### How does the onboarding process work?

The onboarding process consists of three main steps:

1. **Brand Selection**: Enter your brand name or website URL. The system will automatically verify and enrich your brand information.

2. **Competitor Selection**: Select your main competitors from suggested options or add custom competitors. This helps benchmark your performance.

3. **Setup Configuration**: 
   - Choose which AI models (collectors) to track (ChatGPT, Claude, Perplexity, Gemini, etc.)
   - Review and select topics relevant to your brand
   - Configure search prompts/queries

After setup, the system automatically generates queries, collects data from selected AI models, and processes the results.

### How long does onboarding take?

The initial onboarding typically takes 5-10 minutes. After you complete the setup:
- Query generation happens automatically (usually within minutes)
- Data collection begins immediately and runs in the background
- Initial scoring and analytics are typically available within 1-2 hours

You'll receive a notification when your dashboard is ready with initial data.

### Can I add multiple brands?

Yes! You can manage multiple brands from your account. Each brand is tracked independently with its own dashboard, metrics, and recommendations. Use the brand selector in the header to switch between brands.

### What if my brand isn't recognized during onboarding?

If the system doesn't recognize your brand:
1. Try entering your full website URL (e.g., `https://example.com`)
2. Use your company's legal name
3. Contact support - we can manually add your brand

The system will still work with basic information, though enriched data (logo, industry details) may be limited.

### Can I skip or modify topics after onboarding?

Yes! You can manage topics at any time through the Brand Settings page. You can:
- Add new topics
- Remove inactive topics
- Edit topic names and descriptions
- Regenerate queries for topics

Changes will trigger new data collection for the updated topics.

---

## Understanding Your Data

### What is Visibility Index?

**Visibility Index** measures how prominently your brand appears in AI answer engine responses. It's calculated based on:
- How often your brand is mentioned
- The position of mentions in responses
- The context and prominence of mentions

A higher visibility index means your brand appears more frequently and prominently in AI responses.

### What is Share of Answer (SOA)?

**Share of Answer (SOA)** represents the percentage of total mentions in AI responses that belong to your brand versus competitors. For example:
- If there are 10 total brand mentions in responses and 6 are yours, your SOA is 60%
- Higher SOA indicates stronger brand dominance in AI responses

### What is Sentiment Score?

**Sentiment Score** analyzes the tone and sentiment of how your brand is mentioned in AI responses:
- **Positive**: Favorable mentions, positive associations
- **Neutral**: Factual, informational mentions
- **Negative**: Critical or unfavorable mentions

The score ranges from -100 (very negative) to +100 (very positive).

### How are metrics calculated?

Metrics are calculated through a multi-step process:

1. **Data Collection**: Queries are executed across selected AI models (ChatGPT, Claude, etc.)
2. **Position Extraction**: The system identifies where your brand and competitors are mentioned in responses
3. **Scoring**: Automated scoring analyzes:
   - Mention frequency and position
   - Sentiment analysis
   - Citation sources
   - Competitor comparisons
4. **Aggregation**: Metrics are aggregated across all queries, topics, and time periods

All scoring happens automatically in the background.

### What time period does the dashboard show?

By default, the dashboard shows the last 30 days of data. You can adjust the date range using the date selector to view:
- Last 7 days
- Last 30 days (default)
- Last 90 days
- Custom date ranges

Historical data is available from when you first set up your brand.

---

## Dashboard & Metrics

### What does the dashboard show?

The dashboard provides a comprehensive overview of your AI visibility performance:

- **Key Metrics**: Visibility Index, Share of Answer (SOA), Sentiment Score, and trends
- **LLM Visibility Table**: Performance breakdown by AI model (ChatGPT, Claude, Perplexity, etc.)
- **Top Topics**: Which topics drive the most visibility
- **Top Brand Sources**: Which websites/citations mention your brand most
- **Time Series Charts**: Trends over time for key metrics
- **Recommended Actions**: AI-powered recommendations to improve performance

### Why do I see zeros or missing data?

Missing data can occur for several reasons:

1. **Data Collection Still Running**: If you just completed onboarding, data collection may still be in progress. Check the notification bell for progress updates.

2. **No Results Found**: Some queries may not return results mentioning your brand. This is normal - not every query will have brand mentions.

3. **Scoring Pending**: Data may be collected but not yet scored. Scoring typically completes within 1-2 hours of collection.

4. **Inactive Queries**: Ensure your queries are marked as active in Brand Settings.

If data is missing for more than 24 hours after setup, contact support.

### How often is data updated?

- **Data Collection**: Runs automatically when queries are created or updated
- **Scoring**: Happens automatically after each data collection cycle (typically within 1-2 hours)
- **Dashboard Refresh**: Updates in real-time when you refresh the page or change date ranges

You can manually trigger data collection for specific queries or topics from the Brand Settings page.

### What is the difference between "Brand Mentions" and "Product Mentions"?

- **Brand Mentions**: Direct mentions of your brand name or company
- **Product Mentions**: Mentions of specific products, services, or offerings from your brand

Both are tracked separately to give you a complete picture of how your brand and products appear in AI responses.

### How do I interpret the LLM Visibility Table?

The LLM Visibility Table shows your performance across different AI models:
- **ChatGPT**: OpenAI's ChatGPT responses
- **Claude**: Anthropic's Claude responses
- **Perplexity**: Perplexity AI search results
- **Gemini**: Google's Gemini responses
- **Bing Copilot**: Microsoft's Bing Copilot responses
- **Grok**: X's Grok responses

Each row shows:
- Visibility Index for that model
- Share of Answer percentage
- Sentiment Score
- Number of mentions

Use this to identify which AI models are most important for your brand and where you need to focus optimization efforts.

---

## Data Collection & Processing

### Which AI models does AnswerIntel track?

AnswerIntel tracks responses from:
- **ChatGPT** (via OpenAI or Oxylabs)
- **Claude** (via OpenRouter)
- **Perplexity** (via Oxylabs)
- **Gemini** (via BrightData)
- **Bing Copilot** (via BrightData)
- **Grok** (via BrightData)

You can select which models to track during setup or modify them later in Brand Settings.

### How are queries executed?

Queries are automatically generated based on your selected topics during onboarding. Each query is:
1. Executed across all selected AI models
2. Responses are collected and stored
3. Analyzed for brand and competitor mentions
4. Scored for visibility, sentiment, and share of answer

Queries are executed asynchronously in the background - you don't need to wait for them to complete.

### How long does data collection take?

Data collection time varies based on:
- Number of queries (typically 20-50 per brand)
- Number of AI models selected (each query runs across all models)
- API response times

Typically:
- **Small setup** (20 queries, 3 models): 30-60 minutes
- **Medium setup** (50 queries, 5 models): 1-2 hours
- **Large setup** (100+ queries, 6 models): 2-4 hours

You can monitor progress using the notification bell icon in the header.

### What happens if data collection fails?

If data collection fails for specific queries or models:
1. The system automatically retries failed queries
2. Failed attempts are logged for troubleshooting
3. You'll see partial data - successful collections are still processed
4. You can manually retry failed queries from Brand Settings

If you see persistent failures, contact support with the specific error messages.

### Can I add custom queries?

Yes! You can add custom queries through:
1. **Brand Settings** → **Topic Management** → Add queries to existing topics
2. **Prompts Page** → Create new queries manually

Custom queries are immediately added to the collection queue and will be executed across all selected AI models.

---

## Recommendations

### How are recommendations generated?

Recommendations are generated using AI analysis of your actual performance data. The system:

1. **Analyzes Your Metrics**: Reviews visibility, SOA, sentiment, and trends
2. **Identifies Problems**: Detects specific issues (low visibility, declining trends, poor sentiment)
3. **Compares Performance**: Benchmarks against competitors and historical data
4. **Generates Actions**: Creates specific, actionable recommendations with:
   - What to do (action)
   - Why it matters (reason)
   - Expected impact (boost)
   - Effort required (low/medium/high)
   - Timeline estimate

### What types of recommendations will I receive?

Recommendations fall into several categories:

- **Visibility Improvements**: Actions to increase brand mentions in AI responses
- **Share of Answer Optimization**: Strategies to outperform competitors
- **Sentiment Enhancement**: Tactics to improve how your brand is mentioned
- **Citation Source Focus**: Recommendations to improve specific source citations
- **Content Strategy**: Suggestions for content that drives AI visibility
- **Topic Optimization**: Focus areas for specific topics or queries

### How are recommendations prioritized?

Recommendations are ranked using a scientific scoring system based on:
- **Impact Score**: Expected improvement in key metrics
- **Confidence**: How certain we are the recommendation will work
- **Effort**: Low/Medium/High effort required
- **Trend Urgency**: Whether metrics are declining and need immediate attention
- **KPI Alignment**: Which KPI (Visibility, SOA, Sentiment) it targets

High-priority recommendations appear first and are marked with priority badges.

### Can I track recommendation implementation?

Yes! In the Recommendations page, you can:
- Mark recommendations as "Approved" when you decide to implement them
- Mark as "In Progress" while working on them
- Mark as "Completed" when finished
- Generate content drafts for recommendations (if available)

The system tracks which recommendations you've implemented to help measure ROI.

### How often are recommendations updated?

Recommendations are regenerated:
- **Automatically**: When significant changes in your metrics are detected
- **On Demand**: You can manually trigger regeneration from the Recommendations page
- **After Data Refresh**: When new data collection completes

We recommend reviewing recommendations monthly or after major content/SEO changes.

---

## Topics & Queries

### What are topics?

**Topics** are high-level categories that represent areas where users might search for information related to your brand. Examples:
- "Product Features"
- "Pricing & Plans"
- "Integration Guides"
- "Customer Support"
- "Company Overview"

Topics help organize queries and provide a structured view of your AI visibility across different subject areas.

### How are topics generated?

Topics are automatically generated during onboarding using AI analysis of:
- Your brand name and industry
- Your brand description
- Competitor information
- Industry context

Topics are organized by **Intent Archetypes**:
- `best_of` - Finding the best option
- `comparison` - Comparing options
- `alternatives` - Looking for alternatives
- `pricing_or_value` - Price/value questions
- `use_case` - Specific use cases
- `how_to` - How-to questions
- `problem_solving` - Problem-solving queries
- `beginner_explain` - Beginner explanations
- `expert_explain` - Expert explanations
- `technical_deep_dive` - Technical deep dives

### What are queries?

**Queries** are the actual search questions that are executed across AI models. Each topic has one or more associated queries. For example:

**Topic**: "Payment Processing Integration"
**Query**: "How do I integrate payment processing into my website?"

Queries are written in natural language (without brand names) to simulate how real users would search.

### Can I edit or delete queries?

Yes! You can:
- **Edit queries**: Modify the text to better match your content strategy
- **Delete queries**: Remove queries that aren't relevant
- **Add queries**: Create new queries for existing topics
- **Regenerate queries**: Let AI generate new queries for a topic

Changes take effect immediately and trigger new data collection.

### Why do some topics show 0 queries?

Topics may show 0 queries if:
1. **Queries haven't been generated yet**: This can happen if query generation encountered an error
2. **Queries were deleted**: Previous queries were removed
3. **Topic is new**: Recently added topics may not have queries yet

You can manually add queries or regenerate them for any topic.

### How many queries should I have?

The ideal number varies by brand, but typically:
- **Small brands**: 20-30 queries across 5-10 topics
- **Medium brands**: 50-100 queries across 10-20 topics
- **Large brands**: 100+ queries across 20+ topics

More queries provide more comprehensive coverage but take longer to collect and process. Start with the automatically generated set and add more based on your needs.

---

## Competitors & Benchmarking

### How do I add or remove competitors?

You can manage competitors through:
1. **Onboarding**: Select competitors during initial setup
2. **Brand Settings**: Add or remove competitors at any time
3. **Competitors Page**: Dedicated page for competitor management

Changes to competitors will update benchmarking data in your dashboard.

### How is competitor performance tracked?

Competitor performance is tracked the same way as your brand:
- Visibility Index in AI responses
- Share of Answer percentage
- Sentiment scores
- Mention frequency and position

You can compare your performance against competitors in:
- Dashboard overview metrics
- LLM Visibility Table
- Topics Analysis page
- Time series charts

### Can I track more than 5 competitors?

Yes! There's no hard limit on the number of competitors you can track. However, tracking many competitors may:
- Increase data collection time
- Make dashboards more complex
- Require more processing resources

We recommend focusing on your top 5-10 direct competitors for the most actionable insights.

### What if a competitor isn't recognized?

If a competitor isn't automatically recognized:
1. Try entering their full website URL
2. Use their official company name
3. Add them manually - the system will still track mentions even without enriched data

The tracking will work with basic competitor names.

---

## Troubleshooting

### Dashboard shows "No data available"

If your dashboard shows no data:

1. **Check Data Collection Status**: Look for the notification bell icon - it shows if collection is in progress
2. **Verify Queries Are Active**: Go to Brand Settings → Topics and ensure queries are marked as active
3. **Check Date Range**: Ensure your selected date range includes when data was collected
4. **Wait for Processing**: If you just completed setup, wait 1-2 hours for initial data collection and scoring

If data is still missing after 24 hours, contact support.

### Metrics show zeros or seem incorrect

If metrics show zeros:

1. **Verify Brand Name**: Ensure your brand name matches how it appears in AI responses (check for typos, abbreviations)
2. **Check Query Results**: Some queries may not return brand mentions - this is normal
3. **Review Scoring Status**: Data may be collected but not yet scored - check the notification bell
4. **Validate Date Range**: Make sure you're looking at a time period when data was collected

If specific metrics consistently show zeros, it may indicate your brand isn't appearing in AI responses for those queries - this is valuable insight for optimization.

### Notification bell shows data collection in progress for a long time

If data collection seems stuck:

1. **Check Backend Status**: Ensure the backend server is running
2. **Review Query Count**: Large numbers of queries take longer to process
3. **Check API Status**: Some AI model APIs may be experiencing delays
4. **Contact Support**: If collection has been running for more than 4 hours, contact support

You can check detailed progress in the Progress Modal (click the notification bell).

### Can't see recommendations

If recommendations aren't appearing:

1. **Check Data Availability**: Recommendations require sufficient data to analyze - ensure you have at least 1-2 weeks of data
2. **Verify Metrics Exist**: Recommendations are generated based on detected problems - if metrics are all positive, there may be no recommendations
3. **Trigger Regeneration**: Try manually regenerating recommendations from the Recommendations page
4. **Check Date Range**: Ensure you're viewing recommendations for a time period with data

Recommendations are only generated when the system detects specific issues or optimization opportunities.

### Queries aren't executing

If queries aren't running:

1. **Verify Queries Are Active**: In Brand Settings, ensure queries have `is_active = true`
2. **Check AI Model Selection**: Ensure at least one AI model is selected
3. **Review Backend Logs**: Check for error messages in the backend console
4. **Manual Trigger**: Try manually triggering query execution from Brand Settings

If queries consistently fail, there may be an API configuration issue - contact support.

### Brand name not being detected in responses

If your brand isn't being detected:

1. **Check Brand Aliases**: Add common variations of your brand name in Brand Settings (e.g., "Stripe" and "Stripe Inc.")
2. **Review Response Content**: Check if your brand actually appears in the AI responses for those queries
3. **Verify Spelling**: Ensure brand name is spelled correctly in your brand settings
4. **Check Product Names**: If you have products, ensure product names are also configured

The system uses fuzzy matching, but very different spellings or abbreviations may not be detected.

---

## Best Practices

### How often should I check my dashboard?

We recommend:
- **Weekly**: Review key metrics and trends
- **Monthly**: Deep dive into recommendations and implement changes
- **After Major Changes**: Check dashboard after launching new content, products, or marketing campaigns

Set up a regular cadence that works for your team - consistency is key to tracking improvements.

### What should I focus on first?

Priority areas depend on your goals, but generally:

1. **Low Visibility**: If visibility is low, focus on content creation and citation source improvement
2. **Low SOA**: If competitors are outperforming, focus on competitive content and source partnerships
3. **Negative Sentiment**: If sentiment is poor, focus on reputation management and positive content
4. **Declining Trends**: If metrics are dropping, investigate recent changes and implement recommendations

Start with the highest-priority recommendations from your Recommendations page.

### How can I improve my Visibility Index?

To improve Visibility Index:

1. **Create High-Quality Content**: Publish comprehensive, authoritative content on topics relevant to your brand
2. **Optimize Citation Sources**: Focus on getting cited by high-authority sources that AI models reference
3. **Build Brand Mentions**: Increase mentions across the web through PR, partnerships, and content marketing
4. **Topic Coverage**: Ensure you have content covering all topics where users search
5. **Regular Updates**: Keep content fresh and up-to-date - AI models favor recent, relevant information

### How can I improve my Share of Answer (SOA)?

To improve SOA:

1. **Competitive Content**: Create content that directly addresses comparison queries
2. **Unique Value Props**: Highlight what makes you different from competitors
3. **Source Authority**: Build relationships with authoritative sources that cite your brand
4. **Comprehensive Coverage**: Ensure your content is more comprehensive than competitors
5. **Regular Monitoring**: Track competitor performance and adjust strategy accordingly

### How long does it take to see improvements?

Improvement timelines vary:

- **Quick Wins** (content updates, source fixes): 1-2 weeks
- **Medium Efforts** (new content, partnerships): 2-4 weeks
- **Long-term Strategy** (brand building, authority): 1-3 months

AI models update their knowledge bases regularly, but changes may take time to reflect. Be patient and consistent with your optimization efforts.

### Should I track all AI models?

We recommend tracking:
- **Must Track**: ChatGPT, Claude (most popular models)
- **Should Track**: Perplexity, Gemini (growing in popularity)
- **Optional**: Bing Copilot, Grok (niche but valuable for specific audiences)

Start with 3-4 models and expand based on where your audience searches. You can always add or remove models later.

---

## Technical Questions

### What APIs does AnswerIntel use?

AnswerIntel integrates with multiple APIs for data collection:
- **OpenAI API**: For ChatGPT responses (direct or via Oxylabs)
- **OpenRouter API**: For Claude responses
- **Oxylabs API**: For ChatGPT and Perplexity (proxy service)
- **BrightData API**: For Gemini, Bing Copilot, and Grok
- **Cerebras API**: For AI-powered topic and query generation
- **Supabase**: For database and authentication

All API integrations are handled by the platform - no API keys required from users.

### How is my data stored and secured?

- **Database**: Data is stored in Supabase (PostgreSQL) with encryption at rest
- **Authentication**: JWT-based authentication with secure token storage
- **API Security**: All API endpoints require authentication
- **Data Privacy**: Your data is isolated per customer account
- **Backups**: Regular automated backups ensure data safety

We follow industry best practices for data security and privacy.

### Can I export my data?

Data export functionality is available through:
- **Dashboard Data**: Export metrics and charts as CSV/PDF
- **API Access**: Programmatic access to your data via REST API
- **Reports**: Generate custom reports with selected metrics

Contact support for bulk data export or API access setup.

### Does AnswerIntel work with my existing SEO tools?

AnswerIntel complements traditional SEO tools by focusing specifically on AI answer engines. You can:
- Use AnswerIntel alongside Google Analytics, Search Console, etc.
- Export data to integrate with your existing analytics stack
- Use insights to inform both SEO and AEO strategies

AnswerIntel focuses on AI visibility, while traditional SEO tools focus on search engine rankings.

### What browsers are supported?

AnswerIntel works best on:
- **Chrome** (latest version) - Recommended
- **Firefox** (latest version)
- **Safari** (latest version)
- **Edge** (latest version)

We recommend using the latest version of your browser for the best experience.

### Is there a mobile app?

Currently, AnswerIntel is web-based and optimized for desktop and tablet use. The dashboard is responsive and works on mobile browsers, but for the best experience, we recommend using a desktop or tablet.

Mobile app development is planned for the future.

### How do I report bugs or request features?

You can:
1. **In-App Feedback**: Use the feedback button in the dashboard
2. **Email Support**: Contact support@answerintel.com
3. **Feature Requests**: Submit through the feedback form or support email

We review all feedback and prioritize based on user needs and impact.

---

## Still Have Questions?

If you have questions not covered in this FAQ:

- **Email Support**: support@answerintel.com
- **In-App Help**: Look for the "?" icon or help tooltips throughout the platform
- **Documentation**: Check our documentation pages for detailed guides
- **Status Page**: Visit our status page for system updates and maintenance notices

We're here to help you succeed with Answer Engine Optimization!

---

*Last Updated: January 2025*

