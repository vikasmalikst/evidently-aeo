import { Request, Response, NextFunction } from 'express';
import { AEOScoringFactory2, ContentType } from '../services/recommendations/aeo-scoring2/aeo-scoring-factory.service';
import { llmAeoScoringService } from '../services/recommendations/aeo-scoring2/llm-aeo-scoring.service';

export const scoreContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { content, contentType } = req.body;

        if (!content && content !== '') {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }

        // Get appropriate service using V2 factory (new criteria: Chunkability, Flesch, Freshness)
        const type: ContentType = (contentType as ContentType) || 'article';
        const scoringService = AEOScoringFactory2.getService(type);

        const result = scoringService.calculateScrapabilityScore(content);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ [AEOScoring] Controller Error:', error);
        next(error);
    }
};

export const scoreLLM = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { content, contentType } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }

        // Currently only supporting 'article' for this specific prompt
        // But we can extend later. For now, use the article service.
        const result = await llmAeoScoringService.scoreArticleWithLLM(content);

        res.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error('❌ [AEOScoring] LLM Scoring Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Analysis failed' });
    }
};
