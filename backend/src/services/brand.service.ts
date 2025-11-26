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
                .select('id, query_text, intent')
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
                  country: 'US',
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

      return brands || [];
    } catch (error) {
      console.error('Error fetching brands:', error);
      if (error instanceof DatabaseError || error instanceof ValidationError) {
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
   * Get brand topics WITH analytics data - ONLY topics that have collector_results
   * Queries from generated_queries table (topics that actually have query execution data)
   * Filters by collector_type (model), country, and date range
   */
  async getBrandTopicsWithAnalytics(
    brandId: string,
    customerId: string,
    startDate?: string,
    endDate?: string,
    collectorType?: string,
    country?: string
  ): Promise<{ topics: any[]; availableModels: string[] }> {
    try {
      console.log(`🎯 Fetching topics WITH analytics (only topics with collector_results) for brand ${brandId}`);
      
      // Set default date range (last 30 days)
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      
      console.log(`📅 Date range: ${startIso} to ${endIso}`);
      
      // Step 1: Try to get queries from generated_queries (optional - topics might be in metadata only)
      let queries: any[] = [];
      let queryToTopicMap = new Map<string, { topic: string; intent: string }>();
      
      try {
        const { data: queriesData, error: queriesError } = await supabaseAdmin
          .from('generated_queries')
          .select('id, topic, intent')
          .eq('brand_id', brandId)
          .eq('customer_id', customerId)
          .not('topic', 'is', null);
        
        if (queriesError) {
          console.warn('⚠️ Warning: Could not fetch queries (will use metadata only):', queriesError.message);
          // Continue - we can still get topics from metadata
        } else if (queriesData) {
          queries = queriesData;
          queries.forEach(q => {
            if (q.topic) {
              queryToTopicMap.set(q.id, { topic: q.topic.trim(), intent: q.intent || 'awareness' });
            }
          });
          console.log(`📋 Found ${queries.length} queries in generated_queries`);
        }
      } catch (error) {
        console.warn('⚠️ Warning: Error fetching queries, continuing with metadata extraction:', error);
        // Continue - we can still get topics from metadata
      }
      
      // Step 2: Get collector_results (optional - we can query positions directly)
      let collectorResults: any[] = [];
      let crToQueryMap = new Map<string, string>();
      
      if (queries.length > 0) {
        try {
          const queryIds = queries.map(q => q.id);
          const { data: crData, error: crError } = await supabaseAdmin
            .from('collector_results')
            .select('id, query_id')
            .in('query_id', queryIds);
          
          if (crError) {
            console.warn('⚠️ Warning: Could not fetch collector_results (will query positions directly):', crError.message);
          } else if (crData) {
            collectorResults = crData;
            collectorResults.forEach(cr => {
              crToQueryMap.set(cr.id, cr.query_id);
            });
            console.log(`📋 Found ${collectorResults.length} collector_results`);
          }
        } catch (error) {
          console.warn('⚠️ Warning: Error fetching collector_results, continuing with direct position query:', error);
        }
      }
      
      // Step 3: Get extracted_positions for this brand
      // Include topic column and metadata to extract topic_name from there, and collector_type for filtering
      // If we have collector_result_ids, filter by them; otherwise get all positions for this brand
      let positions: any[] = [];
      let positionsQuery = supabaseAdmin
        .from('extracted_positions')
        .select('share_of_answers_brand, sentiment_score, visibility_index, has_brand_presence, processed_at, collector_result_id, topic, metadata, collector_type')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('processed_at', startIso)
        .lte('processed_at', endIso);
      
      // Filter by collector_type (model) if provided and not empty
      if (collectorType && collectorType.trim() !== '') {
        // Map frontend model IDs to collector_type values
        const collectorTypeMap: Record<string, string> = {
          'chatgpt': 'chatgpt',
          'claude': 'claude',
          'gemini': 'gemini',
          'perplexity': 'perplexity',
          'copilot': 'copilot',
          'deepseek': 'deepseek',
          'mistral': 'mistral',
          'grok': 'grok'
        };
        const mappedType = collectorTypeMap[collectorType.toLowerCase()] || collectorType;
        positionsQuery = positionsQuery.eq('collector_type', mappedType);
        console.log(`🔍 Filtering by collector_type: ${mappedType}`);
      }
      
      if (collectorResults.length > 0) {
        const collectorResultIds = collectorResults.map(cr => cr.id);
        const { data: posData, error: positionsError } = await positionsQuery
          .in('collector_result_id', collectorResultIds);
        
        if (positionsError) {
          console.error('❌ Error fetching extracted_positions:', positionsError);
          throw new DatabaseError('Failed to fetch positions');
        }
        positions = posData || [];
      } else {
        // If no collector_results, get positions directly by brand_id
        console.log('⚠️ No collector_results found, querying positions directly by brand_id');
        const { data: posData, error: positionsError } = await positionsQuery;
        
        if (positionsError) {
          console.error('❌ Error fetching extracted_positions:', positionsError);
          throw new DatabaseError('Failed to fetch positions');
        }
        positions = posData || [];
      }
      
      if (!positions || positions.length === 0) {
        console.log('⚠️ No extracted_positions found for these collector_results in date range');
        return { topics: [], availableModels: [] };
      }
      
      // Get distinct collector_types (models) available for this brand in the date range
      const { data: distinctCollectors } = await supabaseAdmin
        .from('extracted_positions')
        .select('collector_type')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('processed_at', startIso)
        .lte('processed_at', endIso)
        .not('collector_type', 'is', null);
      
      const availableModels = new Set<string>();
      if (distinctCollectors) {
        distinctCollectors.forEach((pos: any) => {
          if (pos.collector_type) {
            availableModels.add(pos.collector_type.toLowerCase());
          }
        });
      }
      
      // Step 4: Group analytics by topic (distinct topics only, not by collector_type)
      // Priority: 1) metadata.topic_name, 2) generated_queries.topic
      const topicMap = new Map<string, {
        topicName: string;
        intent: string;
        analytics: Array<{
          share_of_answers_brand: number;
          sentiment_score: number | null;
          visibility_index: number | null;
          has_brand_presence: boolean;
          processed_at: string;
          collector_type?: string;
        }>;
        collectorTypes: Set<string>; // Track which models have data for this topic
      }>();
      
      // Group positions by topic - extract from metadata.topic_name first, fallback to generated_queries.topic
      let metadataTopicsCount = 0;
      let queryTopicsCount = 0;
      let noTopicCount = 0;
      
      (positions || []).forEach(pos => {
        let topicName: string | null = null;
        let intent = 'awareness';
        let topicSource = 'none';
        
        // Priority: 1) extracted_positions.topic column, 2) metadata.topic_name, 3) generated_queries.topic
        if (pos.topic && typeof pos.topic === 'string' && pos.topic.trim().length > 0) {
          topicName = pos.topic.trim();
          topicSource = 'extracted_positions_column';
        } else if (pos.metadata && typeof pos.metadata === 'object') {
          const metadata = pos.metadata as any;
          if (metadata.topic_name && typeof metadata.topic_name === 'string') {
            topicName = metadata.topic_name.trim();
            topicSource = 'metadata';
            metadataTopicsCount++;
          }
        }
        
        // Fallback to generated_queries.topic if not in extracted_positions
        if (!topicName) {
          const queryId = crToQueryMap.get(pos.collector_result_id);
          if (queryId) {
            const topicData = queryToTopicMap.get(queryId);
            if (topicData && topicData.topic) {
              topicName = topicData.topic;
              intent = topicData.intent;
              topicSource = 'generated_queries';
              queryTopicsCount++;
            }
          }
        }
        
        // Skip if no topic found
        if (!topicName) {
          noTopicCount++;
          return;
        }
        
        // Group by topic name only (not by collector_type) to get distinct topics
        const normalizedTopicName = topicName.toLowerCase().trim();
        const collectorType = pos.collector_type || 'unknown';
        
        if (!topicMap.has(normalizedTopicName)) {
          topicMap.set(normalizedTopicName, {
            topicName, // Keep original casing
            intent,
            analytics: [],
            collectorTypes: new Set<string>()
          });
        }
        
        const topicData = topicMap.get(normalizedTopicName)!;
        topicData.analytics.push({
          share_of_answers_brand: pos.share_of_answers_brand || 0,
          sentiment_score: pos.sentiment_score,
          visibility_index: pos.visibility_index,
          has_brand_presence: pos.has_brand_presence || false,
          processed_at: pos.processed_at,
          collector_type: collectorType
        });
        topicData.collectorTypes.add(collectorType.toLowerCase());
      });
      
      console.log(`📊 Topic extraction summary:`);
      console.log(`   - Topics from metadata: ${metadataTopicsCount}`);
      console.log(`   - Topics from generated_queries: ${queryTopicsCount}`);
      console.log(`   - Positions without topic: ${noTopicCount}`);
      console.log(`   - Distinct topics found: ${topicMap.size}`);
      
      if (topicMap.size === 0) {
        console.log('⚠️ No topics found with analytics data. Checking metadata format...');
        // Debug: Check first position's metadata
        if (positions && positions.length > 0 && positions[0].metadata) {
          console.log('   Sample metadata:', JSON.stringify(positions[0].metadata, null, 2));
        }
      }
      
      // Step 3: Get topic metadata from brand_topics (if exists) for category/priority
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
      
      // Step 5: Calculate metrics for each distinct topic (aggregate across all collector_types)
      const topicsWithAnalytics = Array.from(topicMap.entries()).map(([normalizedTopicName, data]) => {
        const analytics = data.analytics;
        
        if (analytics.length === 0) {
          return null; // Skip topics with no analytics in date range
        }
        
        // Calculate metrics
        const soaValues = analytics
          .map(a => a.share_of_answers_brand)
          .filter((v: any) => typeof v === 'number' && isFinite(v) && v !== null);
        
        const sentimentValues = analytics
          .map(a => a.sentiment_score)
          .filter((v: any) => typeof v === 'number' && isFinite(v) && v !== null);
        
        const visibilityValues = analytics
          .map(a => a.visibility_index)
          .filter((v: any) => typeof v === 'number' && isFinite(v) && v !== null);
        
        const brandPresenceCount = analytics.filter(a => a.has_brand_presence).length;
        const totalQueries = analytics.length;
        
        const avgShareOfAnswer = soaValues.length > 0
          ? soaValues.reduce((sum: number, v: number) => sum + v, 0) / soaValues.length
          : 0;
        
        const avgSentiment = sentimentValues.length > 0
          ? sentimentValues.reduce((sum: number, v: number) => sum + v, 0) / sentimentValues.length
          : null;
        
        const avgVisibility = visibilityValues.length > 0
          ? visibilityValues.reduce((sum: number, v: number) => sum + v, 0) / visibilityValues.length
          : null;
        
        const brandPresencePercentage = totalQueries > 0
          ? (brandPresenceCount / totalQueries) * 100
          : null;
        
        // Get metadata from brand_topics if available
        const brandTopicMeta = brandTopicsMap.get(normalizedTopicName);
        
        return {
          id: brandTopicMeta?.id || `topic-${data.topicName.replace(/\s+/g, '-').toLowerCase()}`,
          topic_name: data.topicName,
          topic: data.topicName,
          category: brandTopicMeta?.category || this.mapIntentToCategory(data.intent) || 'uncategorized',
          priority: brandTopicMeta?.priority || 999,
          description: brandTopicMeta?.description || null,
          is_active: true,
          created_at: brandTopicMeta?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Analytics (aggregated across all collector_types)
          avgShareOfAnswer: Number(avgShareOfAnswer.toFixed(2)),
          avgSentiment: avgSentiment !== null ? Number(avgSentiment.toFixed(2)) : null,
          avgVisibility: avgVisibility !== null ? Number(avgVisibility.toFixed(0)) : null,
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
      
      // Return topics with available models metadata
      const response = {
        topics: topicsWithAnalytics,
        availableModels: Array.from(availableModels)
      };
      
      console.log(`✅ Returned ${topicsWithAnalytics.length} distinct topics with analytics data`);
      console.log(`📊 Available models: ${Array.from(availableModels).join(', ')}`);
      return response;
      
    } catch (error) {
      console.error('❌ Error in getBrandTopicsWithAnalytics:', error);
      throw error;
    }
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

      // Step 2: Insert queries into generated_queries table
      const queryRecords = topicsAndQueries.topics.map((item, index) => {
        // Map intent archetype to existing intent system
        const intent = this.mapIntentArchetypeToIntent(item.intentArchetype);
        
        return {
          brand_id: brandId,
          customer_id: customerId,
          query_text: item.query,
          topic: item.topic,
          intent: intent,
          priority: item.priority,
          is_active: true,
          metadata: {
            intentArchetype: item.intentArchetype,
            generatedBy: 'new-topics-query-service',
          },
        };
      });

      const { error: queryError } = await supabaseAdmin
        .from('generated_queries')
        .insert(queryRecords);

      if (queryError) {
        console.error('⚠️ Failed to insert queries:', queryError);
        throw queryError;
      }

      console.log(`✅ Inserted ${queryRecords.length} queries`);
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
