import { describe, expect, it, jest, beforeEach } from '@jest/globals'

jest.mock('../../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}))

import { supabaseAdmin } from '../../../config/database'
import { promptCrudService } from '../prompt-crud.service'

const mockFrom = supabaseAdmin.from as unknown as jest.Mock

describe('PromptCrudService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getConfigV2Rows', () => {
    it('should return rows with versions', async () => {
      mockFrom.mockImplementation((table: any) => {
        if (table === 'generated_queries') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    order: jest.fn<any>().mockResolvedValue({
                      data: [
                        { id: '1', topic: 'Topic A', query_text: 'Prompt 1', locale: 'en', country: 'US' },
                        { id: '2', topic: 'Topic B', query_text: 'Prompt 2', locale: 'en', country: 'US' }
                      ],
                      error: null
                    })
                  })
                })
              })
            })
          }
        }
        if (table === 'brand_topics') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn<any>().mockResolvedValue({
                data: [
                  { topic_name: 'Topic A', version: 2 },
                  { topic_name: 'Topic B', version: 1 }
                ],
                error: null
              })
            })
          }
        }
        return {}
      })

      const result = await promptCrudService.getConfigV2Rows('brand-1', 'cust-1')

      expect(result).toHaveLength(2)
      expect(result[0].version).toBe(2)
      expect(result[1].version).toBe(1)
    })
  })

  describe('getHistory', () => {
    it('should return archived data', async () => {
      mockFrom.mockImplementation((table: any) => {
        if (table === 'archived_topics_prompts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn<any>().mockResolvedValue({
                  data: [{ id: 'arch-1', version_tag: 'V1' }],
                  error: null
                })
              })
            })
          }
        }
        return {}
      })

      const result = await promptCrudService.getHistory('brand-1')
      expect(result).toHaveLength(1)
      expect(result[0].version_tag).toBe('V1')
    })
  })

  describe('saveConfigV2Rows', () => {
    it('should archive topics and increment versions', async () => {
      const updateTopicsSpy = jest.fn().mockReturnValue({
        eq: jest.fn<any>().mockResolvedValue({ error: null })
      })

      const insertArchiveSpy = jest.fn<any>().mockResolvedValue({ error: null })

      mockFrom.mockImplementation((table: any) => {
        if (table === 'brand_topics') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                data: [{ id: 'topic-id-1', topic_name: 'Existing Topic', is_active: true, version: 1, brand_id: 'brand-1' }],
                error: null
              }),
              in: jest.fn<any>().mockResolvedValue({
                data: [{ id: 'topic-id-1', topic_name: 'Existing Topic', is_active: true, version: 1, brand_id: 'brand-1' }],
                error: null
              })
            }),
            update: updateTopicsSpy,
            insert: jest.fn<any>().mockResolvedValue({ error: null })
          }
        }
        if (table === 'generated_queries') {
          return {
            select: jest.fn().mockImplementation((...args: any[]) => {
              return {
                eq: jest.fn().mockImplementation((...args: any[]) => {
                   return {
                     in: jest.fn().mockImplementation((...args: any[]) => {
                         return {
                             eq: jest.fn<any>().mockImplementation((...args: any[]) => {
                                 return Promise.resolve({ 
                                     data: [{ id: 'q-old', query_text: 'Old Prompt', topic: 'Existing Topic', is_active: true }], 
                                     error: null 
                                 })
                             })
                         }
                     }),
                     eq: jest.fn().mockReturnValue({
                       in: jest.fn<any>().mockResolvedValue({ 
                           data: [{ id: 'q-old', metadata: {} }], 
                           error: null 
                       })
                     })
                  }
                })
              }
            }),
            update: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn<any>().mockResolvedValue({ error: null })
                    })
                })
            })
          }
        }
        if (table === 'archived_topics_prompts') {
            return {
                insert: insertArchiveSpy
            }
        }
        if (table === 'brands') {
            return {
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        eq: jest.fn<any>().mockResolvedValue({ data: [{name: 'Brand'}], error: null })
                    })
                })
            }
        }
        return {}
      })

      const rows = [
        { id: 'q-old', topic: 'Existing Topic', prompt: 'New Prompt', locale: 'en', country: 'US' }
      ]

      await promptCrudService.saveConfigV2Rows('brand-1', 'cust-1', rows, [])

      // Verify archiving
      expect(insertArchiveSpy).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({
              topic_name: 'Existing Topic',
              version_tag: 'V1',
              brand_id: 'brand-1'
          })
      ]))

      // Verify version increment
      // Since we use Promise.all for updates, we check if update was called with incremented version
      expect(updateTopicsSpy).toHaveBeenCalledWith(expect.objectContaining({
          version: 2,
          is_active: true
      }))
    })
  })
})
