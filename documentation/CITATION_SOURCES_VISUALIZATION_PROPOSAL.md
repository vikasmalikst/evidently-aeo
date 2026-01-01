# Citation Sources Visualization Proposal
## Multi-Dimensional Analysis for Brand & Content Managers

---

## Executive Summary

This proposal outlines an enhanced visualization strategy for Citation Sources that maximizes insights for Brand Managers and Content Managers. The goal is to highlight correlations between **Visibility**, **Share of Answers (SOA)**, and **Sentiment** while providing actionable intelligence for strategic decision-making.

---

## Current Data Available

### Core Metrics Per Source:
- **Mention Rate (%)**: How often the source is cited (0-100%)
- **Share of Answer (SOA) (%)**: Average brand share when source is cited (0-100%)
- **Sentiment**: Average sentiment score (-1 to +1, where +1 is very positive)
- **Citations**: Total number of citations
- **Source Type**: brand, editorial, corporate, reference, ugc, institutional
- **Topics**: Array of topics the source covers
- **Prompts**: Array of prompts where source appears
- **Pages**: Array of pages from the source
- **Change Metrics**: Period-over-period changes for all metrics

---

## Proposed Visualization Strategy

### 🎯 **Primary Visualization: Enhanced Multi-Dimensional Quadrant Matrix**

#### **Concept: Strategic Source Positioning Map**

A quadrant-based scatter/bubble chart that positions sources based on their strategic value:

```
┌─────────────────────────────────────────────────────────┐
│         HIGH VISIBILITY, HIGH SENTIMENT                 │
│         ╔═══════════════════════════════════╗           │
│         ║  PRIORITY PARTNERSHIPS            ║           │
│         ║  • High visibility                ║           │
│         ║  • Positive sentiment              ║           │
│         ║  • Strategic focus                 ║           │
│         ╚═══════════════════════════════════╝           │
│                                                          │
│  HIGH VISIBILITY, LOW SENTIMENT                         │
│  ╔═══════════════════════════════════╗                  │
│  ║  REPUTATION MANAGEMENT             ║                  │
│  ║  • High visibility                 ║                  │
│  ║  • Negative/neutral sentiment      ║                  │
│  ║  • Requires attention              ║                  │
│  ╚═══════════════════════════════════╝                  │
│                                                          │
│  LOW VISIBILITY, HIGH SENTIMENT                          │
│  ╔═══════════════════════════════════╗                  │
│  ║  GROWTH OPPORTUNITIES              ║                  │
│  ║  • Low visibility                  ║                  │
│  ║  • Positive sentiment              ║                  │
│  ║  • Expansion potential             ║                  │
│  ╚═══════════════════════════════════╝                  │
│                                                          │
│  LOW VISIBILITY, LOW SENTIMENT                           │
│  ╔═══════════════════════════════════╗                  │
│  ║  MONITOR                          ║                  │
│  ║  • Low visibility                  ║                  │
│  ║  • Negative sentiment              ║                  │
│  ║  • Low priority                    ║                  │
│  ╚═══════════════════════════════════╝                  │
└─────────────────────────────────────────────────────────┘
```

**Axes:**
- **X-Axis**: Mention Rate (Visibility) - "How often is this source cited?"
- **Y-Axis**: Share of Answer (SOA) - "How much brand presence when cited?"
- **Bubble Size**: Sentiment Score (larger = more positive)
- **Bubble Color**: Source Type (editorial, corporate, etc.)
- **Bubble Opacity**: Citation Count (more citations = more opaque)

**Quadrant Thresholds:**
- **X-Midpoint**: Median Mention Rate
- **Y-Midpoint**: Median SOA
- **Sentiment Threshold**: 0.3 (positive) / -0.1 (negative)

---

### 📊 **Secondary Visualizations**

#### 1. **Correlation Heatmap Matrix**
A matrix showing correlations between all metrics:

```
                Mention Rate  SOA  Sentiment  Citations
Mention Rate        1.00     0.65    0.42      0.78
SOA                0.65      1.00    0.58      0.45
Sentiment          0.42      0.58    1.00      0.23
Citations          0.78      0.45    0.23      1.00
```

**Use Case**: Identify which metrics move together, helping understand source performance patterns.

#### 2. **Source Performance Radar Chart**
Multi-dimensional view of top 5-10 sources:

```
        Mention Rate
            /\
           /  \
          /    \
    SOA /      \ Sentiment
       /        \
      /          \
     / Citations  \
    /______________\
```

**Metrics on Axes:**
- Mention Rate (normalized 0-100)
- SOA (0-100)
- Sentiment (normalized -1 to +1, scaled to 0-100)
- Citations (normalized by max)
- Topic Coverage (number of topics)

**Use Case**: Quick comparison of top sources across all dimensions.

#### 3. **Source Value Score Dashboard**
Composite scoring system:

**Value Score Formula:**
```
Value Score = (Mention Rate × 0.3) + 
              (SOA × 0.3) + 
              (Sentiment × 0.2) + 
              (Citation Count × 0.1) + 
              (Topic Diversity × 0.1)
```

**Visualization**: Horizontal bar chart with color coding:
- 🟢 Green (80-100): High-value sources - prioritize relationships
- 🟡 Yellow (50-79): Medium-value sources - maintain relationships
- 🔴 Red (0-49): Low-value sources - monitor or optimize

#### 4. **Trend Analysis: Multi-Metric Time Series**
Line chart showing how key metrics evolve over time:

```
Mention Rate ────────
SOA          ────────
Sentiment    ────────
```

**Use Case**: Identify sources with improving/declining performance trends.

#### 5. **Source Type Performance Comparison**
Grouped bar chart comparing average metrics by source type:

```
        Editorial  Corporate  Reference  UGC  Institutional
Mention Rate  ████    ████      ████    ████    ████
SOA           ████    ████      ████    ████    ████
Sentiment     ████    ████      ████    ████    ████
```

**Use Case**: Understand which source types perform best for the brand.

---

## Implementation Priority

### **Phase 1: Core Enhancements (High Priority)**
1. ✅ Enhanced Quadrant Matrix with clear labels and zones
2. ✅ Source Value Score calculation and ranking
3. ✅ Improved tooltips with all metrics and actionable insights
4. ✅ Filter by quadrant/zone

### **Phase 2: Advanced Analytics (Medium Priority)**
1. Correlation Heatmap Matrix
2. Source Performance Radar Chart (top 10 sources)
3. Trend Analysis Time Series
4. Source Type Performance Comparison

### **Phase 3: Strategic Features (Lower Priority)**
1. Exportable insights report
2. Automated recommendations based on quadrant position
3. Source relationship network graph
4. Competitive benchmarking overlay

---

## User Experience Enhancements

### **Interactive Features:**

1. **Quadrant Filtering**
   - Click quadrant labels to filter sources
   - "Show only Priority Partnerships"
   - "Show only Reputation Management needs"

2. **Smart Tooltips**
   ```
   Source: techcrunch.com
   ──────────────────────────
   📊 Performance:
   • Mention Rate: 45% (↑ 5%)
   • Share of Answer: 68% (↑ 2%)
   • Sentiment: +0.72 (↑ 0.1)
   • Citations: 234
   
   🎯 Strategic Value: HIGH
   💡 Recommendation: 
   Maintain strong relationship. 
   High visibility with positive 
   sentiment makes this a priority 
   partnership source.
   ```

3. **Source Comparison Mode**
   - Select 2-3 sources to compare side-by-side
   - Show metrics in parallel columns
   - Highlight differences

4. **Actionable Insights Panel**
   - Auto-generated recommendations per source
   - Based on quadrant position and trends
   - Example: "This source has high visibility but negative sentiment. Consider outreach to improve brand perception."

---

## Brand Manager Use Cases

### **Strategic Planning:**
- **Identify Priority Partnerships**: Sources in top-right quadrant (high visibility + high sentiment)
- **Reputation Management**: Sources in top-left quadrant (high visibility + low sentiment)
- **Growth Opportunities**: Sources in bottom-right quadrant (low visibility + high sentiment)

### **Content Strategy:**
- **Topic Focus**: Which topics drive highest SOA?
- **Source Type Optimization**: Which source types perform best?
- **Content Gap Analysis**: Which high-value sources aren't being cited enough?

### **Relationship Management:**
- **Partnership Prioritization**: Rank sources by Value Score
- **Outreach Planning**: Identify sources needing attention
- **Performance Tracking**: Monitor source performance over time

---

## Content Manager Use Cases

### **Content Optimization:**
- **High-Value Source Analysis**: What content from top sources gets cited?
- **Topic Coverage**: Which topics are covered by best-performing sources?
- **Content Gap Identification**: What topics are missing from high-value sources?

### **SEO & Visibility:**
- **Citation Opportunities**: Identify sources with high visibility but low brand presence
- **Content Syndication**: Partner with sources in "Growth Opportunities" quadrant
- **Link Building**: Focus on sources with high SOA

### **Performance Monitoring:**
- **Trend Analysis**: Track which sources are improving/declining
- **Competitive Analysis**: Compare brand sources vs competitor sources
- **ROI Measurement**: Track impact of content partnerships

---

## Technical Implementation Notes

### **Data Processing:**
```typescript
interface EnhancedSourceData extends SourceData {
  valueScore: number;           // Composite score 0-100
  quadrant: 'priority' | 'reputation' | 'growth' | 'monitor';
  trend: 'improving' | 'stable' | 'declining';
  correlation: {
    mentionRateSOA: number;
    mentionRateSentiment: number;
    soaSentiment: number;
  };
}
```

### **Visualization Libraries:**
- **Quadrant Matrix**: Enhanced Chart.js Bubble Chart with custom plugins
- **Correlation Heatmap**: Custom D3.js or Chart.js heatmap
- **Radar Chart**: Chart.js Radar Chart
- **Time Series**: Chart.js Line Chart with multiple datasets

### **Performance Considerations:**
- Cache correlation calculations
- Lazy load trend data
- Virtual scrolling for large source lists
- Debounced filtering/search

---

## Success Metrics

### **User Engagement:**
- Time spent on visualization
- Number of sources explored
- Filter usage frequency
- Export/download frequency

### **Business Impact:**
- Sources identified for partnership
- Content strategy changes based on insights
- Relationship management actions taken
- Improvement in source performance metrics

---

## Visual Mockup Summary

### **Main Dashboard Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Answer Sources - Strategic Source Analysis                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Filters: Source Type | Topic | Sentiment | Quadrant]      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  QUADRANT MATRIX (Primary View)                    │    │
│  │  [Interactive bubble chart with quadrants]         │    │
│  │  [Legend: Size=Sentiment, Color=Type]             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Value Score  │  │ Correlation  │  │ Top Sources  │     │
│  │   Ranking    │  │   Heatmap    │  │   Radar      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  SOURCE TABLE (Sortable, Filterable)               │    │
│  │  [Columns: Name, Type, Metrics, Value Score, ...] │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Review & Approval**: Get stakeholder feedback on visualization approach
2. **Prototype Development**: Build interactive prototype of Quadrant Matrix
3. **User Testing**: Test with Brand Managers and Content Managers
4. **Iteration**: Refine based on feedback
5. **Full Implementation**: Build all Phase 1 features
6. **Documentation**: Create user guide and training materials

---

## References & Best Practices

- **Multi-dimensional Data Visualization**: Use of bubble charts for 3+ dimensions
- **Strategic Positioning**: Quadrant analysis for business decision-making
- **Correlation Analysis**: Heatmaps for identifying metric relationships
- **Radar Charts**: Effective for comparing multiple sources across dimensions
- **Value Scoring**: Composite metrics for prioritization

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: AI Assistant  
**Status**: Proposal - Awaiting Approval

