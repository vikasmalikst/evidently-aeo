import { Router } from 'express';
import { z } from 'zod';
import { Router } from 'express';
import { z } from 'zod';
import { EmailService, DemoRequestData } from '../services/email/email.service';

const router = Router();
const emailService = new EmailService();

// Validation schema
const demoRequestSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    company: z.string().min(1, "Company name is required"),
    jobTitle: z.string().min(1, "Job title is required"),
    message: z.string().optional(),
});

router.post('/book-demo', async (req, res) => {
    try {
        // Validate request body
        const validatedData = demoRequestSchema.parse(req.body) as DemoRequestData;

        // Send email
        await emailService.sendDemoRequest(validatedData);

        res.status(200).json({
            success: true,
            message: 'Demo request sent successfully'
        });
    } catch (error) {
        console.error('Demo request error:', error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to process demo request'
        });
    }
});

export const contactRouter = router;
