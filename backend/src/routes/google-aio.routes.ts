import express from 'express';
import { googleAIOCollectorService, GoogleAIOBatchRequest } from '../services/data-collection/google-aio-collector.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * POST /api/google-aio/query
 * Submit queries to Google AIO Collector
 */
router.post('/query', authenticateToken, async (req, res) => {
  try {
    const request: GoogleAIOBatchRequest = req.body;
    
    const result = await googleAIOCollectorService.submitQueries(request);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error submitting Google AIO queries:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit queries'
    });
  }
});

/**
 * GET /api/google-aio/status/:batchId
 * Get the status of a batch request
 */
router.get('/status/:batchId', authenticateToken, async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const result = await googleAIOCollectorService.getBatchStatus(batchId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting Google AIO batch status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get batch status'
    });
  }
});

/**
 * GET /api/google-aio/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    collector: 'Google AIO',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

export default router;
