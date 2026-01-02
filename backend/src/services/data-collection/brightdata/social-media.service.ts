import axios from 'axios';
import { BaseBrightDataService } from './base.service';
import { BrightDataRequest, BrightDataResponse } from './types';

export class SocialMediaService extends BaseBrightDataService {
  
  /**
   * Scrapes a Reddit thread or subreddit using BrightData's Reddit Collector
   * Note: This requires a configured Dataset ID for Reddit in BrightData
   */
  async scrapeReddit(url: string): Promise<any> {
    // Reddit Posts Dataset ID: gd_l1vijqt9jfj7olije (using general Reddit Posts dataset ID as discovered)
    // Or specific ones found: gd_l1vijqt9jfj7olije (Reddit Posts)
    const datasetId = process.env.BRIGHTDATA_REDDIT_DATASET_ID || 'gd_l1vijqt9jfj7olije'; 
    
    if (!datasetId) {
        throw new Error('BRIGHTDATA_REDDIT_DATASET_ID not set and no default found.');
    }

    try {
        console.log(`[SocialMediaService] Triggering Reddit collection for ${url} with dataset ${datasetId}`);
        const response = await axios.post(
            `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`,
            [{ url: url }],
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            source: 'reddit',
            url: url,
            status: 'triggered',
            snapshot_id: response.data.snapshot_id,
            message: 'Collection triggered. Poll for results.'
        };
    } catch (error: any) {
        console.error('Reddit collection trigger failed:', error.response?.data || error.message);
        throw error;
    }
  }

  /**
   * Scrapes YouTube video details and transcripts
   */
  async scrapeYouTube(url: string): Promise<any> {
    // YouTube Video Dataset ID: gd_lk9q0ew71spt1mxywf (from search result)
    const datasetId = process.env.BRIGHTDATA_YOUTUBE_DATASET_ID || 'gd_lk9q0ew71spt1mxywf';

    if (!datasetId) {
         throw new Error('BRIGHTDATA_YOUTUBE_DATASET_ID not set and no default found.');
    }

    try {
        console.log(`[SocialMediaService] Triggering YouTube collection for ${url} with dataset ${datasetId}`);
        const response = await axios.post(
            `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`,
            [{ url: url }],
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            source: 'youtube',
            url: url,
            status: 'triggered',
            snapshot_id: response.data.snapshot_id,
            message: 'Collection triggered. Poll for results.'
        };
    } catch (error: any) {
        console.error('YouTube collection trigger failed:', error.response?.data || error.message);
        throw error;
    }
  }

  /**
   * Scrapes TikTok profile or video
   */
  async scrapeTikTok(url: string): Promise<any> {
    // TikTok Dataset ID: gd_l1villgoiiidt09ci (from search result for Profiles)
    // Or gd_lu702nij2f790tmv9h (from search result for Videos/Scraper)
    // Defaulting to video/scraper for general usage if url contains 'video', else profile
    const isVideo = url.includes('/video/');
    const datasetId = isVideo 
        ? (process.env.BRIGHTDATA_TIKTOK_VIDEO_DATASET_ID || 'gd_lu702nij2f790tmv9h')
        : (process.env.BRIGHTDATA_TIKTOK_PROFILE_DATASET_ID || 'gd_l1villgoiiidt09ci');

    try {
        console.log(`[SocialMediaService] Triggering TikTok collection for ${url} with dataset ${datasetId}`);
        const response = await axios.post(
            `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`,
            [{ url: url }],
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            source: 'tiktok',
            url: url,
            status: 'triggered',
            snapshot_id: response.data.snapshot_id,
            message: 'Collection triggered. Poll for results.'
        };
    } catch (error: any) {
        console.error('TikTok collection trigger failed:', error.response?.data || error.message);
        throw error;
    }
  }

  async executeQuery(request: BrightDataRequest): Promise<BrightDataResponse> {
     throw new Error('SocialMediaService does not support generic prompt queries.');
  }
}

export const socialMediaService = new SocialMediaService();
