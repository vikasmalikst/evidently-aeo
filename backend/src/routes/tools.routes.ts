import { Router } from 'express';
import { scrapingService } from '../services/tools/scraping.service';

const router = Router();

router.post('/scrape-competitor', async (req, res) => {
    try {
        const { competitor, fields } = req.body; // fields: ['Pricing', 'Rating']

        if (!competitor || !fields || !Array.isArray(fields)) {
            return res.status(400).json({ error: 'Missing competitor or fields array' });
        }

        // Run parallel scrapes for each field
        const results = await Promise.all(fields.map(async (field) => {
            const data = await scrapingService.findCompetitorData(competitor, field);
            return { field, ...data };
        }));

        res.json({
            competitor,
            data: results
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
