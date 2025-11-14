import { Request, Response } from 'express';
import { Lexer } from '../lexer/Lexer';
import { Parser } from '../parser/Parser';
import { SemanticAnalyzer } from '../semantic/semanticAnalyzer';

export class CompilerController {
    /**
     * Endpoint principal para compilar código
     * POST /api/compiler/compile
     */
    public static compile(req: Request, res: Response): void {
        try {
            const { sourceCode } = req.body;

            if (!sourceCode) {
                res.status(400).json({
                    success: false,
                    error: 'El campo sourceCode es requerido'
                });
                return;
            }

            // ============ FASE 1: ANÁLISIS LÉXICO ============
            const lexer = new Lexer(sourceCode);
            const { tokens, errors: lexicalErrors } = lexer.tokenize();

            // ============ FASE 2: ANÁLISIS SINTÁCTICO ============
            const parser = new Parser(tokens);
            const { ast, errors: syntaxErrors } = parser.parse();

            // ============ FASE 3: ANÁLISIS SEMÁNTICO ============
            const semanticAnalyzer = new SemanticAnalyzer();
            const { symbolTable, errors: semanticErrors } =
                semanticAnalyzer.analyze(ast);

            // ============ CALCULAR ESTADÍSTICAS ============
            const totalErrors = lexicalErrors.length + syntaxErrors.length + semanticErrors.length;
            const totalWarnings = 0;
            const hasErrors = totalErrors > 0;
            const hasWarnings = totalWarnings > 0;
            const compilationSuccess = !hasErrors;

            // ============ RESPUESTA COMPLETA ============
            res.json({
                // Estado de la compilación
                success: true,  // Request procesado exitosamente
                compilationSuccess: compilationSuccess,  // Código compiló sin errores

                // Resultados del análisis
                phases: {
                    lexical: {
                        completed: true,
                        tokensGenerated: tokens.length,
                        errorsFound: lexicalErrors.length
                    },
                    syntactic: {
                        completed: true,
                        astGenerated: ast !== null,
                        errorsFound: syntaxErrors.length
                    },
                    semantic: {
                        completed: true,
                        symbolsIdentified: symbolTable.getAllSymbols().length,
                        errorsFound: semanticErrors.length
                    }
                },

                // Resultados detallados
                analysis: {
                    tokens: tokens,
                    ast: ast,
                    symbolTable: symbolTable.export()
                },

                // Errores por fase
                errors: {
                    lexical: lexicalErrors,
                    syntactic: syntaxErrors,
                    semantic: semanticErrors
                },

                // Estadísticas generales
                statistics: {
                    totalTokens: tokens.length,
                    totalSymbols: symbolTable.getAllSymbols().length,
                    totalErrors: totalErrors,
                    hasErrors: hasErrors,
                    errorsByPhase: {
                        lexical: lexicalErrors.length,
                        syntactic: syntaxErrors.length,
                        semantic: semanticErrors.length
                    }
                },

                // Metadata
                metadata: {
                    timestamp: new Date().toISOString(),
                    sourceCodeLength: sourceCode.length,
                    linesOfCode: sourceCode.split('\n').length,
                    language: 'python'
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                compilationSuccess: false,
                error: 'Error interno del servidor',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    /**
     * Endpoint legacy para retrocompatibilidad
     * POST /api/compiler/tokenize
     */
    public static tokenize(req: Request, res: Response): void {
        // Redirigir al endpoint completo
        CompilerController.compile(req, res);
    }

    /**
     * Endpoint para análisis rápido (solo léxico y sintáctico)
     * POST /api/compiler/quick-analysis
     */
    public static quickAnalysis(req: Request, res: Response): void {
        try {
            const { sourceCode } = req.body;

            if (!sourceCode) {
                res.status(400).json({
                    success: false,
                    error: 'El campo sourceCode es requerido'
                });
                return;
            }

            const lexer = new Lexer(sourceCode);
            const { tokens, errors: lexicalErrors } = lexer.tokenize();

            const parser = new Parser(tokens);
            const { ast, errors: syntaxErrors } = parser.parse();

            const totalErrors = lexicalErrors.length + syntaxErrors.length;

            res.json({
                success: true,
                compilationSuccess: totalErrors === 0,
                tokens: tokens,
                ast: ast,
                errors: {
                    lexical: lexicalErrors,
                    syntactic: syntaxErrors
                },
                totalErrors: totalErrors
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    /**
     * Health check endpoint
     * GET /api/compiler/health
     */
    public static healthCheck(req: Request, res: Response): void {
        res.json({
            status: 'OK',
            message: 'Compilador Python backend funcionando correctamente',
            version: '3.0.0',
            language: 'python',

            phases: [
                'Análisis Léxico',
                'Análisis Sintáctico',
                'Análisis Semántico'
            ],

            features: {
                lexical: [
                    'Tokenización completa',
                    'Detección de errores léxicos',
                    'Soporte para todos los tipos de tokens de Python'
                ],
                syntactic: [
                    'Generación de AST',
                    'Estructuras de control: IF-ELSE',
                    'Estructuras de control: WHILE',
                    'Estructuras de control: FOR',
                    'Validación de expresiones',
                    'Detección de errores sintácticos',
                    'Sugerencias de corrección'
                ],
                semantic: [
                    'Tabla de símbolos',
                    'Verificación de tipos',
                    'Detección de variables no declaradas',
                    'Detección de variables no inicializadas',
                    'Validación de operaciones aritméticas',
                    'Validación de operaciones lógicas',
                    'Validación de operaciones de comparación',
                    'Gestión de scopes (alcances)',
                    'Compatibilidad de tipos'
                ]
            },

            endpoints: [
                {
                    method: 'POST',
                    path: '/api/compiler/compile',
                    description: 'Análisis completo (léxico, sintáctico y semántico)',
                    recommended: true
                },
                {
                    method: 'POST',
                    path: '/api/compiler/quick-analysis',
                    description: 'Análisis rápido (solo léxico y sintáctico)'
                },
                {
                    method: 'POST',
                    path: '/api/compiler/tokenize',
                    description: 'Endpoint legacy (redirige a /compile)'
                },
                {
                    method: 'GET',
                    path: '/api/compiler/health',
                    description: 'Verifica el estado del servidor'
                }
            ],

            supportedTypes: {
                dataTypes: ['int', 'float', 'string', 'boolean', 'none'],
                operators: {
                    arithmetic: ['+', '-', '*', '/', '//', '%', '**'],
                    comparison: ['==', '!=', '<', '>', '<=', '>='],
                    logical: ['and', 'or', 'not'],
                    assignment: ['=', '+=', '-=', '*=', '/=']
                }
            },

            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    }

    /**
     * Endpoint para obtener información de la tabla de símbolos
     * POST /api/compiler/symbol-table
     */
    public static getSymbolTable(req: Request, res: Response): void {
        try {
            const { sourceCode } = req.body;

            if (!sourceCode) {
                res.status(400).json({
                    success: false,
                    error: 'El campo sourceCode es requerido'
                });
                return;
            }

            const lexer = new Lexer(sourceCode);
            const { tokens } = lexer.tokenize();

            const parser = new Parser(tokens);
            const { ast } = parser.parse();

            const semanticAnalyzer = new SemanticAnalyzer();
            const { symbolTable, errors } = semanticAnalyzer.analyze(ast);

            res.json({
                success: true,
                symbolTable: symbolTable.export(),
                symbols: symbolTable.getAllSymbols(),
                errors: errors,
                statistics: {
                    totalSymbols: symbolTable.getAllSymbols().length,
                    currentScope: symbolTable.getCurrentScope()
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                message: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
}