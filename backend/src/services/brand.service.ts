import { supabaseAdmin } from '../config/database';
import { 
  Brand, 
  BrandOnboardingRequest, 
  BrandOnboardingResponse, 
  DatabaseError,
  ValidationError 
} from '../types/auth';
import { v4 as uuidv4 } from 'uuid';

export class BrandService {
  /**
   * Create a new brand for a customer
   */
  async createBrand(
    customerId: string, 
    brandData: BrandOnboardingRequest
  ): Promise<BrandOnboardingResponse> {
    try {
      // Validate input
      this.validateBrandData(brandData);

      // Check if customer exists
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        throw new ValidationError('Customer not found');
      }

      // Check if brand already exists for this customer
      const { data: existingBrand, error: existingError } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('customer_id', customerId)
        .eq('name', brandData.brand_name)
        .single();

      if (existingBrand && !existingError) {
        throw new ValidationError('Brand with this name already exists for this customer');
      }

      // Create brand
      const brandId = uuidv4();
      const brandSlug = brandData.brand_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      const { data: newBrand, error: brandError } = await supabaseAdmin
        .from('brands')
        .insert({
          id: brandId,
          customer_id: customerId,
          name: brandData.brand_name,
          slug: brandSlug,
          homepage_url: brandData.website_url,
          industry: brandData.industry,
          summary: brandData.description,
          ceo: (brandData as any).metadata?.ceo,
          headquarters: (brandData as any).metadata?.headquarters,
          founded_year: (brandData as any).metadata?.founded_year,
          metadata: (brandData as any).metadata
        })
        .select()
        .single();

      if (brandError || !newBrand) {
        console.error('❌ Brand creation failed:', {
          brandError,
          newBrand,
          brandData: {
            name: brandData.brand_name,
            website_url: brandData.website_url,
            industry: brandData.industry,
            description: brandData.description
          }
        });
        throw new DatabaseError(`Failed to create brand: ${brandError?.message || 'Unknown error'}`);
      }

      // Create onboarding artifact with full BrandIntel structure
      const artifactId = uuidv4();
      const artifactData = {
        input: { raw: brandData.website_url || brandData.brand_name },
        brandName: brandData.brand_name,
        homepageUrl: brandData.website_url,
        summary: brandData.description,
        ceo: (brandData as any).metadata?.ceo,
        headquarters: (brandData as any).metadata?.headquarters,
        foundedYear: (brandData as any).metadata?.founded_year,
        industry: brandData.industry,
        competitors: brandData.competitors || [],
        topics: (brandData as any).metadata?.topics || brandData.aeo_topics || [],
        sources: (brandData as any).sources || [],
        generatedAtIso: (brandData as any).metadata?.generated_at || new Date().toISOString()
      };

      // Insert competitors into brand_competitors table
      if (brandData.competitors && brandData.competitors.length > 0) {
        const competitorInserts = brandData.competitors.map((competitor: string, index: number) => ({
          brand_id: brandId,
          competitor_name: competitor.trim(),
          competitor_url: `https://www.${competitor.toLowerCase().replace(/\s+/g, '')}.com`,
          priority: index + 1
        }));

        const { error: competitorError } = await supabaseAdmin
          .from('brand_competitors')
          .insert(competitorInserts);

        if (competitorError) {
          console.error('❌ Failed to insert competitors:', competitorError);
          // Don't throw error, just log it - competitors are not critical for brand creation
        } else {
          console.log(`✅ Inserted ${competitorInserts.length} competitors for brand ${brandId}`);
        }
      }

      const { error: artifactError } = await supabaseAdmin
        .from('onboarding_artifacts')
        .insert({
          id: artifactId,
          customer_id: customerId,
          brand_id: newBrand.id,
          brand_intel: artifactData,
          selected_topics: brandData.aeo_topics || [],
          completed_at_iso: new Date().toISOString()
        });

      if (artifactError) {
        console.error('Failed to create onboarding artifact:', artifactError);
        // Don't throw error here as brand was created successfully
      }

      // Insert competitors into brand_competitors table
      if (brandData.competitors && Array.isArray(brandData.competitors) && brandData.competitors.length > 0) {
        const competitorRecords = brandData.competitors.map((competitor: any, index: number) => {
          // Handle both string and object competitors
          const competitorName = typeof competitor === 'string' ? competitor : (competitor.name || competitor);
          const competitorUrl = typeof competitor === 'string' ? '' : (competitor.url || '');
          
          return {
            brand_id: newBrand.id,
            competitor_name: competitorName,
            competitor_url: competitorUrl,
            priority: index + 1
          };
        });

        const { error: competitorError } = await supabaseAdmin
          .from('brand_competitors')
          .insert(competitorRecords);

        if (competitorError) {
          console.error('⚠️ Failed to insert competitors:', competitorError);
          // Don't throw - brand was created successfully
        } else {
          console.log(`✅ Inserted ${competitorRecords.length} competitors for brand ${newBrand.name}`);
        }
      }

      // Insert AEO topics into brand_topics table
      // Check both aeo_topics and metadata.topics fields
      const topics = brandData.aeo_topics || (brandData as any).metadata?.topics || [];
      console.log('🔍 DEBUG: Topics extraction:', {
        aeo_topics: brandData.aeo_topics,
        metadata_topics: (brandData as any).metadata?.topics,
        extracted_topics: topics,
        topics_length: topics.length,
        is_array: Array.isArray(topics)
      });
      
      if (topics && Array.isArray(topics) && topics.length > 0) {
        const topicRecords = topics.map((topic) => ({
          brand_id: newBrand.id,
          topic_name: topic, // Fixed: use topic_name instead of topic
          description: '' // We don't have descriptions from onboarding
        }));

        console.log('🔍 DEBUG: Inserting topics into brand_topics table:', topicRecords);
        
        const { error: topicError } = await supabaseAdmin
          .from('brand_topics')
          .insert(topicRecords);

        if (topicError) {
          console.error('⚠️ Failed to insert topics:', topicError);
          console.error('🔍 DEBUG: Topic records that failed:', topicRecords);
          // Don't throw - brand was created successfully
        } else {
          console.log(`✅ Inserted ${topicRecords.length} topics for brand ${newBrand.name}`);
          
          // 🎯 NEW: Categorize topics using AI with guaranteed fallback
          try {
            // Handle both string and object topic formats
            const topicLabels = topics.map(topic => 
              typeof topic === 'string' ? topic : (topic.label || String(topic))
            );
            console.log(`🤖 Starting AI categorization for ${topicLabels.length} topics during brand creation`);
            console.log(`📋 Topics to categorize:`, topicLabels);
            await this.categorizeTopicsWithAI(newBrand.id, topicLabels);
            console.log(`✅ AI categorization completed for brand ${newBrand.id}`);
          } catch (error) {
            console.error('⚠️ Failed to categorize topics with AI:', error);
            console.log('🔄 AI categorization failed, using rule-based fallback');
            
            // GUARANTEED FALLBACK: Always categorize topics using rules
            try {
              const topicLabels = topics.map(topic => 
                typeof topic === 'string' ? topic : (topic.label || String(topic))
              );
              await this.categorizeTopicsWithRules(newBrand.id, topicLabels);
              console.log(`✅ Rule-based categorization completed for brand ${newBrand.id}`);
            } catch (ruleError) {
              console.error('❌ Even rule-based categorization failed:', ruleError);
            }
          }
        }
      } else {
        console.log('🔍 DEBUG: No topics found to insert:', {
          topics,
          topics_length: topics.length,
          is_array: Array.isArray(topics),
          brandData_keys: Object.keys(brandData),
          metadata_keys: (brandData as any).metadata ? Object.keys((brandData as any).metadata) : 'no metadata'
        });
      }

      return {
        brand: newBrand,
        artifact_id: artifactId,
        message: 'Brand created successfully'
      };
    } catch (error) {
      console.error('Error creating brand:', error);
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to create brand');
    }
  }

  /**
   * Get brands for a customer
   */
  async getBrandsByCustomer(customerId: string): Promise<Brand[]> {
    try {
      const { data: brands, error } = await supabaseAdmin
        .from('brands')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError('Failed to fetch brands');
      }

      return brands || [];
    } catch (error) {
      console.error('Error fetching brands:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch brands');
    }
  }

  /**
   * Get brand by ID
   */
  async getBrandById(brandId: string, customerId: string): Promise<Brand | null> {
    try {
      const { data: brand, error } = await supabaseAdmin
        .from('brands')
        .select(`
          *,
          brand_competitors!left (competitor_name, competitor_url, priority)
        `)
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .single();

      if (error || !brand) {
        return null;
      }

      // Transform brand_competitors array to simple competitor names
      if (brand.brand_competitors && Array.isArray(brand.brand_competitors)) {
        brand.competitors = brand.brand_competitors
          .sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999))
          .map((c: any) => c.competitor_name);
      }

      return brand;
    } catch (error) {
      console.error('Error fetching brand:', error);
      return null;
    }
  }

  /**
   * Find brand by homepage URL or name (within customer's brands)
   */
  async findBrandByUrlOrName(homepage_url?: string, name?: string, customerId?: string): Promise<Brand | null> {
    try {
      let brand: any = null;

      // Try to find by homepage URL first (if provided)
      if (homepage_url) {
        let query = supabaseAdmin
          .from('brands')
          .select(`
            *,
            brand_competitors!left (competitor_name, competitor_url, priority),
            brand_topics!left (*)
          `)
          .eq('homepage_url', homepage_url);
        
        // Filter by customer if provided
        if (customerId) {
          query = query.eq('customer_id', customerId);
        }

        const { data: brandByUrl, error: urlError } = await query.maybeSingle();

        if (!urlError && brandByUrl) {
          console.log('✅ Found existing brand by URL:', brandByUrl.name);
          brand = brandByUrl;
        }
      }

      // If name is provided and no brand found yet, try to find by name
      if (!brand && name) {
        // Try exact match first
        let exactQuery = supabaseAdmin
          .from('brands')
          .select(`
            *,
            brand_competitors!left (competitor_name, competitor_url, priority),
            brand_topics!left (*)
          `)
          .ilike('name', name);
        
        // Filter by customer if provided
        if (customerId) {
          exactQuery = exactQuery.eq('customer_id', customerId);
        }

        console.log('🔍 Executing exact name query for:', name, 'customerId:', customerId);
        const { data: exactMatches, error: exactError } = await exactQuery;

        console.log('🔍 Exact match result:', { count: exactMatches?.length, exactError });
        
        const exactMatch = exactMatches && exactMatches.length > 0 ? exactMatches[0] : null;

        if (!exactError && exactMatch) {
          console.log('✅ Found existing brand by exact name:', exactMatch.name);
          brand = exactMatch;
        }

        // Try partial match if still not found
        if (!brand) {
          let partialQuery = supabaseAdmin
            .from('brands')
            .select(`
              *,
              brand_competitors!left (competitor_name, competitor_url, priority),
              brand_topics!left (*)
            `)
            .ilike('name', `%${name}%`)
            .limit(1);
          
          // Filter by customer if provided
          if (customerId) {
            partialQuery = partialQuery.eq('customer_id', customerId);
          }

          const { data: partialMatches, error: partialError } = await partialQuery;

          if (!partialError && partialMatches && partialMatches.length > 0) {
            console.log('✅ Found existing brand by partial name match:', partialMatches[0].name);
            brand = partialMatches[0];
          }
        }
      }

      if (!brand) {
        console.log('ℹ️ No existing brand found for:', { homepage_url, name, customerId });
        return null;
      }

      // Transform brand_competitors array to simple competitor names
      if (brand.brand_competitors && Array.isArray(brand.brand_competitors)) {
        brand.competitors = brand.brand_competitors
          .sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999))
          .map((c: any) => c.competitor_name);
      }

      // Transform brand_topics array to simple topic names
      if (brand.brand_topics && Array.isArray(brand.brand_topics)) {
        // Handle both 'topic' and 'name' fields (depending on table structure)
        brand.aeo_topics = brand.brand_topics.map((t: any) => t.topic || t.name || t);
      }

      // Fetch onboarding artifact for complete data (topic mappings, sources, etc.)
      try {
        const { data: artifact, error: artifactError } = await supabaseAdmin
          .from('onboarding_artifacts')
          .select('*')
          .eq('brand_id', brand.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!artifactError && artifact && artifact.brand_intel) {
          console.log('✅ Found onboarding artifact for brand');
          // Merge artifact data with brand data
          brand.onboarding_artifact = artifact.brand_intel;
          
          // If topics from artifact are more complete, use those
          if (artifact.brand_intel.topics && artifact.brand_intel.topics.length > 0) {
            brand.topics = artifact.brand_intel.topics;
          }
          
          // Add sources if available
          if (artifact.brand_intel.sources) {
            brand.sources = artifact.brand_intel.sources;
          }
        }
      } catch (artifactError) {
        console.log('⚠️ Could not fetch onboarding artifact:', artifactError);
        // Continue without artifact data
      }

      return brand;
    } catch (error) {
      console.error('Error finding brand:', error);
      return null;
    }
  }

  /**
   * Update brand
   */
  async updateBrand(
    brandId: string, 
    customerId: string, 
    updateData: Partial<BrandOnboardingRequest>
  ): Promise<Brand> {
    try {
      // Validate input
      if (updateData.brand_name) {
        this.validateBrandName(updateData.brand_name);
      }
      if (updateData.website_url) {
        this.validateWebsiteUrl(updateData.website_url);
      }

      const { data: updatedBrand, error } = await supabaseAdmin
        .from('brands')
        .update({
          name: updateData.brand_name,
          website_url: updateData.website_url,
          description: updateData.description,
          industry: updateData.industry,
          updated_at: new Date().toISOString()
        })
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error || !updatedBrand) {
        throw new DatabaseError('Failed to update brand');
      }

      return updatedBrand;
    } catch (error) {
      console.error('Error updating brand:', error);
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to update brand');
    }
  }

  /**
   * Delete brand
   */
  async deleteBrand(brandId: string, customerId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('brands')
        .delete()
        .eq('id', brandId)
        .eq('customer_id', customerId);

      if (error) {
        throw new DatabaseError('Failed to delete brand');
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete brand');
    }
  }

  /**
   * Get onboarding artifacts for a brand
   */
  async getOnboardingArtifacts(brandId: string, customerId: string): Promise<any[]> {
    try {
      const { data: artifacts, error } = await supabaseAdmin
        .from('onboarding_artifacts')
        .select('*')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError('Failed to fetch onboarding artifacts');
      }

      return artifacts || [];
    } catch (error) {
      console.error('Error fetching onboarding artifacts:', error);
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch onboarding artifacts');
    }
  }

  /**
   * Validate brand data
   */
  private validateBrandData(data: BrandOnboardingRequest): void {
    if (!data.brand_name || data.brand_name.trim().length === 0) {
      throw new ValidationError('Brand name is required', 'brand_name');
    }

    // Make website_url optional - provide fallback if not provided
    if (!data.website_url || data.website_url.trim().length === 0) {
      data.website_url = `https://www.${data.brand_name.toLowerCase().replace(/\s+/g, '')}.com`;
    }

    this.validateBrandName(data.brand_name);
    if (data.website_url) {
      this.validateWebsiteUrl(data.website_url);
    }
  }

  /**
   * Validate brand name
   */
  private validateBrandName(name: string): void {
    if (name.length < 2) {
      throw new ValidationError('Brand name must be at least 2 characters long', 'brand_name');
    }

    if (name.length > 100) {
      throw new ValidationError('Brand name must be less than 100 characters', 'brand_name');
    }
  }

  /**
   * Validate website URL
   */
  private validateWebsiteUrl(url: string): void {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new ValidationError('Website URL must use HTTP or HTTPS protocol', 'website_url');
      }
    } catch (error) {
      throw new ValidationError('Invalid website URL format', 'website_url');
    }
  }

  /**
   * Get AEO topics for a specific brand
   */
  async getBrandTopics(brandId: string, customerId: string): Promise<any[]> {
    try {
      console.log(`🎯 Fetching AEO topics for brand ${brandId}, customer ${customerId}`);
      
      // First try to get topics from brand_topics table (if they exist)
      const { data: dbTopics, error: dbError } = await supabaseAdmin
        .from('brand_topics')
        .select('*')
        .eq('brand_id', brandId)
        .order('priority', { ascending: true });

      if (!dbError && dbTopics && dbTopics.length > 0) {
        console.log(`✅ Found ${dbTopics.length} AEO topics in database for brand ${brandId}`);
        return dbTopics;
      }

      // Fallback: Get topics from brand metadata
      const { data: brand, error } = await supabaseAdmin
        .from('brands')
        .select('metadata, industry')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .single();

      if (error) {
        console.error('❌ Error fetching brand data:', error);
        throw new DatabaseError('Failed to fetch brand data');
      }

      // Extract topics from metadata
      const topics = brand?.metadata?.topics || [];
      
      if (topics.length === 0) {
        console.log(`⚠️ No topics found for brand ${brandId}`);
        return [];
      }

      // Convert topics array to the expected format with AI categorization
      const formattedTopics = topics.map((topic: string, index: number) => ({
        id: `topic-${index}`,
        topic_name: topic,
        topic: topic, // Add both topic_name and topic for compatibility
        category: this.categorizeTopicByRules(topic),
        description: `AI-generated topic: ${topic}`,
        is_active: true,
        priority: index + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      console.log(`✅ Found ${formattedTopics.length} AEO topics for brand ${brandId}`);
      return formattedTopics;
    } catch (error) {
      console.error('❌ Error in getBrandTopics:', error);
      throw error;
    }
  }

  /**
   * Get categories with their topics and queries
   */
  async getBrandCategoriesWithTopics(brandId: string, customerId: string): Promise<any[]> {
    try {
      console.log(`🎯 Fetching categories with topics for brand ${brandId}`);
      
      // Get all categories
      const { data: categories, error: categoriesError } = await supabaseAdmin
        .from('categories')
        .select('*')
        .order('id');

      if (categoriesError) {
        console.error('❌ Error fetching categories:', categoriesError);
        throw new DatabaseError('Failed to fetch categories');
      }

      // Get topics for this brand
      const topics = await this.getBrandTopics(brandId, customerId);
      console.log('🔍 DEBUG: Topics fetched for categories:', {
        topics_count: topics.length,
        topics: topics.map(t => ({ name: t.topic_name || t.topic || t, category: t.category }))
      });

      // Group topics by category
      const categoriesWithTopics = categories.map(category => {
        const categoryTopics = topics.filter(topic => topic.category === category.name);
        console.log(`🔍 DEBUG: Category "${category.name}" has ${categoryTopics.length} topics:`, 
          categoryTopics.map(t => t.topic_name || t.topic || t));
        return {
          ...category,
          topics: categoryTopics
        };
      });

      console.log(`✅ Found ${categoriesWithTopics.length} categories with topics`);
      return categoriesWithTopics;
    } catch (error) {
      console.error('❌ Error in getBrandCategoriesWithTopics:', error);
      throw error;
    }
  }

  /**
   * Categorize topic using simple rules
   */
  public categorizeTopicByRules(topic: string): string {
    const topicLower = topic.toLowerCase();
    
    // Awareness category
    if (topicLower.includes('brand') || topicLower.includes('trust') || topicLower.includes('identity') || 
        topicLower.includes('history') || topicLower.includes('reputation') || topicLower.includes('company')) {
      return 'awareness';
    }
    
    // Comparison category
    if (topicLower.includes('comparison') || topicLower.includes('competitor') || topicLower.includes('vs') || 
        topicLower.includes('better') || topicLower.includes('versus')) {
      return 'comparison';
    }
    
    // Purchase category
    if (topicLower.includes('pricing') || topicLower.includes('price') || topicLower.includes('cost') || 
        topicLower.includes('discount') || topicLower.includes('value') || topicLower.includes('buy') ||
        topicLower.includes('purchase') || topicLower.includes('afford')) {
      return 'purchase';
    }
    
    // Post-purchase support category
    if (topicLower.includes('complaint') || topicLower.includes('support') || topicLower.includes('service') || 
        topicLower.includes('warranty') || topicLower.includes('return') || topicLower.includes('refund') ||
        topicLower.includes('help') || topicLower.includes('issue') || topicLower.includes('problem')) {
      return 'post-purchase support';
    }
    
    // Default to awareness
    return 'awareness';
  }

  /**
   * Categorize topics using AI API (Cerebras primary, OpenAI fallback)
   */
  public async categorizeTopicsWithAI(brandId: string, topics: string[]): Promise<void> {
    try {
      console.log(`🤖 Starting AI categorization for ${topics.length} topics`);
      
      // Get API keys
      const openaiApiKey = process.env['OPENAI_API_KEY'];
      const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
      const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
      
      // Try Cerebras first (primary)
      if (cerebrasApiKey && cerebrasApiKey !== 'your_cerebras_api_key_here') {
        console.log('🧠 Using Cerebras AI as primary provider');
        try {
          await this.categorizeWithCerebras(brandId, topics, cerebrasApiKey, cerebrasModel);
          console.log('✅ Cerebras AI categorization completed successfully');
          return;
        } catch (error) {
          console.error('❌ Cerebras AI failed:', error);
          console.log('🔄 Cerebras failed, trying OpenAI as fallback...');
        }
      } else {
        console.log('⚠️ Cerebras API key not configured, trying OpenAI...');
      }
      
      // Try OpenAI as fallback
      if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
        console.log('🤖 Using OpenAI as fallback provider');
        try {
          await this.categorizeWithOpenAI(brandId, topics, openaiApiKey);
          console.log('✅ OpenAI categorization completed successfully');
          return;
        } catch (error) {
          console.error('❌ OpenAI failed:', error);
          console.log('🔄 OpenAI failed, using rule-based categorization...');
        }
      } else {
        console.log('⚠️ OpenAI API key not configured, using rule-based categorization');
      }
      
      // Final fallback to rule-based categorization
      console.log('📋 Using rule-based categorization as final fallback');
      await this.categorizeTopicsWithRules(brandId, topics);

    } catch (error) {
      console.error('❌ AI categorization failed:', error);
      console.log('🔄 Falling back to rule-based categorization');
      await this.categorizeTopicsWithRules(brandId, topics);
    }
  }

  /**
   * Categorize topics using Cerebras AI
   */
  private async categorizeWithCerebras(brandId: string, topics: string[], apiKey: string, model: string): Promise<void> {
    console.log(`🧠 Categorizing topics with Cerebras AI (${model})`);
    
    const prompt = `You are an expert in brand marketing and customer journey analysis. 
      
I need you to categorize the following AEO (Answer Engine Optimization) topics into one of these 4 categories:

1. **awareness** - Topics that help users discover and learn about the brand
2. **comparison** - Topics that help users compare the brand with competitors  
3. **purchase** - Topics that help users make buying decisions
4. **post-purchase support** - Topics that help users after they've made a purchase

AEO Topics to categorize:
${topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

Please respond with a JSON object where each topic is mapped to its most appropriate category. Format:
{
  "topic_name": "category_name",
  "another_topic": "category_name"
}

Only use these exact category names: awareness, comparison, purchase, post-purchase support`;

    const response = await fetch('https://api.cerebras.ai/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        max_tokens: 2000,
        temperature: 0.3,
        stop: ['---END---']
      })
    });

    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const aiResponse = data.choices?.[0]?.text?.trim();
    
    if (!aiResponse) {
      throw new Error('Empty response from Cerebras API');
    }

    // Parse AI response with better error handling
    let categorization: Record<string, string>;
    try {
      // console.log('🧠 Raw Cerebras response:', aiResponse); // Removed verbose logging
      
      // Try multiple JSON extraction methods
      let jsonStr = '';
      
      // Method 1: Look for JSON object with balanced braces
      const jsonMatch = aiResponse.match(/\{[\s\S]*?\}(?=\s*$|\s*[^,}])/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
        // console.log('🧠 Extracted JSON (method 1):', jsonStr); // Removed verbose logging
      } else {
        // Method 2: Look for the first complete JSON object
        const lines = aiResponse.split('\n');
        let jsonLines = [];
        let braceCount = 0;
        let inJson = false;
        
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            inJson = true;
            braceCount = 0;
            jsonLines = [];
          }
          
          if (inJson) {
            jsonLines.push(line);
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0 && line.trim().endsWith('}')) {
              jsonStr = jsonLines.join('\n');
              // console.log('🧠 Extracted JSON (method 2):', jsonStr); // Removed verbose logging
              break;
            }
          }
        }
      }
      
      if (!jsonStr) {
        throw new Error('No valid JSON found in response');
      }
      
      categorization = JSON.parse(jsonStr);
      // console.log('🧠 Parsed categorization:', categorization); // Removed verbose logging
      
    } catch (parseError) {
      console.error('❌ Failed to parse Cerebras response:', parseError);
      // console.log('🧠 Raw response was:', aiResponse); // Removed verbose logging
      console.log('🔄 Falling back to rule-based categorization');
      await this.categorizeTopicsWithRules(brandId, topics);
      return;
    }

    console.log('🧠 Cerebras AI categorization result:', categorization);
    await this.updateTopicsWithCategories(brandId, categorization);
  }

  /**
   * Categorize topics using OpenAI
   */
  private async categorizeWithOpenAI(brandId: string, topics: string[], apiKey: string): Promise<void> {
    console.log(`🤖 Categorizing topics with OpenAI`);
    
    const prompt = `You are an expert in brand marketing and customer journey analysis. 
      
I need you to categorize the following AEO (Answer Engine Optimization) topics into one of these 4 categories:

1. **awareness** - Topics that help users discover and learn about the brand
2. **comparison** - Topics that help users compare the brand with competitors  
3. **purchase** - Topics that help users make buying decisions
4. **post-purchase support** - Topics that help users after they've made a purchase

AEO Topics to categorize:
${topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

Please respond with a JSON object where each topic is mapped to its most appropriate category. Format:
{
  "topic_name": "category_name",
  "another_topic": "category_name"
}

Only use these exact category names: awareness, comparison, purchase, post-purchase support`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in brand marketing and customer journey analysis. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const aiResponse = data.choices?.[0]?.message?.content?.trim();
    
    if (!aiResponse) {
      throw new Error('Empty response from OpenAI API');
    }

    // Parse AI response
    let categorization: Record<string, string>;
    try {
      categorization = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', aiResponse);
      throw new Error('Invalid JSON response from OpenAI AI');
    }

    console.log('🤖 OpenAI categorization result:', categorization);
    await this.updateTopicsWithCategories(brandId, categorization);
  }

  /**
   * Update topics with categories in database
   */
  private async updateTopicsWithCategories(brandId: string, categorization: Record<string, string>): Promise<void> {
    console.log('💾 Updating topics with categories in database...');
    
    for (const [topicName, category] of Object.entries(categorization)) {
      const { error: updateError } = await supabaseAdmin
        .from('brand_topics')
        .update({ category: category })
        .eq('brand_id', brandId)
        .eq('topic_name', topicName); // Fixed: use topic_name instead of topic

      if (updateError) {
        console.error(`❌ Failed to update topic ${topicName} with category ${category}:`, updateError);
      } else {
        console.log(`✅ Categorized "${topicName}" as "${category}"`);
      }
    }

    console.log('🎯 AI categorization completed successfully');
  }

  /**
   * Fallback: Categorize topics using rules
   */
  private async categorizeTopicsWithRules(brandId: string, topics: string[]): Promise<void> {
    console.log(`📋 Using rule-based categorization for ${topics.length} topics`);
    
    for (const topic of topics) {
      const category = this.categorizeTopicByRules(topic);
      
      const { error: updateError } = await supabaseAdmin
        .from('brand_topics')
        .update({ category: category })
        .eq('brand_id', brandId)
        .eq('topic', topic);

      if (updateError) {
        console.error(`❌ Failed to update topic ${topic} with category ${category}:`, updateError);
      } else {
        console.log(`✅ Rule-categorized "${topic}" as "${category}"`);
      }
    }
  }
}

export const brandService = new BrandService();
