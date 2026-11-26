import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 'local';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/warrantywise_advanced_test';
process.env.JWT_SECRET = 'test_jwt_secret_advanced';

import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/clients';
import { parseInvoiceText } from '../src/services/ocrService';
import {
  HEALTH_SCORE_DISCLAIMER,
  analyzeProductOwnershipCost,
  computeProductHealthScore,
} from '../src/services/productAnalyticsService';
import { computeWarrantyMetrics } from '../src/services/warrantyService';

const app = createApp();

let ownerToken = '';
let familyToken = '';
let strangerToken = '';
let productId = '';
let qrToken = '';
let familyMemberId = '';
let invoiceDocId = '';

beforeAll(async () => {
  await connectDatabase('mongodb://127.0.0.1:27017/warrantywise_advanced_test');
  await mongoose.connection.db?.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await disconnectDatabase();
});

describe('Advanced Services Unit Tests', () => {
  it('detects standard & extended warranty from OCR invoice text', () => {
    const text = `
      ElectroWorld Retail
      Invoice No: EW-7721
      Purchase Date: 2026-04-10
      Item: LG Split Inverter AC 1.5 Ton
      Model No: LG-AC-1500
      Serial No: SNAC987654321
      2-Year Manufacturer Warranty
      Extended Warranty for 3 Years
      Grand Total: $850.00
    `;
    const parsed = parseInvoiceText(text, 91);
    expect(parsed.extracted.warrantyDurationMonths).toBe(24);
    expect(parsed.extracted.extendedWarrantyMonths).toBe(36);
    expect(parsed.extracted.modelNumber).toBe('LG-AC-1500');
    expect(parsed.extracted.serialNumber).toBe('SNAC987654321');
    expect(parsed.requiresUserVerification).toBe(true);
  });

  it('computes combined standard + extended warranty coverage accurately', () => {
    const metrics = computeWarrantyMetrics(
      '2024-01-01',
      '2025-01-01',
      '2026-01-01',
      '2025-01-01',
      '2027-01-01'
    );
    expect(metrics.standardMetrics?.warrantyStatus).toBe('Expired');
    expect(metrics.extendedMetrics?.warrantyStatus).toBe('Active');
    expect(metrics.warrantyStatus).toBe('Active');
    expect(metrics.activeTier).toBe('Extended');
  });

  it('computes ownership cost breakdown and informational health score', () => {
    const cost = analyzeProductOwnershipCost({
      product: {
        purchaseDate: new Date('2025-01-01'),
        purchasePrice: 1000,
        currency: 'USD',
        extendedWarrantyCost: 150,
      },
      repairs: [{ repairCost: 120 }],
      maintenances: [{ history: [{ completedAt: new Date(), cost: 80 }] }],
      amcs: [{ cost: 100 }],
      referenceDate: new Date('2026-01-01'),
    });
    expect(cost.totalOwnershipCost).toBe(1450);
    expect(cost.totalRepairExpenses).toBe(120);
    expect(cost.totalMaintenanceExpenses).toBe(80);
    expect(cost.totalAmcCost).toBe(100);

    const health = computeProductHealthScore({
      product: { purchaseDate: new Date('2025-01-01'), category: 'Home Appliances' },
      repairs: [{ repairStatus: 'Completed', repairDate: new Date('2025-08-01') }],
      maintenances: [
        {
          status: 'Scheduled',
          nextServiceDate: new Date('2026-06-01'),
          frequencyMonths: 6,
          history: [{ completedAt: new Date('2025-12-01'), cost: 80 }],
        },
      ],
      claims: [],
      referenceDate: new Date('2026-01-01'),
    });
    expect(health.score).toBeGreaterThan(70);
    expect(health.disclaimer).toBe(HEALTH_SCORE_DISCLAIMER);
  });
});

describe('Advanced Modules REST API Integration', () => {
  it('sets up owner, family member, stranger, product with extended warranty, and private invoice', async () => {
    const ownerRes = await request(app).post('/api/auth/register').send({
      name: 'Owner User',
      email: 'owner@warrantywise.test',
      password: 'Password123!',
    });
    ownerToken = ownerRes.body.data.token;

    const famUserRes = await request(app).post('/api/auth/register').send({
      name: 'Family Spouse',
      email: 'spouse@warrantywise.test',
      password: 'Password123!',
    });
    familyToken = famUserRes.body.data.token;

    const strangerRes = await request(app).post('/api/auth/register').send({
      name: 'Stranger User',
      email: 'stranger@warrantywise.test',
      password: 'Password123!',
    });
    strangerToken = strangerRes.body.data.token;

    const docRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'AC Purchase Invoice')
      .field('type', 'Purchase Invoice')
      .attach('file', Buffer.from('%PDF-1.4 sample invoice'), {
        filename: 'ac-invoice.pdf',
        contentType: 'application/pdf',
      });
    expect(docRes.status).toBe(201);
    invoiceDocId = docRes.body.data._id;

    const famMemberRes = await request(app)
      .post('/api/family/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Spouse',
        relationship: 'Spouse',
        email: 'spouse@warrantywise.test',
        permissions: {
          canViewWarranties: true,
          canViewDocuments: false,
          canReceiveReminders: true,
        },
      });
    expect(famMemberRes.status).toBe(201);
    familyMemberId = famMemberRes.body.data._id;

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productName: 'Split Inverter AC',
        brand: 'LG',
        modelNumber: 'LG-1500',
        serialNumber: 'AC-SER-998811',
        category: 'Home Appliances',
        purchaseDate: '2026-01-15',
        purchasePrice: 900,
        sellerName: 'ElectroWorld',
        warrantyDurationMonths: 12,
        extendedWarrantyProvider: 'LG Care+',
        extendedWarrantyMonths: 24,
        extendedWarrantyCost: 120,
        warrantyTransferable: true,
        familyMemberId,
        sharedWithFamily: true,
        invoiceDocumentId: invoiceDocId,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
    qrToken = prodRes.body.data.qrToken;
    expect(qrToken).toMatch(/^WW-/);
  });

  it('handles AMC, Maintenance (with offline dedupe & conflict check), Claims, Lifecycle, Cost, Health, Calendar', async () => {
    // AMC
    const amcRes = await request(app)
      .post('/api/amc')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productId,
        providerName: 'CoolAir AMC Services',
        contractNumber: 'AMC-2026-11',
        startDate: '2026-02-01',
        endDate: '2027-02-01',
        cost: 95,
        visitFrequencyMonths: 6,
        scheduledVisitsCount: 2,
      });
    expect(amcRes.status).toBe(201);
    const amcId = amcRes.body.data._id;

    const visitRes = await request(app)
      .post(`/api/amc/${amcId}/visit`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(visitRes.status).toBe(200);
    expect(visitRes.body.data.completedVisitsCount).toBe(1);

    // Maintenance + Offline deduplication + Version conflict
    const maintRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productId,
        title: 'AC Filter & Coil Cleaning',
        serviceType: 'AC Servicing',
        frequencyMonths: 6,
        nextServiceDate: '2026-12-05',
        estimatedCost: 45,
        clientMutationId: 'offline-maint-1',
      });
    expect(maintRes.status).toBe(201);
    const maintId = maintRes.body.data._id;

    // Replay same clientMutationId -> deduplicated
    const dupRes = await request(app)
      .post('/api/maintenance')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productId,
        title: 'AC Filter & Coil Cleaning',
        serviceType: 'AC Servicing',
        frequencyMonths: 6,
        nextServiceDate: '2026-12-05',
        estimatedCost: 45,
        clientMutationId: 'offline-maint-1',
      });
    expect(dupRes.status).toBe(200);
    expect(dupRes.body.deduplicated).toBe(true);

    // Complete maintenance -> increments version to 2
    const compRes = await request(app)
      .post(`/api/maintenance/${maintId}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ cost: 50, serviceProvider: 'CoolAir Tech', notes: 'Cleaned filters' });
    expect(compRes.status).toBe(200);
    expect(compRes.body.data.version).toBe(2);

    // Stale version update -> 409 conflict
    const conflictRes = await request(app)
      .put(`/api/maintenance/${maintId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Stale offline note', version: 1 });
    expect(conflictRes.status).toBe(409);

    // Warranty Claim Assistant
    const prepRes = await request(app)
      .get(`/api/claims/prepare/${productId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(prepRes.status).toBe(200);
    expect(prepRes.body.data.checklist.length).toBeGreaterThanOrEqual(4);

    const claimRes = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        productId,
        manufacturerOrCenter: 'LG Authorized Center',
        claimReferenceNumber: 'CLM-9001',
        issueSummary: 'Compressor noise during startup',
        status: 'Submitted',
      });
    expect(claimRes.status).toBe(201);
    expect(claimRes.body.disclaimer).toContain('does not guarantee');

    // Lifecycle, Cost, Health, Resale
    const [lifeRes, costRes, healthRes, resaleRes, calRes, dashRes] = await Promise.all([
      request(app).get(`/api/products/${productId}/lifecycle`).set('Authorization', `Bearer ${ownerToken}`),
      request(app).get(`/api/products/${productId}/cost-analysis`).set('Authorization', `Bearer ${ownerToken}`),
      request(app).get(`/api/products/${productId}/health-score`).set('Authorization', `Bearer ${ownerToken}`),
      request(app).get(`/api/products/${productId}/resale-summary`).set('Authorization', `Bearer ${ownerToken}`),
      request(app).get('/api/calendar').set('Authorization', `Bearer ${ownerToken}`),
      request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${ownerToken}`),
    ]);

    expect(lifeRes.status).toBe(200);
    expect(lifeRes.body.data.length).toBeGreaterThanOrEqual(4);
    expect(costRes.body.data.totalOwnershipCost).toBe(1165); // 900 + 120 + 95 + 50
    expect(healthRes.body.data.score).toBeGreaterThan(0);
    expect(resaleRes.body.data.disclaimer).toContain('does not certify');
    expect(calRes.body.data.length).toBeGreaterThanOrEqual(3);
    expect(dashRes.body.data.stats.activeAmcContracts).toBe(1);
    expect(dashRes.body.data.stats.pendingClaims).toBe(1);
  });

  it('enforces QR security and Family Vault permission controls', async () => {
    // Stranger cannot scan QR token
    const strangerQr = await request(app)
      .get(`/api/products/qr/${qrToken}`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(strangerQr.status).toBe(404);

    // Linked family member CAN view shared product & QR identity with masked serial
    const famQr = await request(app)
      .get(`/api/products/qr/${qrToken}`)
      .set('Authorization', `Bearer ${familyToken}`);
    expect(famQr.status).toBe(200);
    expect(famQr.body.data.maskedSerialNumber).toBe('•••••••••8811');

    // Linked family member CANNOT download private invoice when canViewDocuments is false
    const famDocDownload = await request(app)
      .get(`/api/documents/${invoiceDocId}/download`)
      .set('Authorization', `Bearer ${familyToken}`);
    expect(famDocDownload.status).toBe(404);

    // Linked family member CAN read repairs for shared product
    const famRepairs = await request(app)
      .get(`/api/repairs/${productId}`)
      .set('Authorization', `Bearer ${familyToken}`);
    expect(famRepairs.status).toBe(200);

    // OCR endpoint works for authenticated user & rejects unauthenticated access
    const unauthOcr = await request(app)
      .post('/api/ocr/parse-invoice')
      .send({ rawText: 'Invoice No: INV-1' });
    expect(unauthOcr.status).toBe(401);

    const ocrRes = await request(app)
      .post('/api/ocr/parse-invoice')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        rawText:
          'TechStore\nInvoice No: TS-2026-44\nPurchase Date: 2026-05-01\nItem: Dell XPS 13\n2 Year Warranty\nTotal: $1299.00',
      });
    expect(ocrRes.status).toBe(200);
    expect(ocrRes.body.data.extracted.warrantyDurationMonths).toBe(24);
    expect(ocrRes.body.data.requiresUserVerification).toBe(true);

    // Deleting invoice document clears references on Product without leaving orphans
    const delDoc = await request(app)
      .delete(`/api/documents/${invoiceDocId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(delDoc.status).toBe(200);

    const prodAfterDelDoc = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(prodAfterDelDoc.status).toBe(200);
    expect(prodAfterDelDoc.body.data.invoiceDocumentId).toBeUndefined();

    // Linked family member sees shared product on Family Vault dashboard
    const famDash = await request(app)
      .get('/api/family')
      .set('Authorization', `Bearer ${familyToken}`);
    expect(famDash.status).toBe(200);
    expect(famDash.body.data.sharedWithMe).toHaveLength(1);

    // Regenerating QR token invalidates old token
    const regenRes = await request(app)
      .post(`/api/products/${productId}/qr/regenerate`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(regenRes.status).toBe(200);
    const oldQrLookup = await request(app)
      .get(`/api/products/qr/${qrToken}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(oldQrLookup.status).toBe(404);
  });
});
