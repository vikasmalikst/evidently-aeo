import React from 'react';
import { Carousel } from './Carousel';
import { BrandRankingSlide } from './slides/BrandRankingSlide';
import { CitationAnalysisSlide } from './slides/CitationAnalysisSlide';
import { TopicPerformanceSlide } from './slides/TopicPerformanceSlide';
import { PlaceholderSlide } from './slides/PlaceholderSlide';
import { FullExecutiveReportSlide } from './slides/FullExecutiveReportSlide';

export const ExecutiveSummaryCarousel: React.FC = () => {
    return (
        <Carousel>
            <BrandRankingSlide key="page1" />
            <CitationAnalysisSlide key="page2" />
            <TopicPerformanceSlide key="page3" />
            <PlaceholderSlide key="page4" title="Competitor Breakdown (Placeholder)" />
            <PlaceholderSlide key="page5" title="Regional Performance (Placeholder)" />
            <FullExecutiveReportSlide key="page6" />
        </Carousel>
    );
};
