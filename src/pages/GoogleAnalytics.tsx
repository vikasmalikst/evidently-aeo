import { Layout } from '../components/Layout/Layout';
import { IconBrandGoogleAnalytics, IconExternalLink, IconInfoCircle } from '@tabler/icons-react';

export const GoogleAnalytics = () => {
  return (
    <Layout>
      <div className="p-6" style={{ backgroundColor: '#f9f9fb', minHeight: '100vh' }}>
        <div className="mb-6">
          <h1 className="text-[32px] font-bold text-[#1a1d29] mb-2 flex items-center gap-3">
            <IconBrandGoogleAnalytics size={36} className="text-[#4285f4]" />
            Google Analytics
          </h1>
          <p className="text-[14px] text-[#64748b]">
            View your website traffic and AI-driven conversion insights directly from Google Analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Main Dashboard Card */}
          <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#e8e9ed] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconBrandGoogleAnalytics size={20} className="text-[#4285f4]" />
                <span className="font-semibold text-[#1a1d29]">Web Property Overview</span>
              </div>
              <a 
                href="https://analytics.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[12px] text-[#00bcdc] hover:underline flex items-center gap-1"
              >
                Open in Google Analytics
                <IconExternalLink size={14} />
              </a>
            </div>
            
            <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="w-16 h-16 bg-[#f1f5f9] rounded-full flex items-center justify-center mb-4">
                <IconBrandGoogleAnalytics size={32} className="text-[#64748b]" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#1a1d29] mb-2">Google Analytics Integration</h3>
              <p className="text-[14px] text-[#64748b] max-w-md mb-6">
                Connect your Google Analytics 4 property to see how AI-generated answers are driving traffic to your website.
              </p>
              <button className="px-6 py-2.5 bg-[#4285f4] text-white rounded-lg font-medium hover:bg-[#3367d6] transition-colors flex items-center gap-2">
                Connect GA4 Property
              </button>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 border border-[#e8e9ed] rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <IconInfoCircle size={18} className="text-[#00bcdc]" />
                <h4 className="font-semibold text-[#1a1d29]">Traffic Attribution</h4>
              </div>
              <p className="text-[13px] text-[#64748b]">
                Identify visitors coming from AI search engines like Perplexity, ChatGPT, and Gemini.
              </p>
            </div>
            
            <div className="bg-white p-6 border border-[#e8e9ed] rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <IconInfoCircle size={18} className="text-[#00bcdc]" />
                <h4 className="font-semibold text-[#1a1d29]">Conversion Impact</h4>
              </div>
              <p className="text-[13px] text-[#64748b]">
                Measure the quality of traffic driven by AI citations compared to traditional search.
              </p>
            </div>

            <div className="bg-white p-6 border border-[#e8e9ed] rounded-lg shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <IconInfoCircle size={18} className="text-[#00bcdc]" />
                <h4 className="font-semibold text-[#1a1d29]">AI Source Tracking</h4>
              </div>
              <p className="text-[13px] text-[#64748b]">
                Automatically tag and track UTM parameters from AI platform citations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
