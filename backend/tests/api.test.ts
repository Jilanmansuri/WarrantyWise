import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 'local';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/warrantywise_test';
process.env.JWT_SECRET = 'test_jwt_secret_for_vitest';

import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/db';

const app = createApp();

let userAToken = '';
let userBToken = '';
let productId = '';
let repairId = '';
let documentId = '';

beforeAll(async () => {
  await connectDatabase('mongodb://127.0.0.1:27017/warrantywise_test');
  await mongoose.connection.db?.dropDatabase();
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await disconnectDatabase();
});

describe('WarrantyWise REST API Integration', () => {
  it('registers, logs in, fetches profile, and manages password reset', async () => {
    const regA = await request(app).post('/api/auth/register').send({
      name: 'Alice Tester',
      email: 'alice@example.com',
      password: 'Password123!',
    });
    expect(regA.status).toBe(201);
    expect(regA.body.data.token).toBeTruthy();
    userAToken = regA.body.data.token;

    const regB = await request(app).post('/api/auth/register').send({
      name: 'Bob Intruder',
      email: 'bob@example.com',
      password: 'Password123!',
    });
    expect(regB.status).toBe(201);
    userBToken = regB.body.data.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('alice@example.com');

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });
    expect(forgotRes.status).toBe(200);
    const devCode = forgotRes.body.data.devResetCode;
    expect(devCode).toHaveLength(6);

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      email: 'alice@example.com',
      code: devCode,
      newPassword: 'NewPassword456!',
    });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'NewPassword456!',
    });
    expect(loginRes.status).toBe(200);
    userAToken = loginRes.body.data.token;
  });

  it('uploads document, creates product, enforces ownership, and checks dashboard', async () => {
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userAToken}`)
      .field('title', 'MacBook Purchase Invoice')
      .field('type', 'Purchase Invoice')
      .attach('file', Buffer.from('%PDF-1.4 fake invoice pdf content'), {
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
      });
    expect(uploadRes.status).toBe(201);
    documentId = uploadRes.body.data._id;

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        productName: 'MacBook Air M3',
        brand: 'Apple',
        modelNumber: 'A3113',
        serialNumber: 'SN99887766',
        category: 'Laptops & Computers',
        purchaseDate: '2026-06-01',
        purchasePrice: 1299,
        sellerName: 'Apple Store',
        warrantyDurationMonths: 24,
        invoiceDocumentId: documentId,
      });
    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;
    expect(prodRes.body.data.claimReadiness.score).toBe(100);

    // Ownership isolation check: Bob cannot view or delete Alice's product or document
    const bobGetProd = await request(app)
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(bobGetProd.status).toBe(404);

    const bobGetDoc = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(bobGetDoc.status).toBe(404);

    // Alice can download her document
    const aliceDownload = await request(app)
      .get(`/api/documents/${documentId}/download`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(aliceDownload.status).toBe(200);

    // Add repair record
    const repairRes = await request(app)
      .post('/api/repairs')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        productId,
        repairDate: '2026-08-15',
        problemDescription: 'Keyboard key sticking',
        repairCenter: 'Apple Genius Bar',
        repairCost: 0,
        repairStatus: 'Completed',
      });
    expect(repairRes.status).toBe(201);
    repairId = repairRes.body.data._id;

    const repairsList = await request(app)
      .get(`/api/repairs/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(repairsList.status).toBe(200);
    expect(repairsList.body.data).toHaveLength(1);

    const statsRes = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.stats.totalProducts).toBe(1);
    expect(statsRes.body.data.stats.activeWarranties).toBe(1);
    expect(statsRes.body.data.recentlyRepairedProducts).toHaveLength(1);

    // Update & Delete repair
    const updateRepair = await request(app)
      .put(`/api/repairs/${repairId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ repairStatus: 'Completed', additionalNotes: 'Replaced keycap under warranty' });
    expect(updateRepair.status).toBe(200);

    const delProduct = await request(app)
      .delete(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(delProduct.status).toBe(200);
  });
});
