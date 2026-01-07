import { supabaseAdmin } from '../config/database';
import { 
  Brand, 
  BrandOnboardingRequest, 
  BrandOnboardingResponse, 
  DatabaseError,
  ValidationError 
} from '../types/auth';
import { v4 as uuidv4 } from 'uuid';
import { queryGenerationService } from './query-generation.service';
import { topicsQueryGenerationService, TopicsAndQueriesResponse } from './topics-query-generation.service';
import { dataCollectionService, QueryExecutionRequest } from './data-collection/data-collection.service';
import { competitorVersioningService } from './competitor-management';
import { OptimizedMetricsHelper } from './query-helpers/optimized-metrics.helper';

type NormalizedCompetitor = {
  name: string;
  domain?: string;
  url?: string;
  relevance?: string;
  industry?: string;
  logo?: string;
  source?: string;
};

export class BrandService {
  private parseFiniteNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return null;
    return num;
  }

  private normalizeVisibilityScore(value: any): number | null {
    const num = this.parseFiniteNumber(value);
    if (num === null) return null;
    // Most visibility_index values are stored 0..1; convert to 0..100
    if (num >= 0 && num <= 1) {
      return Math.round(Math.min(1, Math.max(0, num)) * 100);
    }
    // If already 0..100, keep/clamp
    return Math.round(Math.max(0, Math.min(100, num)));
  }
  /**
   * Create a new brand for a customer
   */
  async createBrand(
    customerId: string, 
    brandData: BrandOnboardingRequest
  ): Promise<BrandOnboardingResponse> {
    try {
      const normalizeDomain = (value?: string) => {
        if (!value) {
          return '';
        }
        return value
          .toString()
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0];
      };

      const buildUrlFromDomain = (value?: string) => {
        const domainOnly = normalizeDomain(value);
        return domainOnly ? `https://${domainOnly}` : '';
      };

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
      // If it exists, we'll update it and allow adding more queries/topics/competitors
      let existingBrand = null;
      try {
        const { data: brandCheck, error: existingError } = await supabaseAdmin
          .from('brands')
          .select('id, name, homepage_url')
          .eq('customer_id', customerId)
          .or(`name.eq.${brandData.brand_name},homepage_url.eq.${brandData.website_url}`)
          .maybeSingle();

        if (brandCheck && !existingError) {
          existingBrand = brandCheck;
          console.log(`ℹ️ Brand "${brandData.brand_name}" already exists - will update and add new queries/topics/competitors`);
        }
      } catch (checkError) {
        console.log('⚠️ Error checking for existing brand, proceeding with creation:', checkError);
      }

      let brandId: string;
      let newBrand: any;
      
      if (existingBrand) {
        // Brand exists - update it and proceed with adding queries/topics/competitors
        brandId = existingBrand.id;
        console.log(`🔄 Updating existing brand: ${existingBrand.name} (${brandId})`);
        
        // Update brand metadata and other fields
        const metadata = {
          ...(brandData.metadata || {}),
          ai_models: brandData.ai_models || [],
          topics: brandData.aeo_topics || [],
          ceo: brandData.metadata?.ceo,
          headquarters: brandData.metadata?.headquarters,
          founded_year: brandData.metadata?.founded_year,
          brand_logo: (brandData as any).logo || brandData.metadata?.logo || undefined,
        };

        const { data: updatedBrand, error: updateError } = await supabaseAdmin
          .from('brands')
          .update({
            industry: brandData.industry || undefined,
            summary: brandData.description || undefined,
            ceo: brandData.metadata?.ceo || undefined,
            headquarters: brandData.metadata?.headquarters || undefined,
            founded_year: brandData.metadata?.founded_year || undefined,
            metadata: metadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', brandId)
          .select()
          .single();

        if (updateError || !updatedBrand) {
          console.error('⚠️ Failed to update existing brand, proceeding anyway:', updateError);
          // Fetch the existing brand to continue
          const { data: fetchedBrand } = await supabaseAdmin
            .from('brands')
            .select('*')
            .eq('id', brandId)
            .single();
          newBrand = fetchedBrand || existingBrand;
        } else {
          newBrand = updatedBrand;
        }
      } else {
        // Brand doesn't exist - create new one
        brandId = uuidv4();
        const brandSlug = brandData.brand_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }

      // Normalize competitors (for both new and existing brands)
      const seenCompetitorNames = new Set<string>();
      const normalizedCompetitors: NormalizedCompetitor[] = (brandData.competitors || [])
        .map((competitor: any, index: number): NormalizedCompetitor | null => {
          try {
            if (!competitor && competitor !== 0) {
              return null;
            }

            if (typeof competitor === 'string') {
              const name = competitor.trim();
              if (!name) {
                return null;
              }
              const key = name.toLowerCase();
              if (seenCompetitorNames.has(key)) {
                return null;
              }
              seenCompetitorNames.add(key);
              const domain = normalizeDomain(name);
              return {
                name,
                domain,
                url: buildUrlFromDomain(domain),
                relevance: 'Direct Competitor',
                industry: '',
                logo: domain ? `https://logo.clearbit.com/${domain}` : '',
                source: 'onboarding',
              };
            }

            const name =
              (competitor.name ||
                competitor.companyName ||
                competitor.domain ||
                `Competitor ${index + 1}`) as string;
            const trimmedName = name.trim();
            if (!trimmedName) {
              return null;
            }

            const key = trimmedName.toLowerCase();
            if (seenCompetitorNames.has(key)) {
              return null;
            }
            seenCompetitorNames.add(key);

            const domain =
              normalizeDomain(competitor.domain) || normalizeDomain(competitor.url);
            const url =
              competitor.url && competitor.url.startsWith('http')
                ? competitor.url
                : buildUrlFromDomain(competitor.url || domain);

            const relevance = competitor.relevance || 'Direct Competitor';
            const industry = competitor.industry || '';
            const logo =
              competitor.logo ||
              (domain ? `https://logo.clearbit.com/${domain}` : '');

            return {
              name: trimmedName,
              domain,
              url,
              relevance,
              industry,
              logo,
              source: competitor.source || 'onboarding',
            };
          } catch (error) {
            console.warn('⚠️ Failed to normalize competitor payload:', error, competitor);
            return null;
          }
        })
        .filter((item): item is NormalizedCompetitor => Boolean(item));
      
      // 🎯 NEW: Verify competitors with enhanced validation
      const verifiedCompetitors: NormalizedCompetitor[] = await this.verifyCompetitors(
        normalizedCompetitors,
        brandData.brand_name
      );
      
      const competitorNames = verifiedCompetitors.map((competitor) => competitor.name).filter(Boolean);
      
      // Create brand if it doesn't exist
      if (!existingBrand) {
        // Prepare metadata with ai_models
        const metadata = {
          ...(brandData.metadata || {}),
          ai_models: brandData.ai_models || [],
          topics: brandData.aeo_topics || [],
          ceo: brandData.metadata?.ceo,
          headquarters: brandData.metadata?.headquarters,
          founded_year: brandData.metadata?.founded_year,
          brand_logo: (brandData as any).logo || brandData.metadata?.logo || undefined,
          competitors_detail: verifiedCompetitors
        };
        
        const brandSlug = brandData.brand_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        const { data: createdBrand, error: brandError } = await supabaseAdmin
          .from('brands')
          .insert({
            id: brandId,
            customer_id: customerId,
            name: brandData.brand_name,
            slug: brandSlug,
            homepage_url: brandData.website_url,
            industry: brandData.industry,
            summary: brandData.description,
            ceo: brandData.metadata?.ceo,
            headquarters: brandData.metadata?.headquarters,
            founded_year: brandData.metadata?.founded_year,
            metadata: metadata
          })
          .select()
          .single();

        if (brandError || !createdBrand) {
          console.error('❌ Brand creation failed:', {
            brandError,
            createdBrand,
            brandData: {
              name: brandData.brand_name,
              website_url: brandData.website_url,
              industry: brandData.industry,
              description: brandData.description
            }
          });
          throw new DatabaseError(`Failed to create brand: ${brandError?.message || 'Unknown error'}`);
        }
        
        newBrand = createdBrand;
      }

      // Create onboarding artifact with full BrandIntel structure
      // This creates a history record for each setup run (both new and existing brands)
      const artifactId = uuidv4();
      const artifactData = {
        input: { raw: brandData.website_url || brandData.brand_name },
        brandName: brandData.brand_name,
        homepageUrl: brandData.website_url,
        summary: brandData.description,
        ceo: brandData.metadata?.ceo,
        headquarters: brandData.metadata?.headquarters,
        foundedYear: brandData.metadata?.founded_year,
        industry: brandData.industry,
        competitors: verifiedCompetitors,
        topics: brandData.metadata?.topics || brandData.aeo_topics || [],
        ai_models: brandData.ai_models || [], // Store selected AI models
        sources: (brandData as any).sources || [],
        generatedAtIso: brandData.metadata?.generated_at || new Date().toISOString(),
        is_update: existingBrand ? true : false // Mark if this is an update to existing brand
      };

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
        // Don't throw error here as brand was created/updated successfully
      } else {
        console.log(`✅ Created onboarding artifact for brand ${newBrand.name} (${existingBrand ? 'update' : 'new'})`);
      }

      // Insert competitors into brand_competitors table
      // For existing brands, only insert new competitors (avoid duplicates)
      if (verifiedCompetitors.length > 0) {
        // Check existing competitors to avoid duplicates
        let existingCompetitorNames = new Set<string>();
        if (existingBrand) {
          const { data: existingCompetitors } = await supabaseAdmin
            .from('brand_competitors')
            .select('competitor_name')
            .eq('brand_id', newBrand.id);
          
          if (existingCompetitors) {
            existingCompetitorNames = new Set(
              existingCompetitors.map((c: any) => c.competitor_name?.toLowerCase().trim()).filter(Boolean)
            );
          }
        }
        
        // Filter out competitors that already exist
        const newCompetitors = verifiedCompetitors.filter(competitor => 
          !existingCompetitorNames.has(competitor.name.toLowerCase().trim())
        );
        
        if (newCompetitors.length > 0) {
          const competitorRecords = newCompetitors.map((competitor, index) => {
            // Get the next priority number (existing max + index + 1)
            const basePriority = existingBrand ? (existingCompetitorNames.size + index + 1) : (index + 1);
            return {
              brand_id: newBrand.id,
              competitor_name: competitor.name,
              competitor_url: competitor.url || buildUrlFromDomain(competitor.domain),
              priority: basePriority,
              metadata: {
                domain: competitor.domain || null,
                relevance: competitor.relevance || null,
                industry: competitor.industry || null,
                logo: competitor.logo || null,
                source: competitor.source || 'onboarding'
              }
            };
          });

          const { error: competitorError } = await supabaseAdmin
            .from('brand_competitors')
            .insert(competitorRecords);

          if (competitorError) {
            console.error('⚠️ Failed to insert competitors:', competitorError);
            console.error('🔍 DEBUG: Competitor records that failed:', competitorRecords);
            // Don't throw - brand was created/updated successfully
          } else {
            console.log(`✅ Inserted ${competitorRecords.length} new competitors for brand ${newBrand.name}`);
          }
        } else if (existingBrand) {
          console.log(`ℹ️ All ${verifiedCompetitors.length} competitors already exist for brand ${newBrand.name}`);
        }
      }

      // 🎯 PHASE 2.5: Automatic brand enrichment (synonyms and products)
      // Only run for newly created brands, not updates (to avoid overwriting user edits)
      if (!existingBrand && verifiedCompetitors.length > 0) {
        try {
          console.log(`🔄 Triggering automatic brand enrichment for new brand ${newBrand.id}...`);
          // Import and trigger enrichment asynchronously (non-blocking)
          const { brandProductEnrichmentService } = await import('./onboarding/brand-product-enrichment.service');
          
          // Run in background to not block brand creation response
          setTimeout(async () => {
            try {
              await brandProductEnrichmentService.enrichBrand(newBrand.id, (msg: string) => console.log(`   [Enrichment] ${msg}`));
              console.log(`✅ Automatic brand enrichment completed for brand ${newBrand.id}`);
            } catch (enrichmentError) {
              console.warn(`⚠️ Automatic brand enrichment failed for brand ${newBrand.id} (non-critical):`, enrichmentError);
              // Don't throw - enrichment failure shouldn't block brand creation
            }
          }, 500); // Small delay to ensure brand creation response is sent first
          
          console.log(`✅ Automatic brand enrichment triggered for brand ${newBrand.id} (running in background)`);
        } catch (enrichmentError) {
          console.warn(`⚠️ Failed to trigger brand enrichment for brand ${newBrand.id} (non-blocking):`, enrichmentError);
          // Don't throw - enrichment failure shouldn't block brand creation
        }
      } else if (existingBrand) {
        console.log(`ℹ️ Skipping automatic enrichment for existing brand ${newBrand.id} (update, not new creation)`);
      } else if (verifiedCompetitors.length === 0) {
        console.log(`ℹ️ Skipping automatic enrichment for brand ${newBrand.id} (no competitors provided)`);
      }

      // Create initial competitor configuration version if competitors exist
      if (verifiedCompetitors.length > 0) {
        try {
          // Check if version already exists
          const existingConfig = await competitorVersioningService.getCurrentVersion(newBrand.id, customerId);
          if (!existingConfig) {
            await competitorVersioningService.createInitialVersion(
              newBrand.id,
              customerId,
              verifiedCompetitors.map((comp, index) => ({
                name: comp.name,
                url: comp.url,
                domain: comp.domain,
                relevance: comp.relevance,
                industry: comp.industry,
                logo: comp.logo,
                source: comp.source,
                priority: index + 1
              }))
            );
            console.log(`✅ Created initial competitor configuration version for brand ${newBrand.name}`);
          }
        } catch (versionError) {
          console.warn('⚠️ Failed to create competitor configuration version:', versionError);
          // Don't fail brand creation if versioning fails
        }
      }

      // Insert AEO topics into brand_topics table
      // Check both aeo_topics and metadata.topics fields
      const topics = brandData.aeo_topics || (brandData as any).metadata?.topics || [];
      
      // Extract topic labels and categories from objects or use strings directly
      const topicData = topics.map((topic: any) => {
        if (typeof topic === 'string') {
          return { label: topic, category: null };
        }
        return {
          label: topic.label || topic.name || String(topic),
          category: topic.category || null
        };
      });
      
      const topicLabels = topicData.map(t => t.label);
      const topicsWithCategories = topicData.filter(t => t.category);
      
      console.log('🔍 DEBUG: Topics extraction:', {
        aeo_topics: brandData.aeo_topics,
        metadata_topics: (brandData as any).metadata?.topics,
        extracted_topics: topics,
        extracted_labels: topicLabels,
        topics_with_categories: topicsWithCategories.length,
        topics_length: topics.length,
        is_array: Array.isArray(topics)
      });
      
      if (topicLabels && Array.isArray(topicLabels) && topicLabels.length > 0) {
        // Check existing topics to avoid duplicates
        let existingTopicNames = new Set<string>();
        if (existingBrand) {
          const { data: existingTopics } = await supabaseAdmin
            .from('brand_topics')
            .select('topic_name')
            .eq('brand_id', newBrand.id);
          
          if (existingTopics) {
            existingTopicNames = new Set(
              existingTopics.map((t: any) => t.topic_name?.toLowerCase().trim()).filter(Boolean)
            );
          }
        }
        
        // Create a map of topic_name -> category for quick lookup
        const categoryMap = new Map<string, string>();
        topicsWithCategories.forEach(t => {
          // Normalize category name - keep full category names as they are
          // Valid categories: awareness, comparison, purchase, post-purchase support
          let normalizedCategory = t.category?.toLowerCase().trim() || null;
          if (normalizedCategory) {
            // Map variations to standard names
            if (normalizedCategory === 'support' || normalizedCategory === 'post-purchase' || normalizedCategory === 'postpurchase') {
              normalizedCategory = 'post-purchase support';
            } else if (normalizedCategory === 'awareness' || normalizedCategory === 'aware') {
              normalizedCategory = 'awareness';
            } else if (normalizedCategory === 'comparison' || normalizedCategory === 'compare') {
              normalizedCategory = 'comparison';
            } else if (normalizedCategory === 'purchase' || normalizedCategory === 'buy') {
              normalizedCategory = 'purchase';
            }
            categoryMap.set(t.label, normalizedCategory);
          }
        });
        
        // Deduplicate topics by name (keep first occurrence)
        const seenTopics = new Set<string>();
        const uniqueTopicLabels: string[] = [];
        for (const topicLabel of topicLabels) {
          const normalized = topicLabel.toLowerCase().trim();
          if (!seenTopics.has(normalized)) {
            seenTopics.add(normalized);
            uniqueTopicLabels.push(topicLabel);
          }
        }
        
        // Filter out topics that already exist
        const newTopics = uniqueTopicLabels.filter(topicLabel => 
          !existingTopicNames.has(topicLabel.toLowerCase().trim())
        );
        
        if (newTopics.length > 0) {
          // Helper function to normalize category before insertion
          const normalizeCategoryForDB = (cat: string | null | undefined): string | null => {
            if (!cat) return null;
            const normalized = cat.toLowerCase().trim();
            // Map variations to standard database category names
            if (normalized === 'support' || normalized === 'post-purchase' || normalized === 'postpurchase') {
              return 'post-purchase support';
            }
            // Only allow valid categories
            const validCategories = ['awareness', 'comparison', 'purchase', 'post-purchase support'];
            if (validCategories.includes(normalized)) {
              return normalized;
            }
            // If invalid category, return null (will be categorized later by AI)
            return null;
          };
          
          const topicRecords = newTopics.map((topicLabel: string) => {
            // Get category from map or find it in original topics
            let category = categoryMap.get(topicLabel);
            if (!category) {
              // Try to find category from original topic data
              const originalTopic = topics.find((t: any) => 
                (t.label || t.name || String(t)).toLowerCase().trim() === topicLabel.toLowerCase().trim()
              );
              if (originalTopic && originalTopic.category) {
                category = originalTopic.category;
              }
            }
            // Normalize category before insertion
            const normalizedCategory = normalizeCategoryForDB(category);
            
            return {
              brand_id: newBrand.id,
              topic_name: topicLabel,
              category: normalizedCategory,
              description: '' // We don't have descriptions from onboarding
            };
          });

          console.log('🔍 DEBUG: Inserting topics into brand_topics table:', topicRecords);
          
          const { error: topicError } = await supabaseAdmin
            .from('brand_topics')
            .insert(topicRecords);

          if (topicError) {
            console.error('⚠️ Failed to insert topics:', topicError);
            console.error('🔍 DEBUG: Topic records that failed:', topicRecords);
            // Don't throw - brand was created/updated successfully
          } else {
            console.log(`✅ Inserted ${topicRecords.length} new topics for brand ${newBrand.name}`);
          }
        } else if (existingBrand) {
          console.log(`ℹ️ All ${uniqueTopicLabels.length} topics already exist for brand ${newBrand.name}`);
        }
        
        // For existing brands, we still want to proceed with query generation for existing topics
        // So we use all unique topics (not just new ones) for query generation
        const topicsForQueryGen = existingBrand ? uniqueTopicLabels : newTopics;
        
        if (topicsForQueryGen.length > 0) {
          
          // Check which topics need categorization (those without category from frontend)
          // For existing brands, check all topics; for new brands, only check new topics
          const topicsToCheck = existingBrand ? uniqueTopicLabels : newTopics;
          const uncategorizedTopics = topicsToCheck.filter(label => !categoryMap.has(label));
          const categorizedCount = topicsToCheck.length - uncategorizedTopics.length;
          
          if (categorizedCount > 0) {
            console.log(`✅ ${categorizedCount} topics already have categories from frontend`);
          }
          
          // Only categorize topics that don't have categories from frontend
          if (uncategorizedTopics.length > 0) {
            console.log(`🤖 Starting AI categorization for ${uncategorizedTopics.length} uncategorized topics`);
            console.log(`📋 Topics to categorize:`, uncategorizedTopics);
            
            try {
              await this.categorizeTopicsWithAI(newBrand.id, uncategorizedTopics);
              console.log(`✅ AI categorization completed for brand ${newBrand.id}`);
            } catch (error) {
              console.error('⚠️ Failed to categorize topics with AI:', error);
              console.log('🔄 AI categorization failed, using rule-based fallback');
              
              // GUARANTEED FALLBACK: Always categorize topics using rules
              try {
                await this.categorizeTopicsWithRules(newBrand.id, uncategorizedTopics);
                console.log(`✅ Rule-based categorization completed for brand ${newBrand.id}`);
              } catch (ruleError) {
                console.error('❌ Even rule-based categorization failed:', ruleError);
              }
            }
          } else {
            console.log(`✅ All topics already have categories, skipping AI categorization`);
          }
          
          // 🎯 PHASE 3: Save user-selected queries OR generate new queries
          // This code is inside the else block (line 380) - topics were inserted successfully
          // Check if user has selected queries in metadata.prompts or metadata.prompts_with_topics
          const promptsWithTopics = (brandData.metadata as any)?.prompts_with_topics || (brandData.metadata as any)?.prompts || [];
          let queryGenResult: { total_queries: number };
          
          if (promptsWithTopics && Array.isArray(promptsWithTopics) && promptsWithTopics.length > 0) {
            // Check if prompts are in new format (with topics) or old format (just strings)
            const isNewFormat = promptsWithTopics.length > 0 && typeof promptsWithTopics[0] === 'object' && promptsWithTopics[0].prompt;
            
            // Save user-selected queries directly
            console.log(`💾 Saving ${promptsWithTopics.length} user-selected queries to database (format: ${isNewFormat ? 'with topics' : 'legacy'})`);
            try {
              await this.saveUserSelectedQueries(
                newBrand.id,
                customerId,
                promptsWithTopics,
                topicsForQueryGen, // Use topicsForQueryGen instead of topicLabels
                newBrand.name,
                isNewFormat // Pass flag indicating if prompts include topic information
              );
              queryGenResult = { total_queries: promptsWithTopics.length };
              console.log(`✅ Saved ${promptsWithTopics.length} user-selected queries for brand ${newBrand.id}`);
            } catch (saveError) {
              console.error('⚠️ Failed to save user-selected queries, falling back to AI generation:', saveError);
              // Fall through to AI generation
              queryGenResult = { total_queries: 0 };
            }
          }
          
          // If no user-selected queries or save failed, generate queries with AI
          if (!queryGenResult || queryGenResult.total_queries === 0) {
            try {
              // Check if we should use the new topics+queries generation approach
              const useNewApproach = process.env.USE_NEW_TOPICS_QUERY_GENERATION === 'true';
              
              if (useNewApproach && topicsForQueryGen.length === 0) {
                // Use new approach: generate topics and queries together
                console.log(`🚀 Using NEW topics+queries generation approach for brand ${newBrand.name}`);
                
                const topicsAndQueries = await topicsQueryGenerationService.generateTopicsAndQueries({
                  brandName: newBrand.name,
                  industry: brandData.industry,
                  competitors: competitorNames,
                  description: brandData.description,
                  maxTopics: 20, // Filter to top 20 topics
                });

                // Store topics and queries
                await this.storeTopicsAndQueriesFromNewService(
                  newBrand.id,
                  customerId,
                  topicsAndQueries,
                  newBrand.name
                );

                queryGenResult = { total_queries: topicsAndQueries.topics.length };
                console.log(`✅ New approach: Generated ${topicsAndQueries.topics.length} topics with queries`);
              } else {
                // Use original approach: generate queries for existing topics
                console.log(`🚀 Triggering AI query generation for ${topicsForQueryGen.length} topics`);
                console.log(`📋 Topics for query generation:`, topicsForQueryGen);
                
                queryGenResult = await queryGenerationService.generateSeedQueries({
                  url: brandData.website_url,
                  locale: 'en-US',
                  country: 'US',
                  industry: brandData.industry,
                  competitors: competitorNames.join(', '),
                  keywords: brandData.keywords?.join(', '),
                  llm_provider: 'cerebras', // Use Cerebras as primary
                  brand_id: newBrand.id,
                  customer_id: customerId,
                  topics: topicsForQueryGen // Pass topicsForQueryGen instead of topicLabels
                });
                
                console.log(`✅ Query generation completed for brand ${newBrand.id} - Generated ${queryGenResult.total_queries} queries`);
              }
            } catch (genError) {
              console.error('⚠️ AI query generation failed:', genError);
              queryGenResult = { total_queries: 0 };
            }
          }
          
          // 🎯 PHASE 4: Automatically trigger data collection for generated queries
          // Use selected AI models from onboarding, or default to common collectors
          const selectedModels = brandData.ai_models || [];
          const collectors = this.mapAIModelsToCollectors(selectedModels);
          
          if (collectors.length > 0 && queryGenResult.total_queries > 0) {
            try {
              console.log(`🚀 Triggering automatic data collection for ${queryGenResult.total_queries} queries using collectors: ${collectors.join(', ')}`);
              
              // Fetch the generated queries from database
              const { data: generatedQueries, error: queriesError } = await supabaseAdmin
                .from('generated_queries')
                .select('id, query_text, intent, country')
                .eq('brand_id', newBrand.id)
                .eq('customer_id', customerId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(queryGenResult.total_queries);
              
              if (queriesError) {
                console.error('⚠️ Failed to fetch generated queries for data collection:', queriesError);
              } else if (generatedQueries && generatedQueries.length > 0) {
                // Prepare execution requests
                const executionRequests: QueryExecutionRequest[] = generatedQueries.map(query => ({
        queryId: query.id,
        brandId: newBrand.id,
        customerId: customerId,
        queryText: query.query_text,
        intent: query.intent || 'data_collection',
        locale: 'en-US',
        country: query.country || 'US',
        collectors: collectors
      }));
                
                // Execute queries through collectors (non-blocking)
                // Use setTimeout to run in background without blocking brand creation response
                setTimeout(async () => {
                  const startTime = Date.now();
                  const collectionMetrics = {
                    totalQueries: executionRequests.length,
                    totalExecutions: 0,
                    successCount: 0,
                    failedCount: 0,
                    failuresByCollector: {} as Record<string, number>,
                    errorsByType: {} as Record<string, number>,
                    executionIds: [] as string[]
                  };

                  try {
                    console.log(`📊 Starting background data collection for ${executionRequests.length} queries...`);
                    console.log(`📋 Collectors: ${collectors.join(', ')}`);
                    console.log(`🔗 Brand ID: ${newBrand.id}, Customer ID: ${customerId}`);
                    
                    const results = await dataCollectionService.executeQueries(executionRequests);
                    const endTime = Date.now();
                    const durationMs = endTime - startTime;
                    
                    collectionMetrics.totalExecutions = results.length;
                    collectionMetrics.successCount = results.filter(r => r.status === 'completed').length;
                    collectionMetrics.failedCount = results.filter(r => r.status === 'failed').length;
                    
                    // Aggregate failures by collector type
                    results.forEach(result => {
                      if (result.status === 'failed') {
                        const collector = result.collectorType || 'unknown';
                        collectionMetrics.failuresByCollector[collector] = 
                          (collectionMetrics.failuresByCollector[collector] || 0) + 1;
                        
                        // Extract error type from metadata if available
                        if (result.metadata?.error_type) {
                          const errorType = result.metadata.error_type;
                          collectionMetrics.errorsByType[errorType] = 
                            (collectionMetrics.errorsByType[errorType] || 0) + 1;
                        }
                      }
                      
                      // Track execution IDs
                      if (result.executionId) {
                        collectionMetrics.executionIds.push(result.executionId);
                      }
                    });
                    
                    // Log structured summary
                    console.log(`✅ Data collection completed in ${durationMs}ms`);
                    console.log(`📊 Data collection summary:`);
                    console.log(`   Total queries: ${collectionMetrics.totalQueries}`);
                    console.log(`   Total executions: ${collectionMetrics.totalExecutions}`);
                    console.log(`   Successful: ${collectionMetrics.successCount} (${Math.round((collectionMetrics.successCount / collectionMetrics.totalExecutions) * 100)}%)`);
                    console.log(`   Failed: ${collectionMetrics.failedCount} (${Math.round((collectionMetrics.failedCount / collectionMetrics.totalExecutions) * 100)}%)`);
                    
                    if (Object.keys(collectionMetrics.failuresByCollector).length > 0) {
                      console.log(`   Failures by collector:`, collectionMetrics.failuresByCollector);
                    }
                    
                    if (Object.keys(collectionMetrics.errorsByType).length > 0) {
                      console.log(`   Errors by type:`, collectionMetrics.errorsByType);
                    }
                    
                    // Store metrics in database (non-blocking)
                    try {
                      await this.storeDataCollectionMetrics(newBrand.id, customerId, collectionMetrics, durationMs);
                    } catch (metricsError) {
                      console.warn('⚠️ Failed to store data collection metrics (non-critical):', metricsError);
                    }
                    
                  } catch (collectionError: any) {
                    const endTime = Date.now();
                    const durationMs = endTime - startTime;
                    
                    // Structured error logging with context
                    const errorContext = {
                      brandId: newBrand.id,
                      customerId: customerId,
                      queryCount: executionRequests.length,
                      collectors: collectors,
                      durationMs: durationMs,
                      timestamp: new Date().toISOString()
                    };
                    
                    console.error('❌ Data collection execution failed (non-critical):', {
                      error: collectionError?.message || String(collectionError),
                      stack: collectionError?.stack,
                      context: errorContext
                    });
                    
                    // Log error to database (non-blocking)
                    try {
                      await this.logDataCollectionError(newBrand.id, customerId, collectionError, errorContext);
                    } catch (logError) {
                      console.warn('⚠️ Failed to log data collection error (non-critical):', logError);
                    }
                    
                    // Don't throw - data collection failure shouldn't affect brand creation
                  }
                }, 1000); // Small delay to ensure brand creation response is sent first
                
                console.log(`✅ Data collection triggered in background for ${executionRequests.length} queries`);
              } else {
                console.warn('⚠️ No generated queries found for data collection');
              }
            } catch (collectionError) {
              console.error('⚠️ Failed to trigger data collection (non-critical):', collectionError);
              // Don't throw - data collection failure shouldn't block brand creation
            }
          } else {
            console.log(`ℹ️ Skipping data collection: ${collectors.length === 0 ? 'No collectors selected' : 'No queries generated'}`);
          }
        } // Close the else block from line 380 (topics inserted successfully)
      } else {
        console.log('🔍 DEBUG: No topics found to insert:', {
          topics,
          topics_length: topics.length,
          is_array: Array.isArray(topics),
          brandData_keys: Object.keys(brandData),
          metadata_keys: (brandData as any).metadata ? Object.keys((brandData as any).metadata) : 'no metadata'
        });
      }

      // 🎯 PHASE 5: Trigger scoring for new brand (position extraction, sentiment scoring, citation extraction)
      // Only run for newly created brands, not updates
      if (!existingBrand) {
        try {
          console.log(`🔄 Triggering automatic scoring for new brand ${newBrand.id}...`);
          // Import and trigger scoring asynchronously (non-blocking)
          const { brandScoringService } = await import('./scoring/brand-scoring.orchestrator');
          // Use async method to not block brand creation response
          brandScoringService.scoreBrandAsync({
            brandId: newBrand.id,
            customerId,
            // Process all existing collector_results for this brand (if any exist already)
            // The scoring services will only process unprocessed results
            parallel: false // Run sequentially for better reliability
          });
          console.log(`✅ Automatic scoring triggered for brand ${newBrand.id} (running in background)`);
        } catch (scoringError) {
          console.warn(`⚠️ Failed to trigger scoring for brand ${newBrand.id} (non-blocking):`, scoringError);
          // Don't throw - scoring failure shouldn't block brand creation
        }
      } else {
        console.log(`ℹ️ Skipping scoring trigger for existing brand ${newBrand.id} (update, not new creation)`);
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
      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      const { data: brands, error } = await supabaseAdmin
        .from('brands')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new DatabaseError('Failed to fetch brands');
      }

      return (brands || []).map(b => this.transformBrand(b));
    } catch (error) {
      console.error('Error fetching brands:', error);
      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch brands');
    }
  }

  /**
   * Update brand collectors (AI models)
   */
  async updateBrandCollectors(brandId: string, customerId: string, aiModels: string[]): Promise<void> {
    try {
      if (!brandId || !customerId) {
        throw new ValidationError('Brand ID and Customer ID are required');
      }

      // Fetch current brand to get existing metadata
      const { data: brand, error: fetchError } = await supabaseAdmin
        .from('brands')
        .select('metadata')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .single();

      if (fetchError || !brand) {
        throw new DatabaseError(`Brand not found: ${fetchError?.message || 'Unknown error'}`);
      }

      const updatedMetadata = {
        ...(brand.metadata || {}),
        ai_models: aiModels
      };

      const { error: updateError } = await supabaseAdmin
        .from('brands')
        .update({ metadata: updatedMetadata })
        .eq('id', brandId)
        .eq('customer_id', customerId);

      if (updateError) {
        throw new DatabaseError(`Failed to update brand collectors: ${updateError.message}`);
      }

      console.log(`✅ Updated collectors for brand ${brandId}:`, aiModels);
    } catch (error) {
      console.error('Error updating brand collectors:', error);
      if (error instanceof DatabaseError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update brand collectors');
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

      return brand ? this.transformBrand(brand) : null;
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

      return brand ? this.transformBrand(brand) : null;
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
    updateData: any
  ): Promise<Brand> {
    try {
      // Validate input
      if (updateData.brand_name) {
        this.validateBrandName(updateData.brand_name);
      }
      if (updateData.website_url) {
        this.validateWebsiteUrl(updateData.website_url);
      }

      const updateFields: any = {
        updated_at: new Date().toISOString()
      };

      if (updateData.brand_name) updateFields.name = updateData.brand_name;
      if (updateData.website_url) updateFields.homepage_url = updateData.website_url;
      if (updateData.description) updateFields.summary = updateData.description;
      if (updateData.industry) updateFields.industry = updateData.industry;
      if (updateData.status !== undefined) {
        // Map 'inactive' to 'archived' to satisfy DB constraint
        // constraint brands_status_check check (status = any (array['active'::text, 'archived'::text]))
        updateFields.status = updateData.status === 'inactive' ? 'archived' : updateData.status;
      }

      console.log('📝 DEBUG: Final update fields for Supabase:', updateFields);

      const { data: updatedBrand, error } = await supabaseAdmin
        .from('brands')
        .update(updateFields)
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase error updating brand:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new DatabaseError(`Failed to update brand: ${error.message}`);
      }

      if (!updatedBrand) {
        console.error('❌ No brand updated for ID:', brandId, 'and customer:', customerId);
        throw new DatabaseError('Brand not found or not authorized');
      }

      console.log('✅ Brand updated successfully:', updatedBrand.id);
      return this.transformBrand(updatedBrand);
    } catch (error) {
      console.error('Error in updateBrand service method:', error);
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(error instanceof Error ? error.message : 'Failed to update brand');
    }
  }

  /**
   * Get brand stats for a customer
   */
  async getBrandStats(customerId: string): Promise<any> {
    try {
      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      // 1. Get total brands (active only)
      const { data: brands, error: brandsError } = await supabaseAdmin
        .from('brands')
        .select('id, metadata')
        .eq('customer_id', customerId)
        .neq('status', 'archived'); // Exclude archived brands

      if (brandsError) throw brandsError;
      const brandIds = brands.map(b => b.id);
      const totalBrands = brands.length;

      if (totalBrands === 0) {
        return {
          totalBrands: 0,
          totalTopics: 0,
          totalQueries: 0,
          avgLlmsPerBrand: 0,
          totalAnswers: 0
        };
      }

      // 2. Get total topics
      const { count: totalTopics, error: topicsError } = await supabaseAdmin
        .from('brand_topics')
        .select('*', { count: 'exact', head: true })
        .in('brand_id', brandIds);

      if (topicsError) throw topicsError;

      // 3. Get total queries
      const { count: totalQueries, error: queriesError } = await supabaseAdmin
        .from('generated_queries')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .in('brand_id', brandIds);

      if (queriesError) throw queriesError;

      // 4. Calculate average LLMs per brand
      let totalLlms = 0;
      brands.forEach(brand => {
        const aiModels = brand.metadata?.ai_models || [];
        totalLlms += aiModels.length;
      });
      const avgLlmsPerBrand = totalBrands > 0 ? totalLlms / totalBrands : 0;

      // 5. Calculate total answers (Queries * Average LLM)
      const totalAnswers = Math.round(totalQueries * avgLlmsPerBrand);

      return {
        totalBrands,
        totalTopics: totalTopics || 0,
        totalQueries: totalQueries || 0,
        avgLlmsPerBrand,
        totalAnswers
      };
    } catch (error) {
      console.error('Error fetching brand stats:', error);
      throw new DatabaseError('Failed to fetch brand stats');
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
   * Transform brand for response
   */
  private transformBrand(brand: any): Brand {
    if (!brand) return brand;
    
    // Map 'archived' back to 'inactive' for the frontend
    if (brand.status === 'archived') {
      brand.status = 'inactive';
    }
    
    return brand;
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
   * Get brand topics WITH analytics data from new schema
   * Queries metric_facts table with joins to brand_metrics and brand_sentiment
   * Filters by collector_type (model), country, and date range
   * Shows no data if data is not present (no fallback to legacy tables)
   */
  async getBrandTopicsWithAnalytics(
    brandId: string,
    customerId: string,
    startDate?: string,
    endDate?: string,
    collectorType?: string,
    country?: string,
    competitorNames?: string[] // Optional: filter by specific competitor names (lowercase)
  ): Promise<{ topics: any[]; availableModels: string[] }> {
    const overallStart = performance.now();
    try {
      console.log(`🎯 Fetching topics WITH analytics from new schema (metric_facts) for brand ${brandId}`);
      
      // Set default date range (last 30 days)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Validate dates
      if (isNaN(start.getTime())) {
        throw new Error(`Invalid startDate: ${startDate}`);
      }
      if (isNaN(end.getTime())) {
        throw new Error(`Invalid endDate: ${endDate}`);
      }
      
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      
      console.log(`📅 Date range: ${startIso} to ${endIso}`);
      
      const optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseAdmin);
      
      // Map collector type(s) if provided
      // Support both single collector type and comma-separated multiple types
      let mappedCollectorTypes: string[] = [];
      if (collectorType && collectorType.trim() !== '') {
        // Map frontend model IDs to collector_type values as stored in database
        // Database stores capitalized versions like "Google AIO", "ChatGPT", etc.
        const collectorTypeMap: Record<string, string> = {
          'chatgpt': 'ChatGPT',
          'claude': 'Claude',
          'gemini': 'Gemini',
          'perplexity': 'Perplexity',
          'copilot': 'Bing Copilot',
          'deepseek': 'DeepSeek',
          'mistral': 'Mistral',
          'grok': 'Grok',
          'google aio': 'Google AIO',  // Map lowercase with space to proper case
          'google_aio': 'Google AIO',  // Handle underscore input
          'google-ai': 'Google AIO',   // Handle dash input
          'google': 'Google AIO',      // Handle short form
          'bing_copilot': 'Bing Copilot',
          'bing copilot': 'Bing Copilot'
        };
        
        // Split by comma and map each collector type
        const inputTypes = collectorType.split(',').map(t => t.trim()).filter(Boolean);
        mappedCollectorTypes = inputTypes.map(input => {
          const normalizedInput = input.toLowerCase().trim();
          return collectorTypeMap[normalizedInput] || normalizedInput;
        });
        
        console.log(`🔍 Filtering by collector_type(s): ${mappedCollectorTypes.join(', ')} (from input: ${collectorType})`);
      }
      
      // Get distinct collector_types (models) available for this brand in the date range
      // Do this BEFORE filtering so we always return all available models, not just the filtered one
      const step1Start = performance.now();
      const availableModelsResult = await optimizedMetricsHelper.fetchDistinctCollectorTypes({
        brandId,
        startDate: startIso,
        endDate: endIso,
      });
      
      const step1Time = performance.now() - step1Start;
      let availableModels = new Set<string>();
      
      if (availableModelsResult.error) {
        console.warn(`⚠️ Warning: Error fetching distinct collector types:`, availableModelsResult.error);
      } else {
        availableModels = availableModelsResult.data;
      }
      
      console.log(`📊 Available models: ${Array.from(availableModels).join(', ') || 'none'} [${step1Time.toFixed(2)}ms]`);
      
      // Get positions from metric_facts (new schema only)
      const step2Start = performance.now();
      const result = await optimizedMetricsHelper.fetchTopicPositions({
        brandId,
        customerId,
        startDate: startIso,
        endDate: endIso,
        collectorTypes: mappedCollectorTypes.length > 0 ? mappedCollectorTypes : undefined,
      });
      
      const step2Time = performance.now() - step2Start;
      
      if (result.error) {
        console.error(`❌ Error fetching positions from metric_facts [${step2Time.toFixed(2)}ms]:`, result.error);
        throw new Error(`Failed to fetch positions: ${result.error}`);
      }
      
      // Transform to expected format
      const positions = result.data.map(row => ({
        share_of_answers_brand: row.share_of_answers_brand,
        sentiment_score: row.sentiment_score,
        visibility_index: row.visibility_index,
        has_brand_presence: row.has_brand_presence,
        processed_at: row.processed_at,
        collector_result_id: row.collector_result_id,
        topic: row.topic, // Topic comes directly from metric_facts.topic column
        metadata: null, // Not used in new schema
        collector_type: row.collector_type,
      }));
      
      // Log detailed info about positions and topics
      const positionsWithTopicsCount = positions.filter(p => p.topic && p.topic.trim().length > 0).length;
      const positionsWithoutTopicsCount = positions.length - positionsWithTopicsCount;
      console.log(`📊 Found ${positions.length} positions from metric_facts${mappedCollectorTypes.length > 0 ? ` (for collector_type(s): ${mappedCollectorTypes.join(', ')})` : ''} [${step2Time.toFixed(2)}ms]`);
      console.log(`   - Positions with topics: ${positionsWithTopicsCount}`);
      console.log(`   - Positions without topics: ${positionsWithoutTopicsCount}`);
      if (positions.length > 0 && positionsWithoutTopicsCount > 0) {
        console.log(`   ⚠️ Warning: ${positionsWithoutTopicsCount} positions will be filtered out because they have no topic`);
      }
      
      if (!positions || positions.length === 0) {
        console.log(`⚠️ No positions found in metric_facts${mappedCollectorTypes.length > 0 ? ` for collector_type(s): ${mappedCollectorTypes.join(', ')}` : ''} in date range ${startIso} to ${endIso}`);
        console.log(`   - Brand ID: ${brandId}`);
        console.log(`   - Customer ID: ${customerId}`);
        console.log(`   - Available models found: ${Array.from(availableModels).join(', ') || 'none'}`);
        // Return empty topics but still return availableModels so the filter dropdown works
        return { topics: [], availableModels: Array.from(availableModels) };
      }
      
      // Group analytics by topic (distinct topics only, not by collector_type)
      // Topics come directly from metric_facts.topic column
      const step3Start = performance.now();
      const topicMap = new Map<string, {
        topicName: string;
        analytics: Array<{
          share_of_answers_brand: number | null;
          sentiment_score: number | null;
          visibility_index: number | null;
          has_brand_presence: boolean;
          processed_at: string;
          collector_type: string;
        }>;
        collectorTypes: Set<string>; // Track which models have data for this topic
      }>();
      
      let positionsWithTopics = 0;
      let positionsWithoutTopics = 0;
      
      (positions || []).forEach(pos => {
        // Topic comes directly from metric_facts.topic column
        const topicName = pos.topic && typeof pos.topic === 'string' && pos.topic.trim().length > 0
          ? pos.topic.trim()
          : null;
        
        // Skip if no topic found
        if (!topicName) {
          positionsWithoutTopics++;
          return;
        }
        
        positionsWithTopics++;
        
        // Group by topic name only (not by collector_type) to get distinct topics
        const normalizedTopicName = topicName.toLowerCase().trim();
        const collectorType = pos.collector_type || 'unknown';
        
        if (!topicMap.has(normalizedTopicName)) {
          topicMap.set(normalizedTopicName, {
            topicName, // Keep original casing
            analytics: [],
            collectorTypes: new Set<string>()
          });
        }
        
        const topicData = topicMap.get(normalizedTopicName)!;
        topicData.analytics.push({
          // Keep NULL as NULL (don't convert to 0) to match SQL AVG behavior
          share_of_answers_brand: pos.share_of_answers_brand !== null && pos.share_of_answers_brand !== undefined
            ? pos.share_of_answers_brand
            : null,
          sentiment_score: pos.sentiment_score,
          visibility_index: pos.visibility_index,
          has_brand_presence: pos.has_brand_presence || false,
          processed_at: pos.processed_at,
          collector_type: collectorType
        });
        topicData.collectorTypes.add(collectorType.toLowerCase());
      });
      
      const step3Time = performance.now() - step3Start;
      console.log(`📊 Topic extraction summary [${step3Time.toFixed(2)}ms]:`);
      console.log(`   - Positions with topics: ${positionsWithTopics}`);
      console.log(`   - Positions without topics: ${positionsWithoutTopics}`);
      console.log(`   - Distinct topics found: ${topicMap.size}`);

      // Debug: Check collector types in the filtered data
      if (mappedCollectorTypes.length > 0) {
        const collectorTypeCounts = new Map<string, number>();
        positions.forEach(pos => {
          const ct = pos.collector_type || 'null';
          collectorTypeCounts.set(ct, (collectorTypeCounts.get(ct) || 0) + 1);
        });
        console.log(`🔍 Collector types in filtered positions:`, Object.fromEntries(collectorTypeCounts));

        // Check analytics collector types per topic
        topicMap.forEach((data, topicName) => {
          const analyticsCollectorTypes = new Set(data.analytics.map(a => a.collector_type));
          console.log(`📊 Topic "${topicName}": analytics from collector types: ${Array.from(analyticsCollectorTypes).join(', ')} (${data.analytics.length} data points)`);
        });
      }
      
      if (topicMap.size === 0) {
        console.log('⚠️ No topics found with analytics data.');
        console.log(`   - Total positions processed: ${positions.length}`);
        console.log(`   - Positions with topics: ${positionsWithTopics}`);
        console.log(`   - Positions without topics: ${positionsWithoutTopics}`);
        console.log(`   - Date range: ${startIso} to ${endIso}`);
        console.log(`   - Brand ID: ${brandId}`);
        
        // Debug: Check first few positions
        if (positions && positions.length > 0) {
          console.log('   Sample positions (first 3):');
          positions.slice(0, 3).forEach((pos, idx) => {
            console.log(`     [${idx}] topic: ${pos.topic || 'null'}, collector_type: ${pos.collector_type}, processed_at: ${pos.processed_at}`);
          });
        } else {
          console.log('   ⚠️ No positions were returned from the query at all!');
        }
      }
      
      // Step 4: Get topic metadata from brand_topics (if exists) for category/priority
      const step4MetadataStart = performance.now();
      const { data: brandTopics } = await supabaseAdmin
        .from('brand_topics')
        .select('topic_name, category, priority, description, id')
        .eq('brand_id', brandId)
        .eq('is_active', true);
      
      const brandTopicsMap = new Map<string, any>();
      if (brandTopics) {
        brandTopics.forEach(bt => {
          brandTopicsMap.set(bt.topic_name.toLowerCase().trim(), bt);
        });
      }
      const step4MetadataTime = performance.now() - step4MetadataStart;
      console.log(`📊 Step 4: Loaded ${brandTopicsMap.size} topic metadata entries [${step4MetadataTime.toFixed(2)}ms]`);
      
      // Step 5: Calculate metrics for each distinct topic (aggregate only from filtered collector_types)
      const topicsWithAnalytics = Array.from(topicMap.entries()).map(([normalizedTopicName, data]) => {
        const analytics = data.analytics;

        // Debug: Log analytics summary for this topic
        if (mappedCollectorTypes.length > 0) {
          // Exclude NULL values for accurate average (matching SQL AVG behavior)
          const validSoAValues = analytics
            .map(a => a.share_of_answers_brand)
            .filter((v: any) => v !== null && v !== undefined && typeof v === 'number' && isFinite(v));
          const avgSoA = validSoAValues.length > 0
            ? validSoAValues.reduce((sum, v) => sum + v, 0) / validSoAValues.length
            : 0;
          console.log(`📊 Topic "${data.topicName}": ${analytics.length} data points, ${validSoAValues.length} with SOA, avg SOA: ${avgSoA.toFixed(2)}`);
        }
        
        if (analytics.length === 0) {
          return null; // Skip topics with no analytics in date range
        }
        
        // Calculate metrics - Exclude NULL values (matching SQL AVG behavior)
        const soaValues = analytics
          .map(a => a.share_of_answers_brand)
          .filter((v: any) => v !== null && v !== undefined && typeof v === 'number' && isFinite(v));
        
        const sentimentValues = analytics
          .map(a => this.parseFiniteNumber(a.sentiment_score))
          .filter((v: any) => typeof v === 'number' && isFinite(v) && v !== null);
        
        const visibilityValues = analytics
          .map(a => this.parseFiniteNumber(a.visibility_index))
          .filter((v: any) => typeof v === 'number' && isFinite(v) && v !== null);
        
        const brandPresenceCount = analytics.filter(a => a.has_brand_presence).length;
        const totalQueries = analytics.length;
        
        const avgShareOfAnswer = soaValues.length > 0
          ? soaValues.reduce((sum: number, v: number) => sum + v, 0) / soaValues.length
          : 0;
        
        const avgSentiment = sentimentValues.length > 0
          ? sentimentValues.reduce((sum: number, v: number) => sum + v, 0) / sentimentValues.length
          : null;
        
        const avgVisibilityRaw = visibilityValues.length > 0
          ? visibilityValues.reduce((sum: number, v: number) => sum + v, 0) / visibilityValues.length
          : null;
        const avgVisibilityScore = avgVisibilityRaw !== null ? this.normalizeVisibilityScore(avgVisibilityRaw) : null;
        
        const brandPresencePercentage = totalQueries > 0
          ? (brandPresenceCount / totalQueries) * 100
          : null;
        
        // Get metadata from brand_topics if available
        const brandTopicMeta = brandTopicsMap.get(normalizedTopicName);
        
        return {
          id: brandTopicMeta?.id || `topic-${data.topicName.replace(/\s+/g, '-').toLowerCase()}`,
          topic_name: data.topicName,
          topic: data.topicName,
          category: brandTopicMeta?.category || 'uncategorized',
          priority: brandTopicMeta?.priority || 999,
          description: brandTopicMeta?.description || null,
          is_active: true,
          created_at: brandTopicMeta?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Analytics (aggregated across all collector_types)
          avgShareOfAnswer: Number(avgShareOfAnswer.toFixed(2)),
          avgSentiment: avgSentiment !== null ? Number(avgSentiment.toFixed(2)) : null,
          avgVisibility: avgVisibilityScore,
          brandPresencePercentage: brandPresencePercentage !== null ? Number(brandPresencePercentage.toFixed(0)) : null,
          totalQueries,
          // Available models for this topic (list of collector_types that have data)
          availableModels: Array.from(data.collectorTypes)
        };
      }).filter(Boolean) as any[]; // Remove nulls
      
      // Sort by priority, then by SoA descending
      topicsWithAnalytics.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (b.avgShareOfAnswer || 0) - (a.avgShareOfAnswer || 0);
      });
      const step5Time = performance.now() - step3Start;
      console.log(`📊 Step 5: Grouped ${topicsWithAnalytics.length} topics from ${positions.length} positions [${step5Time.toFixed(2)}ms]`);
      
      // Step 6: Fetch top citation sources per topic
      // Pass the filtered positions so citations are also filtered by collector_type
      const step6Start = performance.now();
      const topicSourcesMap = await this.getTopSourcesPerTopic(
        brandId,
        customerId,
        topicMap,
        startIso,
        endIso,
        positions // Pass filtered positions to ensure citations are also filtered by collector_type
      );
      const step6Time = performance.now() - step6Start;
      console.log(`📊 Step 6: Fetched top sources for ${topicSourcesMap.size} topics [${step6Time.toFixed(2)}ms]`);
      
      // Step 7: Calculate competitor average SOA per topic (only competitor SOA, not brand SOA)
      const step7Start = performance.now();
      const industryAvgSoAMap = await this.getIndustryAvgSoAPerTopic(
        brandId,
        customerId,
        topicsWithAnalytics.map(t => t.topic_name),
        startIso,
        endIso,
        competitorNames
      );
      const step7Time = performance.now() - step7Start;
      console.log(`📊 Step 7: Calculated competitor averages for ${industryAvgSoAMap.size} topics [${step7Time.toFixed(2)}ms]`);
      
      // Add top sources and competitor average SOA to each topic
      topicsWithAnalytics.forEach(topic => {
        const normalizedName = topic.topic_name.toLowerCase().trim();
        topic.topSources = topicSourcesMap.get(normalizedName) || [];
        
        // Add competitor averages (calculated from competitor values only)
        const industryAvg = industryAvgSoAMap.get(normalizedName);
        if (industryAvg) {
          topic.industryAvgSoA = industryAvg.avgSoA;
          topic.industryAvgVisibility = industryAvg.avgVisibility;
          topic.industryAvgSentiment = industryAvg.avgSentiment;
          topic.industryAvgSoATrend = industryAvg.trend;
          topic.industryBrandCount = industryAvg.brandCount;
          // Add individual competitor SOA map if available (for single competitor selection)
          if (industryAvg.competitorSoA) {
            topic.competitorSoAMap = Object.fromEntries(industryAvg.competitorSoA);
          }
          if (industryAvg.competitorVisibility) {
            topic.competitorVisibilityMap = Object.fromEntries(industryAvg.competitorVisibility);
          }
          if (industryAvg.competitorSentiment) {
            topic.competitorSentimentMap = Object.fromEntries(industryAvg.competitorSentiment);
          }
        } else {
          topic.industryAvgSoA = null;
          topic.industryAvgVisibility = null;
          topic.industryAvgSentiment = null;
          topic.industryAvgSoATrend = null;
          topic.industryBrandCount = 0;
          topic.competitorSoAMap = undefined;
          topic.competitorVisibilityMap = undefined;
          topic.competitorSentimentMap = undefined;
        }
      });
      
      // Return topics with available models metadata
      const response = {
        topics: topicsWithAnalytics,
        availableModels: Array.from(availableModels)
      };
      
      const overallTime = performance.now() - overallStart;
      console.log(`✅ Returned ${topicsWithAnalytics.length} distinct topics with analytics data [TOTAL: ${overallTime.toFixed(2)}ms]`);
      console.log(`📊 Available models: ${Array.from(availableModels).join(', ')}`);
      return response;
      
    } catch (error) {
      const overallTime = performance.now() - overallStart;
      console.error(`❌ Error in getBrandTopicsWithAnalytics [${overallTime.toFixed(2)}ms]:`, error);
      throw error;
    }
  }

  /**
   * Get industry-wide average SOA per topic (all brands except current brand)
   */
  private async getIndustryAvgSoAPerTopic(
    currentBrandId: string,
    customerId: string,
    topicNames: string[],
    startIso: string,
    endIso: string,
    competitorNames?: string[] // Optional: filter by specific competitor names (lowercase)
  ): Promise<
    Map<
      string,
      {
        avgSoA: number
        avgVisibility: number | null
        avgSentiment: number | null
        trend: { direction: 'up' | 'down' | 'neutral'; delta: number }
        brandCount: number
        competitorSoA?: Map<string, number>
        competitorVisibility?: Map<string, number>
        competitorSentiment?: Map<string, number>
      }
    >
  > {
    const funcStart = performance.now();
    try {
      if (topicNames.length === 0) {
        return new Map();
      }

      // Use optimized schema only (no legacy fallback)
      console.log('   ⚡ [Competitor Averages] Using optimized query (metric_facts + competitor_metrics)');
      return this.getCompetitorAveragesOptimized(
        currentBrandId,
        customerId,
        topicNames,
        startIso,
        endIso,
        competitorNames
      );

    } catch (error) {
      const funcTime = performance.now() - funcStart;
      console.error(`⚠️ Error in getIndustryAvgSoAPerTopic [${funcTime.toFixed(2)}ms]:`, error);
      return new Map();
    }
  }

  /**
   * Get competitor averages per topic using OPTIMIZED schema
   * (metric_facts + competitor_metrics + competitor_sentiment)
   * Matches legacy logic exactly: filters, exclusions, trends, per-competitor breakdowns
   */
  private async getCompetitorAveragesOptimized(
    currentBrandId: string,
    customerId: string,
    topicNames: string[],
    startIso: string,
    endIso: string,
    competitorNames?: string[]
  ): Promise<
    Map<
      string,
      {
        avgSoA: number;
        avgVisibility: number | null;
        avgSentiment: number | null;
        trend: { direction: 'up' | 'down' | 'neutral'; delta: number };
        brandCount: number;
        competitorSoA?: Map<string, number>;
        competitorVisibility?: Map<string, number>;
        competitorSentiment?: Map<string, number>;
      }
    >
  > {
    try {
      // Get current brand name to exclude it when it appears as a competitor
      const { data: currentBrand } = await supabaseAdmin
        .from('brands')
        .select('name')
        .eq('id', currentBrandId)
        .single();
      
      const currentBrandName = currentBrand?.name?.toLowerCase().trim() || null;
      
      // Normalize topic names for matching
      const normalizedTopicNames = topicNames.map(name => name.toLowerCase().trim());
      const topicNameSet = new Set(normalizedTopicNames);
      
      // Use optimized helper to get competitor metrics
      const optimizedMetricsHelper = new OptimizedMetricsHelper(supabaseAdmin);
      const result = await optimizedMetricsHelper.fetchCompetitorMetricsByTopic({
        customerId,
        currentBrandId,
        currentBrandName: currentBrandName || undefined,
        topicNames,
        startDate: startIso,
        endDate: endIso,
        competitorNames,
      });
      
      if (result.error) {
        console.warn(`⚠️ Error fetching competitor metrics from new schema:`, result.error);
        return new Map();
      }
      
      if (!result.data || result.data.length === 0) {
        console.log(`ℹ️ No competitor data found for comparison (${result.duration_ms}ms)`);
        console.log(`   - Looking for topics: ${normalizedTopicNames.join(', ')}`);
        console.log(`   - Date range: ${startIso} to ${endIso}`);
        return new Map();
      }
      
      console.log(`📊 Found ${result.data.length} competitor positions for comparison (${result.duration_ms}ms)`);
      
      // Group by normalized topic name and calculate averages (matching legacy logic)
      const topicDataMap = new Map<
        string,
        {
          soaValues: number[];
          visibilityValues: number[];
          sentimentValues: number[];
          brandIds: Set<string>;
          timestamps: Date[];
          competitorSoAMap?: Map<string, number[]>;
          competitorVisibilityMap?: Map<string, number[]>;
          competitorSentimentMap?: Map<string, number[]>;
        }
      >();
      
      result.data.forEach(pos => {
        const normalizedTopicName = pos.topic.toLowerCase().trim();
        
        // Only process topics we care about
        if (!topicNameSet.has(normalizedTopicName)) return;
        
        if (!topicDataMap.has(normalizedTopicName)) {
          topicDataMap.set(normalizedTopicName, {
            soaValues: [],
            visibilityValues: [],
            sentimentValues: [],
            brandIds: new Set(),
            timestamps: [],
            competitorSoAMap: competitorNames && competitorNames.length > 0 ? new Map() : undefined,
            competitorVisibilityMap: competitorNames && competitorNames.length > 0 ? new Map() : undefined,
            competitorSentimentMap: competitorNames && competitorNames.length > 0 ? new Map() : undefined
          });
        }
        
        const topicData = topicDataMap.get(normalizedTopicName)!;
        
        // Parse metrics
        const competitorSoA = this.parseFiniteNumber(pos.share_of_answers);
        const competitorVisibilityRaw = this.parseFiniteNumber(pos.visibility_index);
        const competitorVisibility = competitorVisibilityRaw !== null ? this.normalizeVisibilityScore(competitorVisibilityRaw) : null;
        const competitorSentiment = this.parseFiniteNumber(pos.sentiment_score);
        
        const competitorNameKey = pos.competitor_name ? pos.competitor_name.toLowerCase().trim() : null;
        
        const anyMetricPresent =
          (typeof competitorSoA === 'number' && isFinite(competitorSoA)) ||
          (typeof competitorVisibility === 'number' && isFinite(competitorVisibility)) ||
          (typeof competitorSentiment === 'number' && isFinite(competitorSentiment));
        
        if (anyMetricPresent) {
          // Track the brand_id (for brand count)
          if (pos.brand_id) {
            topicData.brandIds.add(pos.brand_id);
          }
        }
        
        // Add SOA values
        if (typeof competitorSoA === 'number' && isFinite(competitorSoA)) {
          topicData.soaValues.push(competitorSoA);
          if (competitorNameKey) {
            if (!topicData.competitorSoAMap) topicData.competitorSoAMap = new Map<string, number[]>();
            if (!topicData.competitorSoAMap.has(competitorNameKey)) topicData.competitorSoAMap.set(competitorNameKey, []);
            topicData.competitorSoAMap.get(competitorNameKey)!.push(competitorSoA);
          }
        }
        
        // Add visibility values
        if (typeof competitorVisibility === 'number' && isFinite(competitorVisibility)) {
          topicData.visibilityValues.push(competitorVisibility);
          if (competitorNameKey) {
            if (!topicData.competitorVisibilityMap) topicData.competitorVisibilityMap = new Map<string, number[]>();
            if (!topicData.competitorVisibilityMap.has(competitorNameKey)) topicData.competitorVisibilityMap.set(competitorNameKey, []);
            topicData.competitorVisibilityMap.get(competitorNameKey)!.push(competitorVisibility);
          }
        }
        
        // Add sentiment values
        if (typeof competitorSentiment === 'number' && isFinite(competitorSentiment)) {
          topicData.sentimentValues.push(competitorSentiment);
          if (competitorNameKey) {
            if (!topicData.competitorSentimentMap) topicData.competitorSentimentMap = new Map<string, number[]>();
            if (!topicData.competitorSentimentMap.has(competitorNameKey)) topicData.competitorSentimentMap.set(competitorNameKey, []);
            topicData.competitorSentimentMap.get(competitorNameKey)!.push(competitorSentiment);
          }
        }
        
        // Track timestamp for trend calculation
        if (pos.processed_at) {
          topicData.timestamps.push(new Date(pos.processed_at));
        }
      });
      
      // Calculate averages and trends for each topic (matching legacy logic)
      const resultMap = new Map<
        string,
        {
          avgSoA: number;
          avgVisibility: number | null;
          avgSentiment: number | null;
          trend: { direction: 'up' | 'down' | 'neutral'; delta: number };
          brandCount: number;
          competitorSoA?: Map<string, number>;
          competitorVisibility?: Map<string, number>;
          competitorSentiment?: Map<string, number>;
        }
      >();
      
      topicDataMap.forEach((data, normalizedTopicName) => {
        if (data.soaValues.length === 0 && data.visibilityValues.length === 0 && data.sentimentValues.length === 0) return;
        
        // Calculate average SOA (or individual competitor SOA if single competitor selected)
        let avgSoA: number = 0;
        let avgVisibility: number | null = null;
        let avgSentiment: number | null = null;
        let competitorSoA: Map<string, number> | undefined;
        let competitorVisibility: Map<string, number> | undefined;
        let competitorSentiment: Map<string, number> | undefined;
        
        // If filtering by specific competitors and only one is selected, return that competitor's values
        if (competitorNames && competitorNames.length === 1) {
          const singleCompetitor = competitorNames[0];
          
          // SOA
          if (data.competitorSoAMap) {
            const competitorValues = data.competitorSoAMap.get(singleCompetitor) || [];
            if (competitorValues.length > 0) {
              avgSoA = competitorValues.reduce((sum, val) => sum + val, 0) / competitorValues.length;
              competitorSoA = new Map([[singleCompetitor, avgSoA]]);
            } else if (data.soaValues.length > 0) {
              avgSoA = data.soaValues.reduce((sum, val) => sum + val, 0) / data.soaValues.length;
            }
          } else if (data.soaValues.length > 0) {
            avgSoA = data.soaValues.reduce((sum, val) => sum + val, 0) / data.soaValues.length;
          }
          
          // Visibility
          if (data.competitorVisibilityMap) {
            const values = data.competitorVisibilityMap.get(singleCompetitor) || [];
            if (values.length > 0) {
              const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
              avgVisibility = avg;
              competitorVisibility = new Map([[singleCompetitor, avg]]);
            } else if (data.visibilityValues.length > 0) {
              avgVisibility = data.visibilityValues.reduce((sum, val) => sum + val, 0) / data.visibilityValues.length;
            }
          } else if (data.visibilityValues.length > 0) {
            avgVisibility = data.visibilityValues.reduce((sum, val) => sum + val, 0) / data.visibilityValues.length;
          }
          
          // Sentiment
          if (data.competitorSentimentMap) {
            const values = data.competitorSentimentMap.get(singleCompetitor) || [];
            if (values.length > 0) {
              const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
              avgSentiment = avg;
              competitorSentiment = new Map([[singleCompetitor, avg]]);
            } else if (data.sentimentValues.length > 0) {
              avgSentiment = data.sentimentValues.reduce((sum, val) => sum + val, 0) / data.sentimentValues.length;
            }
          } else if (data.sentimentValues.length > 0) {
            avgSentiment = data.sentimentValues.reduce((sum, val) => sum + val, 0) / data.sentimentValues.length;
          }
        } else {
          // Multiple competitors or no filter - calculate overall averages
          if (data.soaValues.length > 0) {
            avgSoA = data.soaValues.reduce((sum, val) => sum + val, 0) / data.soaValues.length;
          }
          
          if (data.visibilityValues.length > 0) {
            avgVisibility = data.visibilityValues.reduce((sum, val) => sum + val, 0) / data.visibilityValues.length;
          }
          
          if (data.sentimentValues.length > 0) {
            avgSentiment = data.sentimentValues.reduce((sum, val) => sum + val, 0) / data.sentimentValues.length;
          }
          
          // Calculate per-competitor averages if filtering by multiple competitors
          if (competitorNames && competitorNames.length > 1) {
            if (data.competitorSoAMap) {
              competitorSoA = new Map();
              data.competitorSoAMap.forEach((values, compName) => {
                if (values.length > 0) {
                  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                  competitorSoA!.set(compName, avg);
                }
              });
            }
            
            if (data.competitorVisibilityMap) {
              competitorVisibility = new Map();
              data.competitorVisibilityMap.forEach((values, compName) => {
                if (values.length > 0) {
                  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                  competitorVisibility!.set(compName, avg);
                }
              });
            }
            
            if (data.competitorSentimentMap) {
              competitorSentiment = new Map();
              data.competitorSentimentMap.forEach((values, compName) => {
                if (values.length > 0) {
                  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                  competitorSentiment!.set(compName, avg);
                }
              });
            }
          }
        }
        
        // Calculate trend
        let trend: { direction: 'up' | 'down' | 'neutral'; delta: number } = { direction: 'neutral', delta: 0 };
        if (data.timestamps.length >= 2 && data.soaValues.length >= 2) {
          // Sort by timestamp
          const sortedIndices = data.timestamps
            .map((t, i) => ({ t, i }))
            .sort((a, b) => a.t.getTime() - b.t.getTime())
            .map(x => x.i);
          
          const midpoint = Math.floor(sortedIndices.length / 2);
          const firstHalfIndices = sortedIndices.slice(0, midpoint);
          const secondHalfIndices = sortedIndices.slice(midpoint);
          
          if (firstHalfIndices.length > 0 && secondHalfIndices.length > 0) {
            const firstHalfSoA = firstHalfIndices
              .map(i => data.soaValues[i])
              .filter(v => typeof v === 'number' && isFinite(v));
            const secondHalfSoA = secondHalfIndices
              .map(i => data.soaValues[i])
              .filter(v => typeof v === 'number' && isFinite(v));
            
            if (firstHalfSoA.length > 0 && secondHalfSoA.length > 0) {
              const firstAvg = firstHalfSoA.reduce((sum, v) => sum + v, 0) / firstHalfSoA.length;
              const secondAvg = secondHalfSoA.reduce((sum, v) => sum + v, 0) / secondHalfSoA.length;
              const delta = secondAvg - firstAvg;
              
              if (Math.abs(delta) >= 1) {
                trend = {
                  direction: delta > 0 ? 'up' : 'down',
                  delta: Math.round(delta)
                };
              }
            }
          }
        }
        
        resultMap.set(normalizedTopicName, {
          avgSoA,
          avgVisibility,
          avgSentiment,
          trend,
          brandCount: data.brandIds.size,
          competitorSoA,
          competitorVisibility,
          competitorSentiment,
        });
      });
      
      console.log(`📊 Calculated competitor averages for ${resultMap.size} topics (${result.duration_ms}ms)`);
      
      return resultMap;
    } catch (error) {
      console.error('❌ Error in getCompetitorAveragesOptimized:', error);
      return new Map();
    }
  }

  /**
   * Get top citation sources per topic
   * @param positions - Pre-filtered positions (already filtered by collector_type if specified)
   */
  private async getTopSourcesPerTopic(
    brandId: string,
    customerId: string,
    topicMap: Map<string, any>,
    startIso: string,
    endIso: string,
    positions: any[] // Pass already-filtered positions to ensure citations are also filtered by collector_type
  ): Promise<Map<string, Array<{ name: string; url: string; type: string; citations: number }>>> {
    const funcStart = performance.now();
    try {
      // Get set of normalized topic names we care about
      const validTopicNames = new Set(Array.from(topicMap.keys()));

      // Get collector_result_ids from filtered positions (already filtered by collector_type)
      const collectorResultIds = Array.from(new Set(
        positions.map(p => p.collector_result_id).filter((id): id is number => typeof id === 'number')
      ));

      if (collectorResultIds.length === 0) {
        return new Map(); // No collector results to fetch citations for
      }

      // Fetch citations ONLY for the filtered collector_result_ids
      // This ensures citations are also filtered by collector_type
      const citationsQueryStart = performance.now();
      const { data: citations, error: citationsError } = await supabaseAdmin
        .from('citations')
        .select(`
          domain,
          url,
          category,
          collector_result_id,
          usage_count
        `)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .in('collector_result_id', collectorResultIds); // Filter by collector_result_ids (already filtered by collector_type)
      const citationsQueryTime = performance.now() - citationsQueryStart;

      if (citationsError) {
        console.error(`⚠️ Error fetching citations for topics [${citationsQueryTime.toFixed(2)}ms]:`, citationsError);
        return new Map(); // Return empty map on error
      }

      if (!citations || citations.length === 0) {
        return new Map(); // No citations found
      }

      // Create collector_result_id to topic name map
      const collectorResultToTopicMap = new Map<number, string>();
      
      (positions || []).forEach(pos => {
        let topicName: string | null = null;
        
        // Priority: 1) extracted_positions.topic column, 2) metadata.topic_name
        if (pos.topic && typeof pos.topic === 'string' && pos.topic.trim().length > 0) {
          topicName = pos.topic.trim();
        } else if (pos.metadata && typeof pos.metadata === 'object') {
          const metadata = pos.metadata as any;
          if (metadata.topic_name && typeof metadata.topic_name === 'string') {
            topicName = metadata.topic_name.trim();
          }
        }
        
        if (topicName && pos.collector_result_id) {
          const normalizedTopicName = topicName.toLowerCase().trim();
          // Only map if this topic exists in our valid topics
          if (validTopicNames.has(normalizedTopicName)) {
            collectorResultToTopicMap.set(pos.collector_result_id, normalizedTopicName);
          }
        }
      });

      // Group citations by topic and domain
      const topicSourcesMap = new Map<string, Map<string, { name: string; url: string; type: string; citations: number }>>();

      citations.forEach(citation => {
        const collectorResultId = citation.collector_result_id;
        if (!collectorResultId) return;

        const normalizedTopicName = collectorResultToTopicMap.get(collectorResultId);
        if (!normalizedTopicName) return; // Skip if no topic mapping

        const domain = citation.domain || 'unknown';
        const url = citation.url || `https://${domain}`;
        const category = citation.category || 'editorial';
        const usageCount = citation.usage_count || 1;

        // Get source type
        const sourceType = this.getSourceTypeFromCategory(category, domain);

        // Initialize topic map if needed
        if (!topicSourcesMap.has(normalizedTopicName)) {
          topicSourcesMap.set(normalizedTopicName, new Map());
        }

        const domainMap = topicSourcesMap.get(normalizedTopicName)!;
        
        if (domainMap.has(domain)) {
          // Aggregate citations count
          const existing = domainMap.get(domain)!;
          existing.citations += usageCount;
        } else {
          // New domain for this topic
          domainMap.set(domain, {
            name: domain,
            url: url,
            type: sourceType,
            citations: usageCount
          });
        }
      });

      // Convert to final format: top 3 sources per topic, sorted by citations
      const processingStart = performance.now();
      const result = new Map<string, Array<{ name: string; url: string; type: string; citations: number }>>();

      topicSourcesMap.forEach((domainMap, topicName) => {
        const sources = Array.from(domainMap.values())
          .sort((a, b) => b.citations - a.citations)
          .slice(0, 3); // Top 3 sources
        result.set(topicName, sources);
      });

      const processingTime = performance.now() - processingStart;
      const funcTime = performance.now() - funcStart;
      console.log(`📊 getTopSourcesPerTopic: processed ${citations.length} citations into ${result.size} topics [query: ${citationsQueryTime.toFixed(2)}ms, processing: ${processingTime.toFixed(2)}ms, total: ${funcTime.toFixed(2)}ms]`);
      return result;
    } catch (error) {
      const funcTime = performance.now() - funcStart;
      console.error(`⚠️ Error in getTopSourcesPerTopic [${funcTime.toFixed(2)}ms]:`, error);
      return new Map();
    }
  }

  /**
   * Get source type from category and domain
   */
  private getSourceTypeFromCategory(category: string | null, domain: string | null): string {
    if (!category) {
      // Infer from domain
      if (domain) {
        const lowerDomain = domain.toLowerCase();
        if (lowerDomain.includes('wikipedia') || lowerDomain.includes('britannica') || lowerDomain.includes('dictionary')) {
          return 'reference';
        }
        if (lowerDomain.includes('edu') || lowerDomain.includes('gov')) {
          return 'institutional';
        }
        if (lowerDomain.includes('reddit') || lowerDomain.includes('twitter') || lowerDomain.includes('medium') || lowerDomain.includes('github')) {
          return 'ugc';
        }
      }
      return 'editorial';
    }
    
    const normalizedCategory = category.toLowerCase().trim();
    const mapping: Record<string, string> = {
      'brand': 'brand',
      'corporate': 'corporate',
      'editorial': 'editorial',
      'reference': 'reference',
      'ugc': 'ugc',
      'user-generated': 'ugc',
      'institutional': 'institutional',
      'other': 'editorial'
    };
    
    return mapping[normalizedCategory] || 'editorial';
  }

  /**
   * Map intent to category
   */
  private mapIntentToCategory(intent: string): string {
    const mapping: Record<string, string> = {
      'awareness': 'awareness',
      'comparison': 'comparison',
      'purchase': 'purchase',
      'support': 'support'
    };
    return mapping[intent?.toLowerCase()] || 'uncategorized';
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
      const geminiApiKey = process.env['GOOGLE_GEMINI_API_KEY'];
      const geminiModel = process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-1.5-flash-002';
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
          console.log('🔄 Cerebras failed, trying Gemini as fallback...');
        }
      } else {
        console.log('⚠️ Cerebras API key not configured, trying Gemini...');
      }
      
      // Try Gemini as secondary fallback
      if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
        console.log('🤖 Using Gemini as secondary provider');
        try {
          await this.categorizeWithGemini(brandId, topics, geminiApiKey, geminiModel);
          console.log('✅ Gemini categorization completed successfully');
          return;
        } catch (error) {
          console.error('❌ Gemini failed:', error);
          console.log('🔄 Gemini failed, trying OpenAI as fallback...');
        }
      } else {
        console.log('⚠️ Gemini API key not configured, trying OpenAI...');
      }
      
      // Try OpenAI as tertiary fallback
      if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
        console.log('🤖 Using OpenAI as tertiary fallback provider');
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
   * Categorize topics using Gemini
   */
  private async categorizeWithGemini(brandId: string, topics: string[], apiKey: string, model: string): Promise<void> {
    console.log(`🤖 Categorizing topics with Gemini (${model})`);
    
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

Only use these exact category names: awareness, comparison, purchase, post-purchase support

CRITICAL: Return ONLY valid JSON. Do NOT include any text, comments, explanations, or markdown after the JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are an expert in brand marketing and customer journey analysis. Always respond with valid JSON only.\n\n${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!content) {
      throw new Error('Empty response from Gemini API');
    }

    // Parse AI response with robust JSON extraction
    let categorization: Record<string, string>;
    try {
      // Try direct parse first
      categorization = JSON.parse(content);
    } catch (firstError) {
      // Try extracting JSON using brace matching
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const firstBrace = jsonMatch[0].indexOf('{');
        if (firstBrace !== -1) {
          let braceCount = 0;
          let lastBrace = -1;
          for (let i = firstBrace; i < jsonMatch[0].length; i++) {
            if (jsonMatch[0][i] === '{') {
              braceCount++;
            } else if (jsonMatch[0][i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastBrace = i;
                break;
              }
            }
          }
          if (lastBrace !== -1) {
            const jsonString = jsonMatch[0].slice(firstBrace, lastBrace + 1);
            categorization = JSON.parse(jsonString);
          } else {
            throw new Error('No matching closing brace found');
          }
        } else {
          throw new Error('No opening brace found');
        }
      } else {
        throw new Error('No JSON object found in response');
      }
    }

    console.log('🤖 Gemini categorization result:', categorization);
    await this.updateTopicsWithCategories(brandId, categorization);
  }

  /**
   * Categorize topics using OpenAI (tertiary fallback)
   */
  private async categorizeWithOpenAI(brandId: string, topics: string[], apiKey: string): Promise<void> {
    console.log(`🤖 Categorizing topics with OpenAI (fallback)`);
    
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

Only use these exact category names: awareness, comparison, purchase, post-purchase support

CRITICAL: Return ONLY valid JSON. Do NOT include any text, comments, explanations, or markdown after the JSON.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.choices[0]?.message?.content?.trim() || '';
    
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    // Parse AI response with robust JSON extraction
    let categorization: Record<string, string>;
    try {
      // Try direct parse first
      categorization = JSON.parse(content);
    } catch (firstError) {
      // Try extracting JSON using brace matching
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const firstBrace = jsonMatch[0].indexOf('{');
        if (firstBrace !== -1) {
          let braceCount = 0;
          let lastBrace = -1;
          for (let i = firstBrace; i < jsonMatch[0].length; i++) {
            if (jsonMatch[0][i] === '{') {
              braceCount++;
            } else if (jsonMatch[0][i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                lastBrace = i;
                break;
              }
            }
          }
          if (lastBrace !== -1) {
            const jsonString = jsonMatch[0].slice(firstBrace, lastBrace + 1);
            categorization = JSON.parse(jsonString);
          } else {
            throw new Error('No matching closing brace found');
          }
        } else {
          throw new Error('No opening brace found');
        }
      } else {
        throw new Error('No JSON object found in response');
      }
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

  /**
   * Map frontend AI model names to backend collector names
   */
  private mapAIModelsToCollectors(aiModels: string[]): string[] {
    if (!aiModels || aiModels.length === 0) {
      // Default to common collectors if none selected
      return ['chatgpt', 'google_aio', 'perplexity', 'claude'];
    }

    const modelToCollectorMap: Record<string, string> = {
      'chatgpt': 'chatgpt',
      'openai': 'chatgpt',
      'gpt-4': 'chatgpt',
      'gpt-3.5': 'chatgpt',
      'google_aio': 'google_aio',
      'google-ai': 'google_aio',
      'google': 'google_aio',
      'perplexity': 'perplexity',
      'claude': 'claude',
      'anthropic': 'claude',
      'deepseek': 'deepseek',
      'baidu': 'baidu',
      'bing': 'bing',
      'bing_copilot': 'bing_copilot',
      'copilot': 'bing_copilot',
      'microsoft-copilot': 'bing_copilot',
      'gemini': 'gemini',
      'google-gemini': 'gemini',
      'grok': 'grok',
      'x-ai': 'grok',
      'mistral': 'mistral'
    };

    const collectors = aiModels
      .map(model => {
        const normalizedModel = model.toLowerCase().trim();
        return modelToCollectorMap[normalizedModel] || null;
      })
      .filter((collector): collector is string => collector !== null);

    // Remove duplicates
    return [...new Set(collectors)];
  }

  /**
   * Store data collection metrics in database
   */
  private async storeDataCollectionMetrics(
    brandId: string,
    customerId: string,
    metrics: {
      totalQueries: number;
      totalExecutions: number;
      successCount: number;
      failedCount: number;
      failuresByCollector: Record<string, number>;
      errorsByType: Record<string, number>;
      executionIds: string[];
    },
    durationMs: number
  ): Promise<void> {
    try {
      // Store metrics in brand metadata or create a metrics record
      // For now, we'll update the brand metadata with latest collection stats
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('metadata')
        .eq('id', brandId)
        .single();

      if (brand) {
        const metadata = brand.metadata || {};
        const collectionStats = {
          lastCollection: new Date().toISOString(),
          lastCollectionDurationMs: durationMs,
          totalQueries: metrics.totalQueries,
          totalExecutions: metrics.totalExecutions,
          successCount: metrics.successCount,
          failedCount: metrics.failedCount,
          successRate: metrics.totalExecutions > 0 
            ? Math.round((metrics.successCount / metrics.totalExecutions) * 100) 
            : 0,
          failuresByCollector: metrics.failuresByCollector,
          errorsByType: metrics.errorsByType
        };

        // Update metadata with collection stats
        await supabaseAdmin
          .from('brands')
          .update({
            metadata: {
              ...metadata,
              data_collection_stats: collectionStats,
              data_collection_execution_ids: metrics.executionIds
            }
          })
          .eq('id', brandId);

        console.log(`✅ Stored data collection metrics for brand ${brandId}`);
      }
    } catch (error) {
      console.error('❌ Failed to store data collection metrics:', error);
      throw error;
    }
  }

  /**
   * Log data collection error to database
   */
  private async logDataCollectionError(
    brandId: string,
    customerId: string,
    error: any,
    context: {
      brandId: string;
      customerId: string;
      queryCount: number;
      collectors: string[];
      durationMs: number;
      timestamp: string;
    }
  ): Promise<void> {
    try {
      const errorData = {
        brand_id: brandId,
        customer_id: customerId,
        error_type: 'data_collection_trigger_failure',
        error_message: error?.message || String(error),
        error_stack: error?.stack || null,
        error_metadata: {
          context: context,
          error_name: error?.name,
          error_code: error?.code,
          error_status: error?.status || error?.statusCode,
          timestamp: context.timestamp
        },
        created_at: new Date().toISOString()
      };

      // Store error in brand metadata
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('metadata')
        .eq('id', brandId)
        .single();

      if (brand) {
        const metadata = brand.metadata || {};
        const existingErrors = Array.isArray(metadata.data_collection_errors) 
          ? metadata.data_collection_errors 
          : [];
        
        // Keep only last 10 errors to avoid metadata bloat
        const updatedErrors = [...existingErrors, errorData].slice(-10);

        const { error: insertError } = await supabaseAdmin
          .from('brands')
          .update({
            metadata: {
              ...metadata,
              data_collection_errors: updatedErrors
            }
          })
          .eq('id', brandId);

        if (insertError) {
          // Fallback: just log to console if database insert fails
          console.warn('⚠️ Could not log error to database:', insertError);
        } else {
          console.log(`✅ Logged data collection error for brand ${brandId}`);
        }
      }
    } catch (logError) {
      console.error('❌ Failed to log data collection error:', logError);
      // Don't throw - logging failures shouldn't break the flow
    }
  }

  /**
   * Verify and filter competitors with enhanced validation
   * Includes name validation, domain validation, and optional HTTP checks
   */
  private async verifyCompetitors(
    competitors: NormalizedCompetitor[],
    brandName: string
  ): Promise<NormalizedCompetitor[]> {
    const normalizedBrandName = brandName.toLowerCase().trim();
    const verified: NormalizedCompetitor[] = [];
    const enableHttpChecks = process.env['COMPETITOR_VERIFY_HTTP'] === 'true';
    
    console.log(`🔍 Verifying ${competitors.length} competitors for brand "${brandName}"...`);
    
    for (const competitor of competitors) {
      try {
        // Basic name validation
        if (!competitor.name || competitor.name.trim().length < 2) {
          console.log(`🚫 Filtered competitor: Empty or too short name: "${competitor.name}"`);
          continue;
        }

        const competitorNameLower = competitor.name.toLowerCase().trim();
        
        // Remove if competitor is the same as the brand (case-insensitive)
        if (competitorNameLower === normalizedBrandName) {
          console.log(`🚫 Filtered competitor: "${competitor.name}" is the same as brand "${brandName}"`);
          continue;
        }

        // Remove if name is just generic terms
        const genericTerms = ['company', 'inc', 'ltd', 'corp', 'corporation', 'llc', 'brand', 'business', 'competitor'];
        if (genericTerms.some(term => competitorNameLower === term || competitorNameLower === `${term}.`)) {
          console.log(`🚫 Filtered competitor: "${competitor.name}" is too generic`);
          continue;
        }

        // Domain validation if domain is provided
        if (competitor.domain) {
          const domainValidation = this.validateDomain(competitor.domain);
          if (!domainValidation.valid) {
            console.log(`🚫 Filtered competitor: "${competitor.name}" has invalid domain "${competitor.domain}": ${domainValidation.reason}`);
            continue;
          }
        }

        // Optional HTTP check (disabled by default to avoid blocking brand creation)
        let verificationStatus: 'verified' | 'unverified' | 'failed' = 'unverified';
        if (enableHttpChecks && competitor.url) {
          try {
            const isReachable = await this.checkUrlReachability(competitor.url);
            verificationStatus = isReachable ? 'verified' : 'failed';
            
            if (!isReachable) {
              console.warn(`⚠️ Competitor "${competitor.name}" URL "${competitor.url}" is not reachable`);
            } else {
              console.log(`✅ Competitor "${competitor.name}" URL "${competitor.url}" is reachable`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to check reachability for "${competitor.name}":`, error);
            verificationStatus = 'failed';
          }
        }

        // Add verification metadata to competitor
        const verifiedCompetitor: NormalizedCompetitor = {
          ...competitor,
          source: competitor.source || 'onboarding'
        };

        // Store verification status in metadata if we had HTTP checks
        if (enableHttpChecks) {
          (verifiedCompetitor as any).verification_status = verificationStatus;
        }

        verified.push(verifiedCompetitor);
      } catch (error) {
        console.warn(`⚠️ Failed to verify competitor "${competitor.name}":`, error);
        // Continue with other competitors even if one fails
      }
    }

    const filteredCount = competitors.length - verified.length;
    if (filteredCount > 0) {
      console.log(`✅ Verified ${verified.length}/${competitors.length} competitors (filtered ${filteredCount})`);
    } else {
      console.log(`✅ All ${verified.length} competitors passed verification`);
    }

    return verified;
  }

  /**
   * Save user-selected queries directly to database
   */
  /**
   * Store topics and queries from the new topics+queries generation service
   */
  private async storeTopicsAndQueriesFromNewService(
    brandId: string,
    customerId: string,
    topicsAndQueries: TopicsAndQueriesResponse,
    brandName: string
  ): Promise<void> {
    console.log(`💾 Storing ${topicsAndQueries.topics.length} topics with queries from new service...`);

    try {
      // Step 1: Insert topics into brand_topics table
      const topicRecords = topicsAndQueries.topics.map((item) => {
        // Map intent archetype to existing category system
        const category = topicsQueryGenerationService.mapIntentToCategory(item.intentArchetype);
        
        return {
          brand_id: brandId,
          topic_name: item.topic,
          category: category,
          description: item.description,
          // Store intent archetype in metadata if needed
          metadata: {
            intentArchetype: item.intentArchetype,
            priority: item.priority,
            primaryDomain: topicsAndQueries.primaryDomain,
          },
        };
      });

      const { error: topicError } = await supabaseAdmin
        .from('brand_topics')
        .insert(topicRecords);

      if (topicError) {
        console.error('⚠️ Failed to insert topics:', topicError);
        throw topicError;
      }

      console.log(`✅ Inserted ${topicRecords.length} topics`);

      // Step 2: Generate and insert queries for the topics
      // Note: The new topics service only generates topics, not queries
      // Queries will be generated separately using the query generation service
      const topicNames = topicsAndQueries.topics.map(item => item.topic);
      
      // Generate queries for the created topics
      const queryGenResult = await queryGenerationService.generateSeedQueries({
        url: '', // Not needed for topic-based generation
        locale: 'en-US',
        country: 'US',
        industry: '', // Will use topics instead
        competitors: '',
        topics: topicNames,
        llm_provider: 'openai',
      });

      if (queryGenResult && queryGenResult.total_queries > 0) {
        console.log(`✅ Generated ${queryGenResult.total_queries} queries for topics`);
      } else {
        console.warn('⚠️ No queries were generated for the topics');
      }
    } catch (error) {
      console.error('❌ Failed to store topics and queries:', error);
      throw error;
    }
  }

  /**
   * Map intent archetype to existing intent system
   */
  private mapIntentArchetypeToIntent(intentArchetype: string): 'awareness' | 'comparison' | 'purchase' | 'support' {
    const mapping: Record<string, 'awareness' | 'comparison' | 'purchase' | 'support'> = {
      'best_of': 'awareness',
      'comparison': 'comparison',
      'alternatives': 'comparison',
      'pricing_or_value': 'purchase',
      'use_case': 'awareness',
      'how_to': 'awareness',
      'problem_solving': 'support',
      'beginner_explain': 'awareness',
      'expert_explain': 'awareness',
      'technical_deep_dive': 'awareness',
    };

    return mapping[intentArchetype] || 'awareness';
  }

  private async saveUserSelectedQueries(
    brandId: string,
    customerId: string,
    prompts: string[] | Array<{ prompt: string; topic: string }>,
    topics: string[],
    brandName: string,
    hasTopicInfo: boolean = false
  ): Promise<void> {
    const { v4: uuidv4 } = require('uuid');
    const generationId = uuidv4();
    
    // Create query generation record
    const { error: genError } = await supabaseAdmin
      .from('query_generations')
      .insert({
        id: generationId,
        brand_id: brandId,
        customer_id: customerId,
        total_queries: prompts.length,
        locale: 'en-US',
        country: 'US',
        strategy: 'user_selected',
        queries_by_intent: {},
        processing_time_seconds: 0,
        metadata: {
          provider: 'user_selected',
          brand_name: brandName,
          source: 'onboarding'
        }
      });

    if (genError) {
      throw new Error(`Failed to create query generation record: ${genError.message}`);
    }

    // Map prompts to topics
    const queryInserts = prompts.map((promptData, index) => {
      let promptText: string;
      let matchedTopic: string;
      
      if (hasTopicInfo && typeof promptData === 'object' && 'prompt' in promptData) {
        // New format: prompts include topic information
        promptText = promptData.prompt;
        matchedTopic = promptData.topic || topics[0] || 'General';
      } else {
        // Legacy format: just prompt strings, need to match to topics
        promptText = typeof promptData === 'string' ? promptData : (promptData as any).prompt || '';
        // Try to find matching topic by checking if prompt contains topic name
        matchedTopic = topics.find(topic => 
          promptText.toLowerCase().includes(topic.toLowerCase())
        ) || topics[0] || 'General'; // Fallback to first topic or 'General'
      }
      
      return {
        generation_id: generationId,
        brand_id: brandId,
        customer_id: customerId,
        query_text: promptText,
        topic: matchedTopic, // Store topic in dedicated column
        intent: 'data_collection', // Default intent
        brand: brandName,
        template_id: `user-selected-${index}`,
        evidence_snippet: `User-selected query`,
        evidence_source: 'user_onboarding',
        locale: 'en-US',
        country: 'US',
        is_active: true,
        metadata: {
          topic: matchedTopic,
          topic_name: matchedTopic,
          priority: 1,
          index,
          provider: 'user_selected',
          brand_name: brandName
        }
      };
    });

    const { error: queriesError } = await supabaseAdmin
      .from('generated_queries')
      .insert(queryInserts);

    if (queriesError) {
      throw new Error(`Failed to save user-selected queries: ${queriesError.message}`);
    }

    console.log(`✅ Saved ${queryInserts.length} user-selected queries to database`);
  }

  /**
   * Validate domain format
   */
  private validateDomain(domain: string): { valid: boolean; reason?: string } {
    if (!domain || domain.trim().length === 0) {
      return { valid: false, reason: 'Empty domain' };
    }

    // Basic domain format validation
    const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    
    // Remove protocol and path if present
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase()
      .trim();

    if (!domainRegex.test(cleanDomain)) {
      return { valid: false, reason: 'Invalid domain format' };
    }

    // Check for minimum length
    if (cleanDomain.length < 4) {
      return { valid: false, reason: 'Domain too short' };
    }

    // Check for maximum length
    if (cleanDomain.length > 253) {
      return { valid: false, reason: 'Domain too long' };
    }

    return { valid: true };
  }

  /**
   * Check if URL is reachable (optional, with timeout)
   */
  private async checkUrlReachability(url: string, timeoutMs: number = 5000): Promise<boolean> {
    try {
      // Ensure URL has protocol
      const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(urlWithProtocol, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow'
      });

      clearTimeout(timeoutId);

      // Consider 2xx and 3xx as reachable
      return response.status >= 200 && response.status < 400;
    } catch (error) {
      // Network errors, timeouts, etc. mean not reachable
      return false;
    }
  }
}

export const brandService = new BrandService();
