import { Request, Response } from 'express';
import { Lexer } from '../lexer/lexer'

export class CompilerController {
    public static tokenize(req: Request, res: Response): void {
        try {
            const { sourceCode } = req.body;

            if (!sourceCode) {
                res.status(400).json({
                    error: 'El campo sourceCode es requerido'
                });
                return;
            }

            const lexer = new Lexer(sourceCode);
            const tokens = lexer.tokenize();

            res.json({
                success: true,
                language: 'python',
                tokens: tokens,
                totalTokens: tokens.length
            });

        } catch (error) {
            res.status(500).json({
                error: 'Error interno del servidor',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    public static healthCheck(req: Request, res: Response): void {
        res.json({
            status: 'OK',
            message: 'Compilador Python backend funcionando correctamente',
            language: 'python',
            timestamp: new Date().toISOString()
        });
    }
}