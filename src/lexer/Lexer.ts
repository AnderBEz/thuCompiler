import { Token } from '../tokens/Token';
import { TokenType } from '../types/TokenType';

export class Lexer {
    private input: string;
    private position: number;
    private line: number;
    private column: number;
    private currentChar: string;
    private errors: Token[] = [];

    // Palabras clave de Python
    private readonly KEYWORDS = [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
        'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
        'except', 'finally', 'for', 'from', 'global', 'if', 'import',
        'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
        'raise', 'return', 'try', 'while', 'with', 'yield'
    ];

    private readonly BOOLEANS = ['True', 'False'];
    private readonly NONE = ['None'];

    private readonly PATTERNS: { type: TokenType; regex: RegExp }[] = [
        // Espacios en blanco
        { type: TokenType.UNKNOWN, regex: /^[ \t]+/ },

        // Newlines
        { type: TokenType.NEWLINE, regex: /^\n/ },

        // Comentarios
        { type: TokenType.COMMENT, regex: /^#.*/ },

        // Docstrings
        { type: TokenType.STRING, regex: /^"""[^]*?"""/ },
        { type: TokenType.STRING, regex: /^'''[^]*?'''/ },

        // Strings
        { type: TokenType.STRING, regex: /^'([^'\\]|\\.)*'/ },
        { type: TokenType.STRING, regex: /^"([^"\\]|\\.)*"/ },

        // Números flotantes
        { type: TokenType.FLOAT, regex: /^\d+\.\d+([eE][-+]?\d+)?/ },
        { type: TokenType.FLOAT, regex: /^\d+[eE][-+]?\d+/ },

        // Números enteros
        { type: TokenType.INTEGER, regex: /^0[bB][01]+/ },
        { type: TokenType.INTEGER, regex: /^0[oO][0-7]+/ },
        { type: TokenType.INTEGER, regex: /^0[xX][0-9a-fA-F]+/ },
        { type: TokenType.INTEGER, regex: /^\d+/ },

        // Operadores de asignación
        { type: TokenType.ASSIGNMENT_OPERATOR, regex: /^(\+=|-=|\*=|%=|&=|\|=|\^=|<<=|>>=|\*\*=|\/\/=)/ },

        // Operadores aritméticos
        { type: TokenType.ARITHMETIC_OPERATOR, regex: /^(\+|\-|\*|%|\*\*|\/\/)/ },

        // Operadores de comparación
        { type: TokenType.COMPARISON_OPERATOR, regex: /^(==|!=|<=|>=|<|>)/ },

        // Operadores lógicos
        { type: TokenType.LOGICAL_OPERATOR, regex: /^(and|or|not)/ },

        // Operadores de identidad
        { type: TokenType.IDENTITY_OPERATOR, regex: /^(is)/ },

        // Operadores de membresía
        { type: TokenType.MEMBERSHIP_OPERATOR, regex: /^(in)/ },

        // Operadores bit a bit
        { type: TokenType.BITWISE_OPERATOR, regex: /^(&|\||\^|~|<<|>>)/ },

        // Asignación simple
        { type: TokenType.ASSIGNMENT_OPERATOR, regex: /^=/ },

        // División simple
        { type: TokenType.ARITHMETIC_OPERATOR, regex: /^\// },

        // Flecha para funciones
        { type: TokenType.ARROW, regex: /^->/ },

        // Símbolos
        { type: TokenType.LPAREN, regex: /^\(/ },
        { type: TokenType.RPAREN, regex: /^\)/ },
        { type: TokenType.LBRACKET, regex: /^\[/ },
        { type: TokenType.RBRACKET, regex: /^\]/ },
        { type: TokenType.LBRACE, regex: /^\{/ },
        { type: TokenType.RBRACE, regex: /^\}/ },
        { type: TokenType.COMMA, regex: /^,/ },
        { type: TokenType.COLON, regex: /^:/ },
        { type: TokenType.SEMICOLON, regex: /^;/ },
        { type: TokenType.DOT, regex: /^\./ },

        // Identificadores
        { type: TokenType.IDENTIFIER, regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ }
    ];

    constructor(input: string) {
        this.input = input;
        this.position = 0;
        this.line = 1;
        this.column = 1;
        this.currentChar = this.input.length > 0 ? this.input[0] ?? '' : '';
        this.errors = [];
    }

    // Método principal que devuelve tokens y errores
    public tokenize(): { tokens: Token[], errors: Token[] } {
        const tokens: Token[] = [];
        this.errors = [];

        while (this.position < this.input.length) {
            const token = this.getNextToken();
            if (token.type !== TokenType.UNKNOWN) {
                let finalType = token.type;
                if (token.type === TokenType.IDENTIFIER) {
                    if (this.BOOLEANS.includes(token.value)) {
                        finalType = TokenType.BOOLEAN;
                    } else if (this.NONE.includes(token.value)) {
                        finalType = TokenType.NONE;
                    } else if (this.KEYWORDS.includes(token.value)) {
                        finalType = TokenType.KEYWORD;
                    }
                }

                tokens.push({
                    ...token,
                    type: finalType
                });
            }
        }

        tokens.push({
            type: TokenType.EOF,
            value: 'EOF',
            line: this.line,
            column: this.column
        });

        return {
            tokens,
            errors: this.errors
        };
    }

    // Método compatible con versión anterior (solo tokens)
    public getTokens(): Token[] {
        const result = this.tokenize();
        return result.tokens;
    }

    private getNextToken(): Token {
        for (const pattern of this.PATTERNS) {
            const match = this.input.substring(this.position).match(pattern.regex);

            if (match && match[0].length > 0) {
                const value = match[0];
                const startColumn = this.column;

                // Validar strings antes de procesarlas
                if (pattern.type === TokenType.STRING) {
                    const stringError = this.validateString(value);
                    if (stringError) {
                        this.advance(value.length);
                        return this.createErrorToken(value, startColumn, stringError.message, stringError.suggestion);
                    }
                }

                this.advance(value.length);

                if (pattern.type === TokenType.UNKNOWN) {
                    return this.getNextToken();
                }

                return {
                    type: pattern.type,
                    value: value,
                    line: this.line,
                    column: startColumn
                };
            }
        }

        // Carácter no reconocido - ERROR LÉXICO
        const unknownChar = this.currentChar;
        const startColumn = this.column;
        this.advance(1);

        return this.createErrorToken(
            unknownChar,
            startColumn,
            `Carácter no reconocido: '${unknownChar}'`,
            `Caracteres válidos: letras, números, operadores (+, -, *, /, etc.) y símbolos`
        );
    }

    // Validación de strings para detectar errores
    private validateString(value: string): { message: string; suggestion: string } | null {
        // Verificar si la cadena no está cerrada
        if ((value.startsWith('"') && !value.endsWith('"')) ||
            (value.startsWith("'") && !value.endsWith("'"))) {
            return {
                message: "Cadena no cerrada correctamente",
                suggestion: "Asegúrate de cerrar la cadena con la misma comilla que usaste para abrirla"
            };
        }

        // Verificar escapes inválidos en strings normales (no docstrings)
        if (!value.startsWith('"""') && !value.startsWith("'''")) {
            const invalidEscape = value.match(/\\([^"\\'abfnrtv0])/);
            if (invalidEscape) {
                return {
                    message: `Secuencia de escape inválida: \\${invalidEscape[1]}`,
                    suggestion: "Secuencias de escape válidas: \\\", \\', \\\\, \\n, \\t, \\r, \\b, \\f, \\v, \\0"
                };
            }
        }

        return null;
    }

    // Crear token de error
    private createErrorToken(value: string, column: number, message: string, suggestion?: string): Token {
        const errorToken: Token = {
            type: TokenType.ERROR,
            value: value,
            line: this.line,
            column: column,
            error: {
                message,
                suggestion: suggestion || "Revisa la sintaxis del código"
            }
        };

        this.errors.push(errorToken);
        return errorToken;
    }

    private advance(steps: number): void {
        for (let i = 0; i < steps; i++) {
            if (this.currentChar === '\n') {
                this.line++;
                this.column = 1;
            } else {
                this.column++;
            }

            this.position++;

            if (this.position < this.input.length) {
                const nextChar = this.input[this.position];
                this.currentChar = nextChar ?? '';
            } else {
                this.currentChar = '';
            }
        }
    }
}