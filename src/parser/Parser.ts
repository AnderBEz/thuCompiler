import { Token } from "../tokens/Token";
import { TokenType } from "../types/TokenType";

export interface ASTNode {
    type: string;
    value?: string;
    children?: ASTNode[];
    token?: Token;
}

export interface ParserError {
    message: string;
    line: number;
    column: number;
    token: Token;
    suggestion: string;
}

export class Parser {
    private tokens: Token[];
    private currentTokenIndex: number;
    private errors: ParserError[];

    constructor(tokens: Token[]) {
        // Filtrar tokens no deseados pero mantener los ERROR para reportarlos
        this.tokens = tokens.filter(token => 
            token.type !== TokenType.UNKNOWN && 
            token.type !== TokenType.COMMENT
        );
        this.currentTokenIndex = 0;
        this.errors = [];
    }

    public parse(): { ast: ASTNode | null, errors: ParserError[] } {
        const statements: ASTNode[] = [];
        
        while (!this.isAtEnd()) {
            try {
                // Saltar newlines al inicio
                while (this.match(TokenType.NEWLINE)) {}
                
                if (this.isAtEnd()) break;
                
                const statement = this.parseStatement();
                if (statement) {
                    statements.push(statement);
                }
                
                // Saltar newlines después del statement
                while (this.match(TokenType.NEWLINE)) {}
                
            } catch (error) {
                this.synchronize();
            }
        }

        const ast: ASTNode = {
            type: 'Program',
            children: statements
        };

        return {
            ast: statements.length > 0 ? ast : null,
            errors: this.errors
        };
    }

    private parseStatement(): ASTNode | null {
        if (this.isAtEnd()) return null;
        
        const token = this.peek();
        
        // Si encontramos un error léxico, reportarlo y saltarlo
        if (token.type === TokenType.ERROR) {
            this.reportError(
                token,
                `Error léxico: ${token.error?.message || 'Carácter no reconocido'}`,
                token.error?.suggestion || "Revise el carácter en esta posición"
            );
            this.advance();
            return null;
        }
        
        // Asignación de variable (identificador seguido de =)
        if (this.check(TokenType.IDENTIFIER) && this.checkNext(TokenType.ASSIGNMENT_OPERATOR)) {
            return this.parseAssignment();
        }
        
        // Expresión simple (solo si es un literal o identificador válido)
        if (this.check(TokenType.IDENTIFIER) || 
            this.check(TokenType.INTEGER) || 
            this.check(TokenType.FLOAT) || 
            this.check(TokenType.STRING) || 
            this.check(TokenType.BOOLEAN) || 
            this.check(TokenType.NONE)) {
            
            // Si es un identificador, verificar que no sea palabra clave en contexto incorrecto
            if (this.check(TokenType.IDENTIFIER)) {
                const identifier = this.peek();
                this.validateIdentifier(identifier);
            }
            
            const expr = this.parseExpression();
            
            // Si después de la expresión hay un =, es un error de sintaxis
            if (this.check(TokenType.ASSIGNMENT_OPERATOR)) {
                throw this.error(
                    this.peek(),
                    "No se puede asignar a un literal",
                    "La asignación debe tener un identificador válido a la izquierda del ="
                );
            }
            
            return expr;
        }
        
        // Palabra clave en contexto incorrecto
        if (this.check(TokenType.KEYWORD)) {
            const keyword = this.peek();
            throw this.error(
                keyword,
                `Palabra clave '${keyword.value}' usada incorrectamente`,
                "Las palabras clave no pueden usarse como identificadores o en este contexto"
            );
        }
        
        throw this.error(this.peek(), "Se esperaba una declaración o expresión válida");
    }

    private parseAssignment(): ASTNode {
        const identifier = this.consume(TokenType.IDENTIFIER, "Se esperaba un identificador");
        
        // Validar identificador
        this.validateIdentifier(identifier);
        
        this.consume(TokenType.ASSIGNMENT_OPERATOR, "Se esperaba '=' después del identificador");
        
        const value = this.parseExpression();
        
        return {
            type: 'Assignment',
            value: identifier.value,
            children: [value],
            token: identifier
        };
    }

    private parseExpression(): ASTNode {
        return this.parsePrimary();
    }

    private parsePrimary(): ASTNode {
        if (this.match(TokenType.IDENTIFIER)) {
            const token = this.previous();
            // Ya validamos en parseStatement, pero por si acaso
            this.validateIdentifier(token);
            return { type: 'Identifier', value: token.value, token };
        }
        
        if (this.match(TokenType.INTEGER)) {
            return { type: 'IntegerLiteral', value: this.previous().value, token: this.previous() };
        }
        
        if (this.match(TokenType.FLOAT)) {
            return { type: 'FloatLiteral', value: this.previous().value, token: this.previous() };
        }
        
        if (this.match(TokenType.STRING)) {
            return { type: 'StringLiteral', value: this.previous().value, token: this.previous() };
        }
        
        if (this.match(TokenType.BOOLEAN)) {
            return { type: 'BooleanLiteral', value: this.previous().value, token: this.previous() };
        }
        
        if (this.match(TokenType.NONE)) {
            return { type: 'NoneLiteral', value: this.previous().value, token: this.previous() };
        }
        
        throw this.error(this.peek(), "Se esperaba una expresión válida");
    }

    // Validación de identificadores
    private validateIdentifier(token: Token): void {
        // Python: no puede empezar con número
        if (/^\d/.test(token.value)) {
            this.reportError(
                token,
                `Identificador inválido: '${token.value}'`,
                "Los identificadores no pueden empezar con un número. Use letras o _"
            );
            return;
        }
        
        // Python: no puede ser una palabra clave
        const pythonKeywords = [
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
            'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
            'except', 'finally', 'for', 'from', 'global', 'if', 'import',
            'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
            'raise', 'return', 'try', 'while', 'with', 'yield'
        ];
        
        if (pythonKeywords.includes(token.value)) {
            this.reportError(
                token,
                `No se puede usar palabra clave como identificador: '${token.value}'`,
                "Elija un nombre que no sea una palabra reservada de Python"
            );
            return;
        }
        
        // Python: solo permite letras, números y _
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token.value)) {
            this.reportError(
                token,
                `Caracteres inválidos en identificador: '${token.value}'`,
                "Use solo letras, números y _ en los identificadores"
            );
        }
    }

    // Métodos auxiliares del parser
    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private checkNext(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        if (this.currentTokenIndex + 1 >= this.tokens.length) return false;
        const nextToken = this.tokens[this.currentTokenIndex + 1];
        return nextToken !== undefined && nextToken.type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.currentTokenIndex++;
        return this.previous();
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        
        throw this.error(this.peek(), message);
    }

    private peek(): Token {
        return this.tokens[this.currentTokenIndex] ?? {
            type: TokenType.EOF,
            value: "",
            line: -1,
            column: -1
        };
    }

    private previous(): Token {
        return this.tokens[this.currentTokenIndex - 1] ?? {
            type: TokenType.EOF,
            value: "",
            line: -1,
            column: -1
        };
    }

    private isAtEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private error(token: Token, message: string, suggestion?: string): Error {
        this.reportError(token, message, suggestion || "Revise la sintaxis de Python");
        return new Error(`Parse Error: ${message}`);
    }

    private reportError(token: Token, message: string, suggestion: string): void {
        this.errors.push({
            message,
            line: token.line,
            column: token.column,
            token,
            suggestion
        });
    }

    private synchronize(): void {
        this.advance();
        
        while (!this.isAtEnd()) {
            if (this.previous().type === TokenType.NEWLINE) return;
            
            if (this.peek().type === TokenType.ERROR) {
                this.advance();
                continue;
            }
            
            // Buscar siguiente declaración válida
            if (this.peek().type === TokenType.IDENTIFIER) {
                if (this.checkNext(TokenType.ASSIGNMENT_OPERATOR)) return;
            }
            
            if (this.check(TokenType.IDENTIFIER) || 
                this.check(TokenType.INTEGER) || 
                this.check(TokenType.FLOAT) || 
                this.check(TokenType.STRING) || 
                this.check(TokenType.BOOLEAN) || 
                this.check(TokenType.NONE)) {
                return;
            }
            
            this.advance();
        }
    }
}