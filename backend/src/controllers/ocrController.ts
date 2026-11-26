import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware';
import { parseInvoiceText, runInvoiceOcr } from '../services/ocrService';
import { AppError } from '../utils';

export async function parseInvoiceImage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.file) {
      if (!req.file.mimetype.startsWith('image/')) {
        throw new AppError(
          'OCR scanning requires an image file (JPEG, PNG, or WEBP).',
          400,
          'IMAGE_REQUIRED'
        );
      }
      const parsed = await runInvoiceOcr(req.file.buffer);
      res.json({
        success: true,
        data: parsed,
      });
      return;
    }

    // Also support client-side ML Kit raw text parsing when device ran on-device OCR
    if (typeof req.body?.rawText === 'string' && req.body.rawText.trim().length > 0) {
      const parsed = parseInvoiceText(req.body.rawText, 90, 'tesseract');
      res.json({
        success: true,
        data: parsed,
      });
      return;
    }

    throw new AppError(
      'Please upload an invoice image or supply OCR text to parse.',
      400,
      'OCR_INPUT_REQUIRED'
    );
  } catch (err) {
    next(err);
  }
}
