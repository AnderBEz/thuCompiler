import { Router } from 'express';
import { CompilerController } from '../controller/compilerController';

const router = Router();


router.post('/compile', CompilerController.compile);


router.post('/tokenize', CompilerController.tokenize);


router.post('/quick-analysis', CompilerController.quickAnalysis);


router.post('/symbol-table', CompilerController.getSymbolTable);

router.get('/health', CompilerController.healthCheck);

export default router;