import { Request, Response } from 'express';
import { domainReadinessService } from './domain-readiness.service';

export class DomainReadinessController {
  async runAudit(req: Request, res: Response) {
    try {
      const { brandId } = req.params;
      const result = await domainReadinessService.runAudit(brandId, req.user?.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Audit Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async runAuditStream(req: Request, res: Response) {
    const { brandId } = req.params;

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    const writeLine = (payload: unknown) => {
      if (res.writableEnded) return;
      res.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      await domainReadinessService.runAuditStream(
        brandId,
        req.user?.id,
        (event) => writeLine(event),
        abortController.signal
      );
      if (!res.writableEnded) {
        res.end();
      }
    } catch (error: unknown) {
      if ((error as Error)?.name === 'AbortError') {
        if (!res.writableEnded) res.end();
        return;
      }
      const message = error instanceof Error ? error.message : 'Audit stream failed';
      writeLine({ type: 'error', error: message });
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  async getLatestAudit(req: Request, res: Response) {
    try {
      const { brandId } = req.params;
      const result = await domainReadinessService.getLatestAudit(brandId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Fetch Audit Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAuditHistory(req: Request, res: Response) {
    try {
      const { brandId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const history = await domainReadinessService.getAuditHistory(brandId, days);
      res.json({ success: true, data: history });
    } catch (error: any) {
      console.error('Fetch Audit History Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const domainReadinessController = new DomainReadinessController();
