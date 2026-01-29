import { Request, Response, NextFunction } from 'express';
import { aeoScoringService } from '../services/recommendations/aeo-scoring.service';

export const scoreContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { content } = req.body;

        if (!content && content !== '') {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }

        const result = aeoScoringService.calculateScrapabilityScore(content);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
