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
    // Propiedades para estructuras de control
    condition?: ASTNode | undefined;
    body?: ASTNode[];
    alternate?: ASTNode[] | undefined;
    initialization?: ASTNode | null | undefined;
    update?: ASTNode | null | undefined;
    // Propiedades para clases y métodos
    className?: string;
    methods?: ASTNode[];
    attributes?: ASTNode[];
    parameters?: Parameter[];
    returnType?: string;
    methodName?: string;
    Symbol?: Symbol[];
}

export interface Parameter {
    name: string;
    type?: string;
    token: Token;
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

        // NUEVAS ESTRUCTURAS DE CONTROL
        if (this.checkKeyword('if')) {
            return this.parseIfStatement();
        }

        if (this.checkKeyword('while')) {
            return this.parseWhileStatement();
        }

        if (this.checkKeyword('for')) {
            return this.parseForStatement();
        }

        // CLASES Y MÉTODOS
        if (this.checkKeyword('class')) {
            return this.parseClassDeclaration();
        }

        if (this.checkKeyword('def')) {
            return this.parseMethodDeclaration();
        }

        // Asignación de variable
        if (this.check(TokenType.IDENTIFIER) && this.checkNext(TokenType.ASSIGNMENT_OPERATOR)) {
            return this.parseAssignment();
        }

        // Parsear expresión
        return this.parseExpression();
    }

    // ============ ESTRUCTURAS DE CONTROL ============

    /**
     * Parsea: class NombreClase { cuerpo }
     */
    private parseClassDeclaration(): ASTNode {
        const classToken = this.consume(TokenType.KEYWORD, "Se esperaba 'class'");

        // Nombre de la clase
        if (!this.check(TokenType.IDENTIFIER)) {
            this.reportError(
                this.peek(),
                "Error: Se esperaba nombre de clase después de 'class'",
                "Sintaxis correcta: class NombreClase { ... }"
            );
            throw new Error("Nombre de clase faltante");
        }

        const className = this.consume(TokenType.IDENTIFIER, "Se esperaba nombre de clase");

        // Llave de apertura
        if (!this.match(TokenType.LBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '{' para iniciar el cuerpo de la clase",
                "Sintaxis correcta: class NombreClase { métodos y atributos }"
            );
            throw new Error("Llave faltante en declaración de clase");
        }

        // Parsear cuerpo de la clase (métodos y atributos)
        const methods: ASTNode[] = [];
        const attributes: ASTNode[] = [];

        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            while (this.match(TokenType.NEWLINE)) { }

            if (this.check(TokenType.RBRACE)) break;

            try {
                // Método
                if (this.checkKeyword('def')) {
                    methods.push(this.parseMethodDeclaration());
                }
                // Atributo de clase
                else if (this.check(TokenType.IDENTIFIER) && this.checkNext(TokenType.ASSIGNMENT_OPERATOR)) {
                    attributes.push(this.parseAssignment());
                }
                else {
                    this.reportError(
                        this.peek(),
                        "Error: Elemento inválido en el cuerpo de la clase",
                        "Solo se permiten métodos (def) y atributos (asignaciones)"
                    );
                    this.advance();
                }
            } catch (error) {
                this.synchronize();
                break;
            }

            while (this.match(TokenType.NEWLINE, TokenType.SEMICOLON)) { }
        }

        // Llave de cierre
        if (!this.match(TokenType.RBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '}' para cerrar el cuerpo de la clase",
                "Cada '{' debe tener su correspondiente '}'"
            );
            throw new Error("Cuerpo de clase inválido");
        }

        return {
            type: 'ClassDeclaration',
            className: className.value,
            methods: methods,
            attributes: attributes,
            token: classToken
        };
    }

    /**
     * Parsea: def nombreMetodo(parametros) { cuerpo }
     */
    private parseMethodDeclaration(): ASTNode {
        const defToken = this.consume(TokenType.KEYWORD, "Se esperaba 'def'");

        // Nombre del método
        if (!this.check(TokenType.IDENTIFIER)) {
            this.reportError(
                this.peek(),
                "Error: Se esperaba nombre de método después de 'def'",
                "Sintaxis correcta: def nombreMetodo(parametros) { ... }"
            );
            throw new Error("Nombre de método faltante");
        }

        const methodName = this.consume(TokenType.IDENTIFIER, "Se esperaba nombre de método");

        // Paréntesis de apertura
        if (!this.match(TokenType.LPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta '(' después del nombre del método",
                "Los métodos deben tener paréntesis: def metodo() { ... }"
            );
            throw new Error("Paréntesis faltantes en declaración de método");
        }

        // Parsear parámetros
        const parameters = this.parseParameterList();

        // Paréntesis de cierre
        if (!this.match(TokenType.RPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta ')' después de los parámetros",
                "Cierre los paréntesis de la lista de parámetros"
            );
            throw new Error("Paréntesis desbalanceados en método");
        }

        // Llave de apertura
        if (!this.match(TokenType.LBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '{' para iniciar el cuerpo del método",
                "Sintaxis correcta: def metodo() { sentencias }"
            );
            throw new Error("Llave faltante en método");
        }

        // Parsear cuerpo del método
        const body = this.parseBlock();

        // Llave de cierre
        if (!this.match(TokenType.RBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '}' para cerrar el cuerpo del método",
                "Cada '{' debe tener su correspondiente '}'"
            );
            throw new Error("Cuerpo de método incompleto");
        }

        return {
            type: 'MethodDeclaration',
            methodName: methodName.value,
            parameters: parameters,
            body: body,
            token: defToken
        };
    }

    /**
     * Parsea lista de parámetros: (param1, param2, param3)
     */
    private parseParameterList(): Parameter[] {
        const parameters: Parameter[] = [];

        // Lista vacía
        if (this.check(TokenType.RPAREN)) {
            return parameters;
        }

        do {
            // Saltar comas extras
            while (this.match(TokenType.NEWLINE)) { }

            if (this.check(TokenType.RPAREN)) break;

            // Parsear parámetro
            if (!this.check(TokenType.IDENTIFIER)) {
                this.reportError(
                    this.peek(),
                    "Error: Parámetro inválido en la declaración de método",
                    "Los parámetros deben ser identificadores válidos"
                );
                throw new Error("Parámetro inválido");
            }

            const paramToken = this.consume(TokenType.IDENTIFIER, "Se esperaba nombre de parámetro");

            parameters.push({
                name: paramToken.value,
                token: paramToken
            });

            // Saltar newlines después del parámetro
            while (this.match(TokenType.NEWLINE)) { }

        } while (this.match(TokenType.COMMA));

        return parameters;
    }

    /**
     * Parsea: if (condicion) { bloque } else { bloque }
     * Sintaxis simplificada con llaves para compatibilidad
     */
    private parseIfStatement(): ASTNode {
        const ifToken = this.consume(TokenType.KEYWORD, "Se esperaba 'if'");

        // Consumir paréntesis de apertura
        if (!this.match(TokenType.LPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta '(' después de 'if'",
                "Sintaxis correcta: if (condicion) { ... }"
            );
            throw new Error("Paréntesis faltante después de 'if'");
        }

        // Parsear condición
        let condition: ASTNode;
        try {
            condition = this.parseExpression();
        } catch (error) {
            this.reportError(
                this.peek(),
                "Error: Condición inválida en la estructura 'if'",
                "La condición debe ser una expresión válida (ej: x > 0)"
            );
            throw error;
        }

        // Consumir paréntesis de cierre
        if (!this.match(TokenType.RPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta ')' después de la condición del 'if'",
                "Asegúrese de cerrar los paréntesis de la condición"
            );
            throw new Error("Paréntesis desbalanceados en 'if'");
        }

        // Consumir llave de apertura
        if (!this.match(TokenType.LBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '{' para iniciar el bloque del 'if'",
                "Sintaxis correcta: if (condicion) { sentencias }"
            );
            throw new Error("Llave faltante en 'if'");
        }

        // Parsear bloque then
        const thenBlock = this.parseBlock();

        // Consumir llave de cierre
        if (!this.match(TokenType.RBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '}' para cerrar el bloque del 'if'",
                "Cada '{' debe tener su correspondiente '}'"
            );
            throw new Error("Bloque de sentencias faltante en 'if'");
        }

        // Parsear else opcional
        let elseBlock: ASTNode[] | undefined;
        if (this.checkKeyword('else')) {
            this.advance(); // consumir 'else'

            if (!this.match(TokenType.LBRACE)) {
                this.reportError(
                    this.peek(),
                    "Error: Falta '{' para iniciar el bloque del 'else'",
                    "Sintaxis correcta: else { sentencias }"
                );
                throw new Error("Llave faltante en 'else'");
            }

            elseBlock = this.parseBlock();

            if (!this.match(TokenType.RBRACE)) {
                this.reportError(
                    this.peek(),
                    "Error: Falta '}' para cerrar el bloque del 'else'",
                    "Cada '{' debe tener su correspondiente '}'"
                );
                throw new Error("Bloque de sentencias faltante en 'else'");
            }
        }

        return {
            type: 'IfStatement',
            condition: condition,
            body: thenBlock,
            alternate: elseBlock,
            token: ifToken
        };
    }

    /**
     * Parsea: while (condicion) { bloque }
     */
    private parseWhileStatement(): ASTNode {
        const whileToken = this.consume(TokenType.KEYWORD, "Se esperaba 'while'");

        // Consumir paréntesis de apertura
        if (!this.match(TokenType.LPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta '(' después de 'while'",
                "Sintaxis correcta: while (condicion) { ... }"
            );
            throw new Error("Paréntesis faltante después de 'while'");
        }

        // Parsear condición
        let condition: ASTNode;
        try {
            condition = this.parseExpression();
        } catch (error) {
            this.reportError(
                this.peek(),
                "Error: Condición inválida en la estructura 'while'",
                "La condición debe ser una expresión válida (ej: y < 10)"
            );
            throw error;
        }

        // Consumir paréntesis de cierre
        if (!this.match(TokenType.RPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta ')' después de la condición del 'while'",
                "Asegúrese de cerrar los paréntesis de la condición"
            );
            throw new Error("Paréntesis desbalanceados en 'while'");
        }

        // Consumir llave de apertura
        if (!this.match(TokenType.LBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '{' para iniciar el bloque del 'while'",
                "Sintaxis correcta: while (condicion) { sentencias }"
            );
            throw new Error("Llave faltante en 'while'");
        }

        // Parsear bloque
        const body = this.parseBlock();

        // Consumir llave de cierre
        if (!this.match(TokenType.RBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '}' para cerrar el bloque del 'while'",
                "Cada '{' debe tener su correspondiente '}'"
            );
            throw new Error("Bloque de sentencias faltante en 'while'");
        }

        return {
            type: 'WhileStatement',
            condition: condition,
            body: body,
            token: whileToken
        };
    }

    /**
     * Parsea: for (inicializacion; condicion; actualizacion) { bloque }
     */
    private parseForStatement(): ASTNode {
        const forToken = this.consume(TokenType.KEYWORD, "Se esperaba 'for'");

        // Consumir paréntesis de apertura
        if (!this.match(TokenType.LPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta '(' después de 'for'",
                "Sintaxis correcta: for (i = 0; i < 10; i = i + 1) { ... }"
            );
            throw new Error("Paréntesis faltante después de 'for'");
        }

        // Parsear inicialización
        let initialization: ASTNode | null = null;
        try {
            if (!this.check(TokenType.SEMICOLON)) {
                initialization = this.parseAssignment();
            }
        } catch (error) {
            this.reportError(
                this.peek(),
                "Error: Inicialización inválida en la estructura 'for'",
                "La inicialización debe ser una asignación válida (ej: i = 0)"
            );
            throw error;
        }

        // Consumir primer punto y coma
        if (!this.match(TokenType.SEMICOLON)) {
            this.reportError(
                this.peek(),
                "Error: Falta ';' después de la inicialización del 'for'",
                "Sintaxis correcta: for (inicializacion; condicion; actualizacion)"
            );
            throw new Error("Componente inválido en 'for'");
        }

        // Parsear condición
        let condition: ASTNode | null = null;
        try {
            if (!this.check(TokenType.SEMICOLON)) {
                condition = this.parseExpression();
            }
        } catch (error) {
            this.reportError(
                this.peek(),
                "Error: Condición inválida en la estructura 'for'",
                "La condición debe ser una expresión válida (ej: i < 10)"
            );
            throw error;
        }

        // Consumir segundo punto y coma
        if (!this.match(TokenType.SEMICOLON)) {
            this.reportError(
                this.peek(),
                "Error: Falta ';' después de la condición del 'for'",
                "Sintaxis correcta: for (inicializacion; condicion; actualizacion)"
            );
            throw new Error("Componente inválido en 'for'");
        }

        // Parsear actualización
        let update: ASTNode | null = null;
        try {
            if (!this.check(TokenType.RPAREN)) {
                update = this.parseAssignment();
            }
        } catch (error) {
            this.reportError(
                this.peek(),
                "Error: Actualización inválida en la estructura 'for'",
                "La actualización debe ser una asignación válida (ej: i = i + 1)"
            );
            throw error;
        }

        // Consumir paréntesis de cierre
        if (!this.match(TokenType.RPAREN)) {
            this.reportError(
                this.peek(),
                "Error: Falta ')' después de los componentes del 'for'",
                "Asegúrese de cerrar los paréntesis del for"
            );
            throw new Error("Paréntesis desbalanceados en 'for'");
        }

        // Consumir llave de apertura
        if (!this.match(TokenType.LBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '{' para iniciar el bloque del 'for'",
                "Sintaxis correcta: for (...) { sentencias }"
            );
            throw new Error("Llave faltante en 'for'");
        }

        // Parsear bloque
        const body = this.parseBlock();

        // Consumir llave de cierre
        if (!this.match(TokenType.RBRACE)) {
            this.reportError(
                this.peek(),
                "Error: Falta '}' para cerrar el bloque del 'for'",
                "Cada '{' debe tener su correspondiente '}'"
            );
            throw new Error("Bloque de sentencias faltante en 'for'");
        }

        return {
            type: 'ForStatement',
            initialization: initialization ?? undefined,
            condition: condition ?? undefined,
            update: update ?? undefined,
            body: body,
            token: forToken
        };
    }

    /**
     * Parsea un bloque de sentencias dentro de llaves
     * Retorna un array de ASTNode
     */
    private parseBlock(): ASTNode[] {
        const statements: ASTNode[] = [];

        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            // Saltar newlines dentro del bloque
            while (this.match(TokenType.NEWLINE)) { }

            if (this.check(TokenType.RBRACE)) break;

            try {
                const statement = this.parseStatement();
                if (statement) {
                    statements.push(statement);
                }
            } catch (error) {
                this.synchronize();
                break;
            }

            // Permitir newlines o punto y coma después de sentencias
            while (this.match(TokenType.NEWLINE, TokenType.SEMICOLON)) { }
        }

        return statements;
    }

    // ============ MÉTODOS EXISTENTES ============

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

        if (this.match(TokenType.LPAREN)) {
            const expr = this.parseExpression();
            this.consume(TokenType.RPAREN, "Se esperaba ')' después de la expresión");
            return expr;
        }

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

    // ============ MÉTODOS AUXILIARES ============

    private checkKeyword(keyword: string): boolean {
        if (this.isAtEnd()) return false;
        const token = this.peek();
        return token.type === TokenType.KEYWORD && token.value === keyword;
    }

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