import { Token } from "../tokens/Token";
import { TokenType } from "../types/TokenType";

export interface ASTNode {
    type: string;
    value?: string;
    children?: ASTNode[];
    token?: Token;
    operator?: string;
    left?: ASTNode;
    right?: ASTNode;
    operand?: ASTNode;
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
                while (this.match(TokenType.NEWLINE)) { }

                if (this.isAtEnd()) break;

                const statement = this.parseStatement();
                if (statement) {
                    statements.push(statement);
                }

                while (this.match(TokenType.NEWLINE)) { }

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

        if (token.type === TokenType.ERROR) {
            this.reportError(
                token,
                `Error léxico: ${token.error?.message || 'Carácter no reconocido'}`,
                token.error?.suggestion || "Revise el carácter en esta posición"
            );
            this.advance();
            return null;
        }

        // Asignación de variable
        if (this.check(TokenType.IDENTIFIER) && this.checkNext(TokenType.ASSIGNMENT_OPERATOR)) {
            return this.parseAssignment();
        }

        // Parsear expresión
        return this.parseExpression();
    }

    private parseAssignment(): ASTNode {
        const identifier = this.consume(TokenType.IDENTIFIER, "Se esperaba un identificador");
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

    // GRAMÁTICA JERÁRQUICA CORREGIDA
    private parseExpression(): ASTNode {
        return this.parseLogicalOr();
    }

    private parseLogicalOr(): ASTNode {
        let expr = this.parseLogicalAnd();

        while (this.matchOperator(TokenType.LOGICAL_OPERATOR, 'or')) {
            const operator = this.previous();
            const right = this.parseLogicalAnd();
            expr = {
                type: 'LogicalExpression',
                operator: operator.value,
                left: expr,
                right: right,
                token: operator
            };
        }

        return expr;
    }

    private parseLogicalAnd(): ASTNode {
        let expr = this.parseComparison();

        while (this.matchOperator(TokenType.LOGICAL_OPERATOR, 'and')) {
            const operator = this.previous();
            const right = this.parseComparison();
            expr = {
                type: 'LogicalExpression',
                operator: operator.value,
                left: expr,
                right: right,
                token: operator
            };
        }

        return expr;
    }

    private parseComparison(): ASTNode {
        let expr = this.parseArithmetic();

        while (this.match(
            TokenType.COMPARISON_OPERATOR,
            TokenType.IDENTITY_OPERATOR,
            TokenType.MEMBERSHIP_OPERATOR
        )) {
            const operator = this.previous();
            const right = this.parseArithmetic();
            expr = {
                type: 'ComparisonExpression',
                operator: operator.value,
                left: expr,
                right: right,
                token: operator
            };
        }

        return expr;
    }

    private parseArithmetic(): ASTNode {
        let expr = this.parseTerm();

        while (this.matchOperator(TokenType.ARITHMETIC_OPERATOR, ['+', '-'])) {
            const operator = this.previous();
            const right = this.parseTerm();
            expr = {
                type: 'BinaryExpression',
                operator: operator.value,
                left: expr,
                right: right,
                token: operator
            };
        }

        return expr;
    }

    private parseTerm(): ASTNode {
        let expr = this.parseFactor();

        while (this.matchOperator(TokenType.ARITHMETIC_OPERATOR, ['*', '/', '//', '%'])) {
            const operator = this.previous();
            const right = this.parseFactor();
            expr = {
                type: 'BinaryExpression',
                operator: operator.value,
                left: expr,
                right: right,
                token: operator
            };
        }

        return expr;
    }

    private parseFactor(): ASTNode {
        // Operadores unarios
        if (this.matchOperator(TokenType.ARITHMETIC_OPERATOR, ['+', '-'])) {
            const operator = this.previous();
            const expr = this.parseFactor();
            return {
                type: 'UnaryExpression',
                operator: operator.value,
                operand: expr,
                token: operator
            };
        }

        if (this.matchOperator(TokenType.LOGICAL_OPERATOR, 'not')) {
            const operator = this.previous();
            const expr = this.parseFactor();
            return {
                type: 'UnaryExpression',
                operator: operator.value,
                operand: expr,
                token: operator
            };
        }

        // Paréntesis
        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Se esperaba ')' después de la expresión");
            return expr;
        }

        // Literales e identificadores
        return this.parsePrimary();
    }

    private parsePrimary(): ASTNode {
        if (this.match(TokenType.IDENTIFIER)) {
            const token = this.previous();
            this.validateIdentifier(token);
            return {
                type: 'Identifier',
                value: token.value,
                token
            };
        }

        if (this.match(TokenType.INTEGER)) {
            return {
                type: 'IntegerLiteral',
                value: this.previous().value,
                token: this.previous()
            };
        }

        if (this.match(TokenType.FLOAT)) {
            return {
                type: 'FloatLiteral',
                value: this.previous().value,
                token: this.previous()
            };
        }

        if (this.match(TokenType.STRING)) {
            return {
                type: 'StringLiteral',
                value: this.previous().value,
                token: this.previous()
            };
        }

        if (this.match(TokenType.BOOLEAN)) {
            return {
                type: 'BooleanLiteral',
                value: this.previous().value,
                token: this.previous()
            };
        }

        if (this.match(TokenType.NONE)) {
            return {
                type: 'NoneLiteral',
                value: this.previous().value,
                token: this.previous()
            };
        }

        throw this.error(this.peek(), "Se esperaba una expresión válida");
    }

    // NUEVO MÉTODO PARA MATCH DE OPERADORES ESPECÍFICOS
    private matchOperator(type: TokenType, expectedValues: string | string[]): boolean {
        if (!this.check(type)) return false;

        const current = this.peek();
        const values = Array.isArray(expectedValues) ? expectedValues : [expectedValues];

        if (values.includes(current.value)) {
            this.advance();
            return true;
        }

        return false;
    }

    // Validación de identificadores (sin cambios)
    private validateIdentifier(token: Token): void {
        if (/^\d/.test(token.value)) {
            this.reportError(
                token,
                `Identificador inválido: '${token.value}'`,
                "Los identificadores no pueden empezar con un número. Use letras o _"
            );
            return;
        }

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

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token.value)) {
            this.reportError(
                token,
                `Caracteres inválidos en identificador: '${token.value}'`,
                "Use solo letras, números y _ en los identificadores"
            );
        }
    }

    // Métodos auxiliares (sin cambios)
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

            if (this.peek().type === TokenType.IDENTIFIER) {
                if (this.checkNext(TokenType.ASSIGNMENT_OPERATOR)) return;
            }

            this.advance();
        }
    }
}