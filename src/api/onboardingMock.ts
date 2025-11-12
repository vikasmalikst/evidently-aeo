export interface Brand {
  verified: boolean;
  companyName: string;
  website: string;
  logo: string;
  industry: string;
  headquarters: string;
  founded: number;
  description: string;
}

export interface Competitor {
  name: string;
  logo: string;
  industry: string;
  relevance: string;
  domain: string;
}

const brandDatabase: Record<string, Brand> = {
  'nike': {
    verified: true,
    companyName: 'Nike',
    website: 'https://nike.com',
    logo: 'https://logo.clearbit.com/nike.com',
    industry: 'Athletic Apparel',
    headquarters: 'Beaverton, OR',
    founded: 1964,
    description: 'Global leader in athletic footwear and apparel'
  },
  'apple': {
    verified: true,
    companyName: 'Apple',
    website: 'https://apple.com',
    logo: 'https://logo.clearbit.com/apple.com',
    industry: 'Technology',
    headquarters: 'Cupertino, CA',
    founded: 1976,
    description: 'Consumer electronics and software company'
  },
  'tesla': {
    verified: true,
    companyName: 'Tesla',
    website: 'https://tesla.com',
    logo: 'https://logo.clearbit.com/tesla.com',
    industry: 'Automotive',
    headquarters: 'Austin, TX',
    founded: 2003,
    description: 'Electric vehicle and clean energy company'
  },
  'spotify': {
    verified: true,
    companyName: 'Spotify',
    website: 'https://spotify.com',
    logo: 'https://logo.clearbit.com/spotify.com',
    industry: 'Music Streaming',
    headquarters: 'Stockholm, Sweden',
    founded: 2006,
    description: 'Digital music streaming service'
  },
  'airbnb': {
    verified: true,
    companyName: 'Airbnb',
    website: 'https://airbnb.com',
    logo: 'https://logo.clearbit.com/airbnb.com',
    industry: 'Travel & Hospitality',
    headquarters: 'San Francisco, CA',
    founded: 2008,
    description: 'Online marketplace for vacation rentals'
  }
};

const competitorsByIndustry: Record<string, Competitor[]> = {
  'Athletic Apparel': [
    { name: 'Adidas', logo: 'https://logo.clearbit.com/adidas.com', industry: 'Athletic Apparel', relevance: 'Direct Competitor', domain: 'adidas.com' },
    { name: 'Puma', logo: 'https://logo.clearbit.com/puma.com', industry: 'Athletic Apparel', relevance: 'Direct Competitor', domain: 'puma.com' },
    { name: 'Under Armour', logo: 'https://logo.clearbit.com/underarmour.com', industry: 'Athletic Apparel', relevance: 'Direct Competitor', domain: 'underarmour.com' },
    { name: 'New Balance', logo: 'https://logo.clearbit.com/newbalance.com', industry: 'Athletic Apparel', relevance: 'Direct Competitor', domain: 'newbalance.com' },
    { name: 'Reebok', logo: 'https://logo.clearbit.com/reebok.com', industry: 'Athletic Apparel', relevance: 'Direct Competitor', domain: 'reebok.com' },
    { name: 'ASICS', logo: 'https://logo.clearbit.com/asics.com', industry: 'Athletic Apparel', relevance: 'Direct Competitor', domain: 'asics.com' },
    { name: 'Lululemon', logo: 'https://logo.clearbit.com/lululemon.com', industry: 'Athletic Apparel', relevance: 'Indirect Competitor', domain: 'lululemon.com' },
    { name: 'Columbia', logo: 'https://logo.clearbit.com/columbia.com', industry: 'Athletic Apparel', relevance: 'Indirect Competitor', domain: 'columbia.com' },
    { name: 'The North Face', logo: 'https://logo.clearbit.com/thenorthface.com', industry: 'Athletic Apparel', relevance: 'Indirect Competitor', domain: 'thenorthface.com' },
    { name: 'Patagonia', logo: 'https://logo.clearbit.com/patagonia.com', industry: 'Athletic Apparel', relevance: 'Indirect Competitor', domain: 'patagonia.com' }
  ],
  'Technology': [
    { name: 'Microsoft', logo: 'https://logo.clearbit.com/microsoft.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'microsoft.com' },
    { name: 'Google', logo: 'https://logo.clearbit.com/google.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'google.com' },
    { name: 'Samsung', logo: 'https://logo.clearbit.com/samsung.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'samsung.com' },
    { name: 'Amazon', logo: 'https://logo.clearbit.com/amazon.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'amazon.com' },
    { name: 'Meta', logo: 'https://logo.clearbit.com/meta.com', industry: 'Technology', relevance: 'Indirect Competitor', domain: 'meta.com' },
    { name: 'Dell', logo: 'https://logo.clearbit.com/dell.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'dell.com' },
    { name: 'HP', logo: 'https://logo.clearbit.com/hp.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'hp.com' },
    { name: 'Sony', logo: 'https://logo.clearbit.com/sony.com', industry: 'Technology', relevance: 'Indirect Competitor', domain: 'sony.com' },
    { name: 'Lenovo', logo: 'https://logo.clearbit.com/lenovo.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'lenovo.com' },
    { name: 'Huawei', logo: 'https://logo.clearbit.com/huawei.com', industry: 'Technology', relevance: 'Direct Competitor', domain: 'huawei.com' }
  ],
  'Automotive': [
    { name: 'Ford', logo: 'https://logo.clearbit.com/ford.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'ford.com' },
    { name: 'GM', logo: 'https://logo.clearbit.com/gm.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'gm.com' },
    { name: 'Rivian', logo: 'https://logo.clearbit.com/rivian.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'rivian.com' },
    { name: 'Lucid Motors', logo: 'https://logo.clearbit.com/lucidmotors.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'lucidmotors.com' },
    { name: 'Volkswagen', logo: 'https://logo.clearbit.com/volkswagen.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'volkswagen.com' },
    { name: 'BMW', logo: 'https://logo.clearbit.com/bmw.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'bmw.com' },
    { name: 'Mercedes-Benz', logo: 'https://logo.clearbit.com/mercedes-benz.com', industry: 'Automotive', relevance: 'Direct Competitor', domain: 'mercedes-benz.com' },
    { name: 'Toyota', logo: 'https://logo.clearbit.com/toyota.com', industry: 'Automotive', relevance: 'Indirect Competitor', domain: 'toyota.com' },
    { name: 'Honda', logo: 'https://logo.clearbit.com/honda.com', industry: 'Automotive', relevance: 'Indirect Competitor', domain: 'honda.com' },
    { name: 'Nissan', logo: 'https://logo.clearbit.com/nissan.com', industry: 'Automotive', relevance: 'Indirect Competitor', domain: 'nissan.com' }
  ],
  'Music Streaming': [
    { name: 'Apple Music', logo: 'https://logo.clearbit.com/apple.com', industry: 'Music Streaming', relevance: 'Direct Competitor', domain: 'apple.com' },
    { name: 'YouTube Music', logo: 'https://logo.clearbit.com/youtube.com', industry: 'Music Streaming', relevance: 'Direct Competitor', domain: 'youtube.com' },
    { name: 'Amazon Music', logo: 'https://logo.clearbit.com/amazon.com', industry: 'Music Streaming', relevance: 'Direct Competitor', domain: 'amazon.com' },
    { name: 'Tidal', logo: 'https://logo.clearbit.com/tidal.com', industry: 'Music Streaming', relevance: 'Direct Competitor', domain: 'tidal.com' },
    { name: 'Pandora', logo: 'https://logo.clearbit.com/pandora.com', industry: 'Music Streaming', relevance: 'Direct Competitor', domain: 'pandora.com' },
    { name: 'SoundCloud', logo: 'https://logo.clearbit.com/soundcloud.com', industry: 'Music Streaming', relevance: 'Indirect Competitor', domain: 'soundcloud.com' },
    { name: 'Deezer', logo: 'https://logo.clearbit.com/deezer.com', industry: 'Music Streaming', relevance: 'Direct Competitor', domain: 'deezer.com' },
    { name: 'iHeartRadio', logo: 'https://logo.clearbit.com/iheart.com', industry: 'Music Streaming', relevance: 'Indirect Competitor', domain: 'iheart.com' }
  ],
  'Travel & Hospitality': [
    { name: 'Booking.com', logo: 'https://logo.clearbit.com/booking.com', industry: 'Travel & Hospitality', relevance: 'Direct Competitor', domain: 'booking.com' },
    { name: 'Expedia', logo: 'https://logo.clearbit.com/expedia.com', industry: 'Travel & Hospitality', relevance: 'Direct Competitor', domain: 'expedia.com' },
    { name: 'VRBO', logo: 'https://logo.clearbit.com/vrbo.com', industry: 'Travel & Hospitality', relevance: 'Direct Competitor', domain: 'vrbo.com' },
    { name: 'Hotels.com', logo: 'https://logo.clearbit.com/hotels.com', industry: 'Travel & Hospitality', relevance: 'Direct Competitor', domain: 'hotels.com' },
    { name: 'Marriott', logo: 'https://logo.clearbit.com/marriott.com', industry: 'Travel & Hospitality', relevance: 'Indirect Competitor', domain: 'marriott.com' },
    { name: 'Hilton', logo: 'https://logo.clearbit.com/hilton.com', industry: 'Travel & Hospitality', relevance: 'Indirect Competitor', domain: 'hilton.com' },
    { name: 'TripAdvisor', logo: 'https://logo.clearbit.com/tripadvisor.com', industry: 'Travel & Hospitality', relevance: 'Indirect Competitor', domain: 'tripadvisor.com' },
    { name: 'Priceline', logo: 'https://logo.clearbit.com/priceline.com', industry: 'Travel & Hospitality', relevance: 'Direct Competitor', domain: 'priceline.com' }
  ]
};

export const verifyBrand = async (input: string): Promise<Brand> => {
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

  const normalizedInput = input.toLowerCase().trim();
  const searchKey = normalizedInput.replace(/\.(com|io|net|org).*$/, '');

  for (const [key, brand] of Object.entries(brandDatabase)) {
    if (key === searchKey || brand.companyName.toLowerCase() === searchKey) {
      return brand;
    }
  }

  throw new Error('Brand not found in our database. Please try a different name or contact support.');
};

export const getCompetitors = async (brand: Brand): Promise<Competitor[]> => {
  await new Promise(resolve => setTimeout(resolve, 1000));

  return competitorsByIndustry[brand.industry] || [];
};

export const submitOnboarding = async (brand: Brand, competitors: Competitor[]): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, 1500));

  return { success: true };
};
