import { Request, Response, NextFunction } from 'express';
import { AEOScoringFactory2, ContentType } from '../services/recommendations/aeo-scoring2/aeo-scoring-factory.service';

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
