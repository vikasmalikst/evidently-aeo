/**
 * Discover Page - Step 1 of the Improve workflow
 * 
 * Maps to RecommendationsV3 Step 1: Generate & Review
 * - View all recommendations with status dropdown
 * - Approve/Reject/Pending Review recommendations
 */

import { RecommendationsV3 } from '../RecommendationsV3';

export const DiscoverPage = () => {
  return <RecommendationsV3 initialStep={1} />;
};
