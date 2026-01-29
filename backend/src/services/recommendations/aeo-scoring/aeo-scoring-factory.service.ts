import { IAEOScoringService } from './base-aeo-scoring.interface';
import { ArticleAEOScoringService } from './article-aeo-scoring.service';
import { WhitepaperAEOScoringService } from './whitepaper-aeo-scoring.service';
import { VideoAEOScoringService } from './video-aeo-scoring.service';
import { PodcastAEOScoringService } from './podcast-aeo-scoring.service';

export type ContentType = 'article' | 'whitepaper' | 'video' | 'podcast';

export class AEOScoringFactory {
    private static services: Record<string, IAEOScoringService> = {
        'article': new ArticleAEOScoringService(),
        'whitepaper': new WhitepaperAEOScoringService(),
        'video': new VideoAEOScoringService(),
        'podcast': new PodcastAEOScoringService()
    };

    public static getService(type: ContentType = 'article'): IAEOScoringService {
        return this.services[type] || this.services['article'];
    }
}
