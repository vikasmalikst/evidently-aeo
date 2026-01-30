import { IAEOScoringService } from './base-aeo-scoring.interface';
import { ArticleAEOScoringService } from './article-aeo-scoring.service';
import { WhitepaperAEOScoringService } from './whitepaper-aeo-scoring.service';
import { VideoAEOScoringService } from './video-aeo-scoring.service';
import { PodcastAEOScoringService } from './podcast-aeo-scoring.service';
import { ComparisonTableAEOScoringService } from './comparison-table-aeo-scoring.service';
import { ExpertCommunityResponseAEOScoringService } from './expert-community-response-aeo-scoring.service';

// Update ContentType to match keys we expect from frontend
export type ContentType = 'article' | 'whitepaper' | 'video' | 'short_video' | 'podcast' | 'comparison_table' | 'expert_community_response';

export class AEOScoringFactory {
    private static services: Record<string, IAEOScoringService> = {
        'article': new ArticleAEOScoringService(),
        'whitepaper': new WhitepaperAEOScoringService(),
        'video': new VideoAEOScoringService(),
        'short_video': new VideoAEOScoringService(), // Map short_video to video scorer
        'podcast': new PodcastAEOScoringService(),
        'comparison_table': new ComparisonTableAEOScoringService(), // Dedicated scorer
        'expert_community_response': new ExpertCommunityResponseAEOScoringService() // Dedicated scorer
    };

    public static getService(type: ContentType = 'article'): IAEOScoringService {
        return this.services[type] || this.services['article'];
    }
}
