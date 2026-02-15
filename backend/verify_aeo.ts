
import { ArticleAEOScoringService } from './src/services/recommendations/aeo-scoring/article-aeo-scoring.service';
import { VideoAEOScoringService } from './src/services/recommendations/aeo-scoring/video-aeo-scoring.service';
import { PodcastAEOScoringService } from './src/services/recommendations/aeo-scoring/podcast-aeo-scoring.service';
import { SocialMediaAEOScoringService } from './src/services/recommendations/aeo-scoring/social-media-aeo-scoring.service';

const articleService = new ArticleAEOScoringService();
const videoService = new VideoAEOScoringService();
const podcastService = new PodcastAEOScoringService();
const socialService = new SocialMediaAEOScoringService();

const sampleArticle = `
# The Future of AI
## Executive Abstract
AI is changing the world.
> The primary answer is that AI automates tasks.
## Key Concepts
### Machine Learning
ML is a subset of AI.
### Deep Learning
DL is a subset of ML.
## Comparison
AI vs Humans: AI is faster.
## Sources
Data from 2024.
`;

const sampleVideo = `
# How to Bake a Cake
## The Hook
(0:00-0:05) Do you want the perfect cake?
## The Quick Win
Use room temperature eggs!
## The Steps
1. Mix flour.
2. Add eggs.
3. Bake at 350.
[Visual: Show eggs cracking]
## The Social Signal
Like and Subscribe!
`;

const samplePodcast = `
# AI Revolution Podcast
## The Core Insight
AI is defined as software that learns.
## Deep Dive
We discussed this for 40 minutes... (long text to simulate depth) ... very deep.
## Key Takeaways
1. AI is here.
2. Adapt or die.
Host: John
Guest: Jane
`;

const sampleSocial = `
## Post 1
Here is the main answer: AI is cool.
## Post 2
It helps with coding.
## Post 3
Check out the code.
## Post 4
Limits: It hallucinates.
`;

console.log("--- Article Score ---");
console.log(JSON.stringify(articleService.calculateScrapabilityScore(sampleArticle), null, 2));

console.log("\n--- Video Score ---");
console.log(JSON.stringify(videoService.calculateScrapabilityScore(sampleVideo), null, 2));

console.log("\n--- Podcast Score ---");
console.log(JSON.stringify(podcastService.calculateScrapabilityScore(samplePodcast), null, 2));

console.log("\n--- Social Score ---");
console.log(JSON.stringify(socialService.calculateScrapabilityScore(sampleSocial), null, 2));
