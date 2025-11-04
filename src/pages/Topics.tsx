import { useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';

interface Topic {
  id: string;
  name: string;
  category: string;
  volume: number;
  trend: number;
  topModels: string[];
}

const mockTopics: Topic[] = [
  {
    id: '1',
    name: 'AI Assistants',
    category: 'Technology',
    volume: 15420,
    trend: 12,
    topModels: ['ChatGPT', 'Claude', 'Gemini']
  },
  {
    id: '2',
    name: 'Large Language Models',
    category: 'Technology',
    volume: 12350,
    trend: 8,
    topModels: ['Claude', 'GPT-4', 'Gemini']
  },
  {
    id: '3',
    name: 'AI Search',
    category: 'Search',
    volume: 10890,
    trend: -3,
    topModels: ['Perplexity', 'Google AI', 'Bing AI']
  },
  {
    id: '4',
    name: 'Search Results',
    category: 'Search',
    volume: 9870,
    trend: 5,
    topModels: ['Google AI Search', 'Bing', 'Perplexity']
  },
  {
    id: '5',
    name: 'Research Tools',
    category: 'Productivity',
    volume: 8560,
    trend: 15,
    topModels: ['Perplexity', 'Claude', 'ChatGPT']
  },
  {
    id: '6',
    name: 'Real-time Info',
    category: 'Search',
    volume: 7230,
    trend: 2,
    topModels: ['Grok', 'Perplexity', 'Gemini']
  },
  {
    id: '7',
    name: 'Code Generation',
    category: 'Development',
    volume: 11240,
    trend: 18,
    topModels: ['GitHub Copilot', 'Claude', 'ChatGPT']
  },
  {
    id: '8',
    name: 'Content Creation',
    category: 'Creative',
    volume: 9450,
    trend: 6,
    topModels: ['ChatGPT', 'Claude', 'Gemini']
  }
];

export const Topics = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(mockTopics.map(t => t.category)))];

  const filteredTopics = mockTopics.filter(topic => {
    const matchesSearch = topic.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || topic.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">Topics</h1>
          <p className="text-[var(--text-caption)]">
            Explore trending topics and their performance across different AI models
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

          <div className="flex gap-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTopics.map(topic => {
            const isPositive = topic.trend > 0;
            return (
              <div
                key={topic.id}
                className="bg-white border border-[var(--border-default)] rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-body)] mb-1">
                      {topic.name}
                    </h3>
                    <span className="inline-block px-2 py-1 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-caption)] font-medium">
                      {topic.category}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 ${isPositive ? 'text-[var(--text-success)]' : 'text-[var(--text-error)]'}`}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span className="text-sm font-semibold">{Math.abs(topic.trend)}%</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-[var(--text-caption)] mb-1">Search Volume</div>
                  <div className="text-2xl font-bold text-[var(--text-body)]">
                    {topic.volume.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-[var(--text-caption)] mb-2">Top Models</div>
                  <div className="flex flex-wrap gap-2">
                    {topic.topModels.map((model, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-[var(--accent-light)] text-[var(--accent-primary)] rounded text-xs font-medium"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredTopics.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-caption)]">No topics found matching your search.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};
