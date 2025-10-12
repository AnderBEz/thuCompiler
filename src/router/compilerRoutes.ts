import { Router } from 'express';
import { CompilerController } from '../controller/compilerController';

const router = Router();

router.post('/tokenize', CompilerController.tokenize);
router.get('/health', CompilerController.healthCheck);

export default router;