import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeCoreWebVitals(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
    let html = options?.html;
    if (!html) {
        try {
            const response = await axios.get(url, {
                timeout: options?.timeout || 10000,
                headers: { 'User-Agent': 'EvidentlyAEO-Auditor/1.0' }
            });
            html = response.data;
        } catch (e: any) {
            return [{
                name: 'Core Web Vitals Check',
                status: 'fail',
                score: 0,
                message: 'Could not fetch HTML for analysis'
            }];
        }
    }

    const $ = cheerio.load(html as string);
    const images = $('img');

    // Test 1: Image Dimension Hints (CLS prevention)
    let totalImages = 0;
    let imagesWithDimensions = 0;

    images.each((_, el) => {
        totalImages++;
        const width = $(el).attr('width');
        const height = $(el).attr('height');

        // Also check for CSS styles
        const style = $(el).attr('style') || '';
        const hasStyleDimensions = style.includes('width') && style.includes('height');

        if ((width && height) || hasStyleDimensions) {
            imagesWithDimensions++;
        }
    });

    let dimensionScore = 0;
    let dimensionStatus: 'pass' | 'warning' | 'fail' = 'fail';
    let dimensionMessage = '';

    if (totalImages === 0) {
        dimensionScore = 100;
        dimensionStatus = 'pass';
        dimensionMessage = 'No images found';
    } else {
        const percentage = (imagesWithDimensions / totalImages) * 100;
        dimensionScore = Math.round(percentage);

        if (percentage >= 90) {
            dimensionStatus = 'pass';
            dimensionMessage = `Excellent: ${imagesWithDimensions}/${totalImages} images have dimension hints`;
        } else if (percentage >= 50) {
            dimensionStatus = 'warning';
            dimensionMessage = `Some images missing dimensions: ${imagesWithDimensions}/${totalImages} have width/height. Add dimensions to prevent layout shift.`;
        } else {
            dimensionStatus = 'fail';
            dimensionMessage = `Most images lack dimensions: only ${imagesWithDimensions}/${totalImages} specify width/height. This causes Cumulative Layout Shift (CLS).`;
        }
    }

    // Test 2: Lazy Loading
    let imagesWithLazyLoading = 0;

    images.each((_, el) => {
        const loading = $(el).attr('loading');
        if (loading === 'lazy') {
            imagesWithLazyLoading++;
        }
    });

    let lazyScore = 0;
    let lazyStatus: 'pass' | 'warning' | 'info' = 'info';
    let lazyMessage = '';

    if (totalImages === 0) {
        lazyScore = 100;
        lazyStatus = 'pass';
        lazyMessage = 'No images to lazy-load';
    } else {
        const percentage = (imagesWithLazyLoading / totalImages) * 100;
        lazyScore = Math.round(percentage);

        if (percentage >= 70) {
            lazyStatus = 'pass';
            lazyMessage = `Good: ${imagesWithLazyLoading}/${totalImages} images use lazy loading`;
        } else if (percentage >= 30) {
            lazyStatus = 'warning';
            lazyMessage = `Some lazy loading: ${imagesWithLazyLoading}/${totalImages} images. Add loading="lazy" to below-fold images.`;
        } else {
            lazyStatus = 'info';
            lazyMessage = `Limited lazy loading: ${imagesWithLazyLoading}/${totalImages} images. Consider adding loading="lazy" to improve LCP.`;
        }
    }

    return [
        {
            name: 'Image Dimension Hints',
            status: dimensionStatus,
            score: dimensionScore,
            message: dimensionMessage,
            details: {
                totalImages,
                imagesWithDimensions,
                percentageWithDimensions: totalImages > 0 ? Math.round((imagesWithDimensions / totalImages) * 100) : 0
            },
            documentationUrl: 'https://web.dev/cls/'
        },
        {
            name: 'Lazy Loading',
            status: lazyStatus,
            score: lazyScore,
            message: lazyMessage,
            details: {
                totalImages,
                imagesWithLazyLoading,
                percentageWithLazyLoading: totalImages > 0 ? Math.round((imagesWithLazyLoading / totalImages) * 100) : 0
            },
            documentationUrl: 'https://web.dev/browser-level-image-lazy-loading/'
        }
    ];
}
