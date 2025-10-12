import { Token } from '../tokens/Token';
import { TokenType } from '../types/tokenType';

export class Lexer {
    private input: string;
    private position: number;
    private line: number;
    private column: number;
    private currentChar: string;

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
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];

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

        return tokens;
    }

    private getNextToken(): Token {
        for (const pattern of this.PATTERNS) {
            const match = this.input.substring(this.position).match(pattern.regex);

            if (match && match[0].length > 0) {
                const value = match[0];
                const startColumn = this.column;

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

        const unknownChar = this.currentChar;
        this.advance(1);

        return {
            type: TokenType.UNKNOWN,
            value: unknownChar,
            line: this.line,
            column: this.column - 1
        };
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

            // CORRECCIÓN: Manejo seguro del currentChar
            if (this.position < this.input.length) {
                const nextChar = this.input[this.position];
                this.currentChar = nextChar ?? '';
            } else {
                this.currentChar = '';
            }
        }
    }
}