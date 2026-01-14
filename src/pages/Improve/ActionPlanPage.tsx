/**
 * Action Plan Page - Step 2 of the Improve workflow
 * 
 * Maps to RecommendationsV3 Step 2: Review Approved
 * - View approved recommendations
 * - Prepare for content generation
 */

import { RecommendationsV3 } from '../RecommendationsV3';

export const ActionPlanPage = () => {
  return <RecommendationsV3 initialStep={2} />;
};
