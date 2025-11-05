import { useState, useMemo } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Search } from 'lucide-react';
import { TopicPerformanceBubbleChart } from '../components/Topics/TopicPerformanceBubbleChart';

interface TopicData {
  id: string;
  name: string;
  category: string;
  citationCount: number;
  shareOfAnswer: number;
  searchVolume: number;
  avgSentiment: number;
}

const mockTopics: TopicData[] = [
  {
    id: '1',
    name: 'AI Assistants',
    category: 'Technology',
    citationCount: 145,
    shareOfAnswer: 2.8,
    searchVolume: 15420,
    avgSentiment: 0.72
  },
  {
    id: '2',
    name: 'Large Language Models',
    category: 'Technology',
    citationCount: 132,
    shareOfAnswer: 2.4,
    searchVolume: 12350,
    avgSentiment: 0.65
  },
  {
    id: '3',
    name: 'AI Search',
    category: 'Search',
    citationCount: 98,
    shareOfAnswer: 1.8,
    searchVolume: 10890,
    avgSentiment: 0.48
  },
  {
    id: '4',
    name: 'Search Results',
    category: 'Search',
    citationCount: 87,
    shareOfAnswer: 1.5,
    searchVolume: 9870,
    avgSentiment: 0.55
  },
  {
    id: '5',
    name: 'Research Tools',
    category: 'Productivity',
    citationCount: 156,
    shareOfAnswer: 3.2,
    searchVolume: 8560,
    avgSentiment: 0.78
  },
  {
    id: '6',
    name: 'Real-time Info',
    category: 'Search',
    citationCount: 76,
    shareOfAnswer: 1.2,
    searchVolume: 7230,
    avgSentiment: 0.42
  },
  {
    id: '7',
    name: 'Code Generation',
    category: 'Development',
    citationCount: 168,
    shareOfAnswer: 3.5,
    searchVolume: 11240,
    avgSentiment: 0.82
  },
  {
    id: '8',
    name: 'Content Creation',
    category: 'Creative',
    citationCount: 124,
    shareOfAnswer: 2.6,
    searchVolume: 9450,
    avgSentiment: 0.68
  },
  {
    id: '9',
    name: 'Data Analysis',
    category: 'Analytics',
    citationCount: 92,
    shareOfAnswer: 2.1,
    searchVolume: 6800,
    avgSentiment: 0.58
  },
  {
    id: '10',
    name: 'Machine Learning',
    category: 'Technology',
    citationCount: 110,
    shareOfAnswer: 2.3,
    searchVolume: 13200,
    avgSentiment: 0.71
  },
  {
    id: '11',
    name: 'Automation',
    category: 'Productivity',
    citationCount: 78,
    shareOfAnswer: 1.6,
    searchVolume: 5400,
    avgSentiment: 0.52
  },
  {
    id: '12',
    name: 'Chatbots',
    category: 'Technology',
    citationCount: 65,
    shareOfAnswer: 1.1,
    searchVolume: 4200,
    avgSentiment: 0.38
  },
  {
    id: '13',
    name: 'Voice Assistants',
    category: 'Technology',
    citationCount: 54,
    shareOfAnswer: 0.9,
    searchVolume: 3800,
    avgSentiment: 0.28
  },
  {
    id: '14',
    name: 'Image Generation',
    category: 'Creative',
    citationCount: 143,
    shareOfAnswer: 2.9,
    searchVolume: 10300,
    avgSentiment: 0.75
  },
  {
    id: '15',
    name: 'Natural Language',
    category: 'Technology',
    citationCount: 118,
    shareOfAnswer: 2.5,
    searchVolume: 8900,
    avgSentiment: 0.66
  }
];

export const Topics = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(mockTopics.map(t => t.category)))];

  const filteredTopics = useMemo(() => {
    return mockTopics.filter(topic => {
      const matchesSearch = topic.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || topic.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">Topics</h1>
          <p className="text-[var(--text-caption)]">
            Analyze topic performance across citation count, share of answer, search volume, and sentiment
          </p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-caption)]" size={20} />
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-white border border-[var(--border-default)] text-[var(--text-body)] hover:border-[var(--accent-primary)]'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredTopics.length === 0 ? (
          <div className="text-center py-12 bg-white border border-[var(--border-default)] rounded-lg">
            <p className="text-[var(--text-caption)]">No topics found matching your search.</p>
          </div>
        ) : (
          <TopicPerformanceBubbleChart topics={filteredTopics} />
        )}
      </div>
    </Layout>
  );
};
