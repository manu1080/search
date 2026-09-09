import { Router } from 'express';
import type { Container } from '../../container.js';
import { authController } from '../controllers/auth.controller.js';
import { profileController } from '../controllers/profile.controller.js';
import { searchController } from '../controllers/search.controller.js';
import { uploadsController } from '../controllers/uploads.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { csvUpload } from '../middleware/upload.js';

export function buildRoutes(container: Container): Router {
  const router = Router();
  const auth = requireAuth(container.tokens);

  const authCtrl = authController(container);
  const profileCtrl = profileController(container);
  const searchCtrl = searchController(container);
  const uploadsCtrl = uploadsController(container);

  router.post('/auth/register', authCtrl.register!);
  router.post('/auth/login', authCtrl.login!);
  router.get('/auth/me', auth, authCtrl.me!);

  router.get('/profile', auth, profileCtrl.get!);
  router.patch('/profile', auth, profileCtrl.update!);
  router.patch('/profile/password', auth, profileCtrl.changePassword!);

  // Búsqueda abierta: sin autenticación.
  router.get('/search', searchCtrl.search!);
  router.get('/search/suggest', searchCtrl.suggest!);

  router.post('/uploads/csv', auth, csvUpload(container.config.MAX_UPLOAD_BYTES), uploadsCtrl.create!);
  router.get('/uploads', auth, uploadsCtrl.list!);
  router.get('/uploads/:id', auth, uploadsCtrl.get!);

  return router;
}
