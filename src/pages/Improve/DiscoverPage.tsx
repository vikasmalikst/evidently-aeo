/**
 * Discover Page - Step 1 of the Improve workflow
 * 
 * Maps to RecommendationsV3 Step 1: Generate & Review
 * - View all recommendations with status dropdown
 * - Approve/Reject/Pending Review recommendations
 */

import { RecommendationPage } from '../RecommendationPage';

export const DiscoverPage = () => {
  return <RecommendationPage initialStep={1} />;
};
