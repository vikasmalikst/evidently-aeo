import { TopicsAnalysisPage } from './TopicsAnalysis/TopicsAnalysisPage';
import { mockTopicsAnalysisData } from './TopicsAnalysis/mockData';

export const Topics = () => {
  return (
    <TopicsAnalysisPage
      data={mockTopicsAnalysisData}
      onTopicClick={(topic) => {
        // Future: Open drill-down detail panel
        console.log('Topic clicked:', topic);
      }}
      onCategoryFilter={(categoryId) => {
        // Future: Filter table by category
        console.log('Category filtered:', categoryId);
      }}
    />
  );
};
