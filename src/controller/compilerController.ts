import { Request, Response } from 'express';
import { Lexer } from '../lexer/Lexer'
import { Parser } from '../parser/Parser';

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
            const { tokens, errors: lexicalErrors } = lexer.tokenize();

            // Análisis sintáctico
            const parser = new Parser(tokens);
            const { ast, errors: syntaxErrors } = parser.parse();

            res.json({
                success: true,
                language: 'python',
                tokens: tokens,
                ast: ast,
                errors: {
                    lexical: lexicalErrors,
                    syntactic: syntaxErrors
                },
                totalTokens: tokens.length,
                totalErrors: lexicalErrors.length + syntaxErrors.length,
                hasErrors: (lexicalErrors.length + syntaxErrors.length) > 0
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
            features: [
                'Análisis léxico', 
                'Manejo de errores léxicos',
                'Análisis sintáctico',
                'Validación de variables y asignaciones'
            ],
            timestamp: new Date().toISOString()
        });
    }
}