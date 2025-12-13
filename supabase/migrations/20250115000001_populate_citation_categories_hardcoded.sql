/*
  # Populate Citation Categories with Hardcoded Domains
  
  This migration pre-populates the citation_categories table with all the
  hardcoded domain patterns from the citation categorization service.
  
  These domains will be available immediately without needing API calls,
  and will work for all customers/brands (customer_id and brand_id are NULL).
*/

-- Insert hardcoded domains (customer_id and brand_id are NULL for global use)

-- Social Platforms
INSERT INTO public.citation_categories (cited_url, domain, category, page_name, customer_id, brand_id)
VALUES
  ('https://reddit.com', 'reddit.com', 'Social', 'Reddit', NULL, NULL),
  ('https://twitter.com', 'twitter.com', 'Social', 'Twitter', NULL, NULL),
  ('https://facebook.com', 'facebook.com', 'Social', 'Facebook', NULL, NULL),
  ('https://linkedin.com', 'linkedin.com', 'Social', 'LinkedIn', NULL, NULL),
  ('https://instagram.com', 'instagram.com', 'Social', 'Instagram', NULL, NULL),
  ('https://tiktok.com', 'tiktok.com', 'Social', 'TikTok', NULL, NULL),
  ('https://youtube.com', 'youtube.com', 'Social', 'YouTube', NULL, NULL),
  ('https://pinterest.com', 'pinterest.com', 'Social', 'Pinterest', NULL, NULL)
ON CONFLICT (domain) DO NOTHING;

-- Editorial/News
INSERT INTO public.citation_categories (cited_url, domain, category, page_name, customer_id, brand_id)
VALUES
  ('https://techcrunch.com', 'techcrunch.com', 'Editorial', 'TechCrunch', NULL, NULL),
  ('https://forbes.com', 'forbes.com', 'Editorial', 'Forbes', NULL, NULL),
  ('https://medium.com', 'medium.com', 'Editorial', 'Medium', NULL, NULL),
  ('https://wired.com', 'wired.com', 'Editorial', 'Wired', NULL, NULL),
  ('https://theverge.com', 'theverge.com', 'Editorial', 'The Verge', NULL, NULL),
  ('https://bbc.com', 'bbc.com', 'Editorial', 'BBC', NULL, NULL),
  ('https://cnn.com', 'cnn.com', 'Editorial', 'CNN', NULL, NULL),
  ('https://nytimes.com', 'nytimes.com', 'Editorial', 'New York Times', NULL, NULL),
  ('https://wsj.com', 'wsj.com', 'Editorial', 'Wall Street Journal', NULL, NULL),
  ('https://reuters.com', 'reuters.com', 'Editorial', 'Reuters', NULL, NULL),
  ('https://bloomberg.com', 'bloomberg.com', 'Editorial', 'Bloomberg', NULL, NULL),
  ('https://guardian.com', 'guardian.com', 'Editorial', 'The Guardian', NULL, NULL),
  ('https://vogue.co.uk', 'vogue.co.uk', 'Editorial', 'Vogue', NULL, NULL),
  ('https://teenvogue.com', 'teenvogue.com', 'Editorial', 'Teen Vogue', NULL, NULL)
ON CONFLICT (domain) DO NOTHING;

-- Reference/Knowledge
INSERT INTO public.citation_categories (cited_url, domain, category, page_name, customer_id, brand_id)
VALUES
  ('https://wikipedia.org', 'wikipedia.org', 'Reference', 'Wikipedia', NULL, NULL),
  ('https://wikidata.org', 'wikidata.org', 'Reference', 'Wikidata', NULL, NULL),
  ('https://stackoverflow.com', 'stackoverflow.com', 'Reference', 'Stack Overflow', NULL, NULL),
  ('https://github.com', 'github.com', 'Reference', 'GitHub', NULL, NULL),
  ('https://quora.com', 'quora.com', 'Reference', 'Quora', NULL, NULL)
ON CONFLICT (domain) DO NOTHING;

-- Corporate/Business
INSERT INTO public.citation_categories (cited_url, domain, category, page_name, customer_id, brand_id)
VALUES
  ('https://g2.com', 'g2.com', 'Corporate', 'G2', NULL, NULL),
  ('https://capterra.com', 'capterra.com', 'Corporate', 'Capterra', NULL, NULL),
  ('https://trustpilot.com', 'trustpilot.com', 'Corporate', 'Trustpilot', NULL, NULL)
ON CONFLICT (domain) DO NOTHING;

-- Institutional/Educational (specific domains)
INSERT INTO public.citation_categories (cited_url, domain, category, page_name, customer_id, brand_id)
VALUES
  ('https://archive.org', 'archive.org', 'Institutional', 'Archive', NULL, NULL),
  ('https://scholar.google.com', 'scholar.google.com', 'Institutional', 'Google Scholar', NULL, NULL),
  ('https://pubmed.ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'Institutional', 'PubMed', NULL, NULL)
ON CONFLICT (domain) DO NOTHING;

-- UGC/Review Sites
INSERT INTO public.citation_categories (cited_url, domain, category, page_name, customer_id, brand_id)
VALUES
  ('https://amazon.com', 'amazon.com', 'UGC', 'Amazon', NULL, NULL),
  ('https://yelp.com', 'yelp.com', 'UGC', 'Yelp', NULL, NULL),
  ('https://tripadvisor.com', 'tripadvisor.com', 'UGC', 'TripAdvisor', NULL, NULL)
ON CONFLICT (domain) DO NOTHING;

-- Note: Regex patterns like /\.edu/i and /\.gov/i are handled in code logic
-- and will be categorized on-the-fly when encountered, then cached in the database
