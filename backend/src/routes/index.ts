import { Router } from 'express';
import * as amc from '../controllers/amcController';
import * as auth from '../controllers/authController';
import { getCalendarEvents } from '../controllers/calendarController';
import * as claim from '../controllers/claimController';
import { getDashboardStats, getUpcomingExpiries } from '../controllers/dashboardController';
import * as doc from '../controllers/documentController';
import * as family from '../controllers/familyController';
import * as maint from '../controllers/maintenanceController';
import { parseInvoiceImage } from '../controllers/ocrController';
import * as product from '../controllers/productController';
import * as repair from '../controllers/repairController';
import { requireAuth, uploadMiddleware, validateBody } from '../middleware';

const apiRouter = Router();

// Auth & Preferences
apiRouter.post('/auth/register', validateBody(auth.registerSchema), auth.register);
apiRouter.post('/auth/login', validateBody(auth.loginSchema), auth.login);
apiRouter.post('/auth/forgot-password', validateBody(auth.forgotPasswordSchema), auth.forgotPassword);
apiRouter.post('/auth/reset-password', validateBody(auth.resetPasswordSchema), auth.resetPassword);
apiRouter.get('/auth/me', requireAuth, auth.getMe);
apiRouter.put('/auth/me', requireAuth, validateBody(auth.updateProfileSchema), auth.updateMe);
apiRouter.get('/auth/notifications', requireAuth, auth.getNotificationPreferences);
apiRouter.put(
  '/auth/notifications',
  requireAuth,
  validateBody(auth.notificationPrefSchema),
  auth.updateNotificationPreferences
);

// Products, Lifecycle, Analytics & QR Identity
apiRouter.post('/products', requireAuth, validateBody(product.createProductSchema), product.createProduct);
apiRouter.get('/products', requireAuth, product.getProducts);
apiRouter.get('/products/qr/:qrToken', requireAuth, product.lookupProductByQrToken);
apiRouter.get('/products/:id', requireAuth, product.getProductById);
apiRouter.get('/products/:id/lifecycle', requireAuth, product.getProductLifecycle);
apiRouter.get('/products/:id/cost-analysis', requireAuth, product.getProductCostAnalysis);
apiRouter.get('/products/:id/health-score', requireAuth, product.getProductHealthScore);
apiRouter.get('/products/:id/resale-summary', requireAuth, product.getResaleSummary);
apiRouter.post('/products/:id/qr/regenerate', requireAuth, product.regenerateQrToken);
apiRouter.put('/products/:id', requireAuth, validateBody(product.updateProductSchema), product.updateProduct);
apiRouter.delete('/products/:id', requireAuth, product.deleteProduct);

// Repairs
apiRouter.post('/repairs', requireAuth, validateBody(repair.createRepairSchema), repair.createRepair);
apiRouter.get('/repairs', requireAuth, repair.getAllRepairs);
apiRouter.get('/repairs/:productId', requireAuth, repair.getRepairsByProduct);
apiRouter.put('/repairs/:id', requireAuth, validateBody(repair.updateRepairSchema), repair.updateRepair);
apiRouter.delete('/repairs/:id', requireAuth, repair.deleteRepair);

// Documents
apiRouter.post('/documents', requireAuth, uploadMiddleware.single('file'), doc.uploadDocument);
apiRouter.get('/documents', requireAuth, doc.getDocuments);
apiRouter.get('/documents/:id/download', requireAuth, doc.downloadDocument);
apiRouter.delete('/documents/:id', requireAuth, doc.deleteDocument);

// Dashboard & Calendar & OCR
apiRouter.get('/dashboard/stats', requireAuth, getDashboardStats);
apiRouter.get('/dashboard/upcoming-expiries', requireAuth, getUpcomingExpiries);
apiRouter.get('/calendar', requireAuth, getCalendarEvents);
apiRouter.post('/ocr/parse-invoice', requireAuth, uploadMiddleware.single('image'), parseInvoiceImage);

// AMC Contracts
apiRouter.post('/amc', requireAuth, validateBody(amc.createAmcSchema), amc.createAmc);
apiRouter.get('/amc', requireAuth, amc.getAmcs);
apiRouter.put('/amc/:id', requireAuth, validateBody(amc.updateAmcSchema), amc.updateAmc);
apiRouter.post('/amc/:id/visit', requireAuth, amc.logAmcVisit);
apiRouter.delete('/amc/:id', requireAuth, amc.deleteAmc);

// Smart Maintenance
apiRouter.post(
  '/maintenance',
  requireAuth,
  validateBody(maint.createMaintenanceSchema),
  maint.createMaintenance
);
apiRouter.get('/maintenance', requireAuth, maint.getMaintenances);
apiRouter.put(
  '/maintenance/:id',
  requireAuth,
  validateBody(maint.updateMaintenanceSchema),
  maint.updateMaintenance
);
apiRouter.post(
  '/maintenance/:id/complete',
  requireAuth,
  validateBody(maint.completeMaintenanceSchema),
  maint.completeMaintenance
);
apiRouter.delete('/maintenance/:id', requireAuth, maint.deleteMaintenance);

// Warranty Claims
apiRouter.post('/claims', requireAuth, validateBody(claim.createClaimSchema), claim.createClaim);
apiRouter.get('/claims', requireAuth, claim.getClaims);
apiRouter.get('/claims/prepare/:productId', requireAuth, claim.getClaimPreparation);
apiRouter.put('/claims/:id', requireAuth, validateBody(claim.updateClaimSchema), claim.updateClaim);
apiRouter.delete('/claims/:id', requireAuth, claim.deleteClaim);

// Family Vault
apiRouter.get('/family', requireAuth, family.getFamilyDashboard);
apiRouter.post(
  '/family/members',
  requireAuth,
  validateBody(family.familyMemberSchema),
  family.createFamilyMember
);
apiRouter.put(
  '/family/members/:id',
  requireAuth,
  validateBody(family.updateFamilyMemberSchema),
  family.updateFamilyMember
);
apiRouter.delete('/family/members/:id', requireAuth, family.deleteFamilyMember);
apiRouter.post('/family/assign', requireAuth, family.assignProductToMember);

export default apiRouter;
