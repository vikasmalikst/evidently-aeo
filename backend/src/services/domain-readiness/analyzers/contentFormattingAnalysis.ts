import * as cheerio from 'cheerio';
import axios from 'axios';
import { TestResult, AnalyzerOptions } from '../types';

export async function analyzeContentFormatting(url: string, options?: AnalyzerOptions): Promise<TestResult[]> {
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
                name: 'Content Formatting',
                status: 'fail',
                score: 0,
                message: 'Could not fetch HTML for analysis'
            }];
        }
    }

    const $ = cheerio.load(html as string);

    // Try to find main content area (common patterns)
    let mainContent = $('main').length > 0 ? $('main') :
        $('article').length > 0 ? $('article') :
            $('.content, .main-content, #content').length > 0 ? $('.content, .main-content, #content').first() :
                $('body');

    // Count lists
    const ulCount = mainContent.find('ul').length;
    const olCount = mainContent.find('ol').length;
    const totalLists = ulCount + olCount;

    // Count tables
    const tableCount = mainContent.find('table').length;

    // Count definition lists (dl, dt, dd)
    const dlCount = mainContent.find('dl').length;

    // Test 1: List & Table Usage
    let listTableScore = 0;
    let listTableStatus: 'pass' | 'warning' | 'info' = 'warning';
    let listTableMessage = '';

    listTableScore += Math.min(50, totalLists * 5); // Up to 50 points for lists
    if (tableCount > 0) {
        listTableScore += 50; // Full 50 points if at least one table
    }

    listTableScore = Math.min(100, listTableScore);

    if (listTableScore >= 70) {
        listTableStatus = 'pass';
        listTableMessage = `Good formatting: ${totalLists} list(s) and ${tableCount} table(s) found`;
    } else if (listTableScore >= 30) {
        listTableStatus = 'warning';
        listTableMessage = `Some structure found: ${totalLists} list(s) and ${tableCount} table(s). Consider adding more lists or tables for better AI readability.`;
    } else {
        listTableStatus = 'warning';
        listTableMessage = 'Limited structured content. Use bulleted/numbered lists and tables to make content easier for AI to parse.';
    }

    // Test 2: Definition Structure
    let defScore = 0;
    let defStatus: 'pass' | 'info' = 'info';
    let defMessage = '';

    if (dlCount > 0) {
        defScore = Math.min(100, dlCount * 30);
        defStatus = 'pass';
        defMessage = `Definition lists detected (${dlCount}). Excellent for Q&A format content.`;
    } else {
        defScore = 50; // Neutral score
        defStatus = 'info';
        defMessage = 'No definition lists (dl/dt/dd) found. Consider using them for glossaries or Q&A sections.';
    }

    return [
        {
            name: 'List & Table Usage',
            status: listTableStatus,
            score: listTableScore,
            message: listTableMessage,
            details: {
                unorderedLists: ulCount,
                orderedLists: olCount,
                tables: tableCount
            },
            documentationUrl: 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb'
        },
        {
            name: 'Definition Structure',
            status: defStatus,
            score: defScore,
            message: defMessage,
            details: {
                definitionLists: dlCount
            },
            documentationUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dl'
        }
    ];
}
