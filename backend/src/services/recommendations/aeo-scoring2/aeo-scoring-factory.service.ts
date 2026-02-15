import { IAEOScoringService } from '../aeo-scoring/base-aeo-scoring.interface';
import { ArticleAEOScoringService } from './article-aeo-scoring.service';
import { WhitepaperAEOScoringService } from './whitepaper-aeo-scoring.service';
import { VideoAEOScoringService } from './video-aeo-scoring.service';
import { PodcastAEOScoringService } from './podcast-aeo-scoring.service';
import { ComparisonTableAEOScoringService } from './comparison-table-aeo-scoring.service';
import { ExpertCommunityResponseAEOScoringService } from './expert-community-response-aeo-scoring.service';
import { SocialMediaAEOScoringService } from './social-media-aeo-scoring.service';

// Reusing ContentType from V1 factory for now, or determining locally. 
// Let's define it here to be self-contained or import if shared.
// For now, let's redefine to matching values.
export type ContentType = 'article' | 'whitepaper' | 'video' | 'short_video' | 'podcast' | 'comparison_table' | 'expert_community_response' | 'social_media_thread';

export class AEOScoringFactory2 {
    private static services: Record<string, IAEOScoringService> = {
        'article': new ArticleAEOScoringService(),
        'whitepaper': new WhitepaperAEOScoringService(),
        'video': new VideoAEOScoringService(),
        'short_video': new VideoAEOScoringService(),
        'podcast': new PodcastAEOScoringService(),
        'comparison_table': new ComparisonTableAEOScoringService(),
        'expert_community_response': new ExpertCommunityResponseAEOScoringService(),
        'social_media_thread': new SocialMediaAEOScoringService()
    };

    public static getService(type: ContentType = 'article'): IAEOScoringService {
        return this.services[type] || this.services['article'];
    }
}
