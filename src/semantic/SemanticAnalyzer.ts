import { ASTNode } from "../parser/Parser";
import { SymbolTable, DataType, SymbolType, Scope, SemanticError, Symbol } from "./SymbolTable"

/**
 * Analizador Semántico
 * Realiza análisis semántico completo del AST
 */
export class SemanticAnalyzer {
    private symbolTable: SymbolTable;
    private errors: SemanticError[];
    private currentFunction: string | null;

    constructor() {
        this.symbolTable = new SymbolTable();
        this.errors = [];
        this.currentFunction = null;
    }

    /**
     * Analiza el AST completo
     */
    public analyze(ast: ASTNode | null): {
        symbolTable: SymbolTable;
        errors: SemanticError[];
        success: boolean;
    } {
        this.symbolTable.reset();
        this.errors = [];

        if (!ast) {
            return {
                symbolTable: this.symbolTable,
                errors: [],
                success: true
            };
        }

        try {
            this.analyzeNode(ast);
        } catch (error) {
            console.error('Error during semantic analysis:', error);
        }

        // Combinar errores de la tabla de símbolos
        this.errors.push(...this.symbolTable.getErrors());

        return {
            symbolTable: this.symbolTable,
            errors: this.errors,
            success: this.errors.length === 0
        };
    }

    /**
     * Analiza un nodo del AST recursivamente
     */
    private analyzeNode(node: ASTNode): DataType {
        switch (node.type) {
            case 'Program':
                return this.analyzeProgram(node);

            case 'Assignment':
                return this.analyzeAssignment(node);

            case 'BinaryExpression':
                return this.analyzeBinaryExpression(node);

            case 'UnaryExpression':
                return this.analyzeUnaryExpression(node);

            case 'LogicalExpression':
                return this.analyzeLogicalExpression(node);

            case 'ComparisonExpression':
                return this.analyzeComparisonExpression(node);

            case 'IfStatement':
                return this.analyzeIfStatement(node);

            case 'WhileStatement':
                return this.analyzeWhileStatement(node);

            case 'ForStatement':
                return this.analyzeForStatement(node);

            case 'ClassDeclaration':
                return this.analyzeClassDeclaration(node);

            case 'MethodDeclaration':
                return this.analyzeMethodDeclaration(node);

            case 'Identifier':
                return this.analyzeIdentifier(node);

            case 'IntegerLiteral':
                return DataType.INT;

            case 'FloatLiteral':
                return DataType.FLOAT;

            case 'StringLiteral':
                return DataType.STRING;

            case 'BooleanLiteral':
                return DataType.BOOLEAN;

            case 'NoneLiteral':
                return DataType.NONE;

            default:
                return DataType.UNKNOWN;
        }
    }

    /**
     * Analiza el programa completo
     */
    private analyzeProgram(node: ASTNode): DataType {
        if (node.children) {
            for (const child of node.children) {
                this.analyzeNode(child);
            }
        }
        return DataType.NONE;
    }

    /**
     * Analiza una asignación
     */
    private analyzeAssignment(node: ASTNode): DataType {
        const varName = node.value ?? '';
        const token = node.token;

        if (!token) {
            return DataType.UNKNOWN;
        }

        // Obtener el tipo del valor asignado
        let valueType = DataType.UNKNOWN;
        if (node.children && node.children.length > 0 && node.children[0]) {
            valueType = this.analyzeNode(node.children[0]);
        }

        // Verificar si la variable ya existe
        const existingSymbol = this.symbolTable.lookup(varName);

        if (existingSymbol) {
            // Variable ya declarada - validar tipo
            this.symbolTable.checkTypeCompatibility(
                existingSymbol.dataType,
                valueType,
                token.line,
                token.column
            );

            // Marcar como inicializada
            this.symbolTable.markInitialized(varName);
        } else {
            // Nueva variable - inferir tipo y declarar
            const symbol: Symbol = {
                name: varName,
                type: SymbolType.VARIABLE,
                dataType: valueType,
                scope: this.currentFunction ? Scope.LOCAL : Scope.GLOBAL,
                line: token.line,
                column: token.column,
                initialized: true
            };

            this.symbolTable.insert(symbol);
        }

        return valueType;
    }

    /**
     * Analiza una expresión binaria (aritmética)
     */
    private analyzeBinaryExpression(node: ASTNode): DataType {
        if (!node.left || !node.right || !node.operator) {
            return DataType.UNKNOWN;
        }

        const leftType = this.analyzeNode(node.left);
        const rightType = this.analyzeNode(node.right);
        const token = node.token;

        if (!token) {
            return DataType.UNKNOWN;
        }

        // Validar operación aritmética
        const resultType = this.symbolTable.validateArithmeticOperation(
            leftType,
            rightType,
            node.operator,
            token.line,
            token.column
        );

        return resultType ?? DataType.UNKNOWN;
    }

    /**
     * Analiza una expresión unaria
     */
    private analyzeUnaryExpression(node: ASTNode): DataType {
        if (!node.operand || !node.operator) {
            return DataType.UNKNOWN;
        }

        const operandType = this.analyzeNode(node.operand);
        const token = node.token;

        if (!token) {
            return operandType;
        }

        // Validar operador unario
        if (node.operator === '+' || node.operator === '-') {
            if (operandType !== DataType.INT && operandType !== DataType.FLOAT) {
                this.addError({
                    type: 'semantic',
                    category: 'invalid_operation',
                    message: `Operador unario '${node.operator}' no válido para tipo '${operandType}'`,
                    line: token.line,
                    column: token.column,
                    suggestion: 'Use operador unario solo con tipos numéricos'
                });
                return DataType.UNKNOWN;
            }
            return operandType;
        }

        if (node.operator === 'not') {
            // Python permite 'not' con cualquier tipo (truthiness)
            return DataType.BOOLEAN;
        }

        return operandType;
    }

    /**
     * Analiza una expresión lógica (and, or)
     */
    private analyzeLogicalExpression(node: ASTNode): DataType {
        if (!node.left || !node.right || !node.operator) {
            return DataType.UNKNOWN;
        }

        const leftType = this.analyzeNode(node.left);
        const rightType = this.analyzeNode(node.right);
        const token = node.token;

        if (!token) {
            return DataType.BOOLEAN;
        }

        // Validar operación lógica
        const resultType = this.symbolTable.validateLogicalOperation(
            leftType,
            rightType,
            node.operator,
            token.line,
            token.column
        );

        return resultType ?? DataType.BOOLEAN;
    }

    /**
     * Analiza una expresión de comparación
     */
    private analyzeComparisonExpression(node: ASTNode): DataType {
        if (!node.left || !node.right || !node.operator) {
            return DataType.UNKNOWN;
        }

        const leftType = this.analyzeNode(node.left);
        const rightType = this.analyzeNode(node.right);
        const token = node.token;

        if (!token) {
            return DataType.BOOLEAN;
        }

        // Validar operación de comparación
        const resultType = this.symbolTable.validateComparisonOperation(
            leftType,
            rightType,
            node.operator,
            token.line,
            token.column
        );

        return resultType ?? DataType.BOOLEAN;
    }

    /**
     * Analiza un identificador (uso de variable)
     */
    private analyzeIdentifier(node: ASTNode): DataType {
        const varName = node.value ?? '';
        const token = node.token;

        if (!token) {
            return DataType.UNKNOWN;
        }

        // Verificar si la variable está declarada
        const symbol = this.symbolTable.lookup(varName);

        if (!symbol) {
            this.addError({
                type: 'semantic',
                category: 'undefined_variable',
                message: `Variable '${varName}' no declarada`,
                line: token.line,
                column: token.column,
                suggestion: `Declare la variable antes de usarla: ${varName} = valor`
            });
            return DataType.UNKNOWN;
        }

        // Verificar si está inicializada
        if (!symbol.initialized) {
            this.addError({
                type: 'semantic',
                category: 'uninitialized_variable',
                message: `Variable '${varName}' usada antes de ser inicializada`,
                line: token.line,
                column: token.column,
                suggestion: `Asigne un valor a '${varName}' antes de usarla`
            });
        }

        return symbol.dataType;
    }

    /**
     * Analiza una estructura IF
     */
    private analyzeIfStatement(node: ASTNode): DataType {
        // Analizar condición
        if (node.condition) {
            const conditionType = this.analyzeNode(node.condition);
            const token = node.token;

            // Validar que la condición sea booleana o convertible
            if (conditionType !== DataType.BOOLEAN &&
                conditionType !== DataType.UNKNOWN &&
                token) {
                this.addError({
                    type: 'semantic',
                    category: 'type_mismatch',
                    message: `Condición del 'if' debe ser booleana, se encontró '${conditionType}'`,
                    line: token.line,
                    column: token.column,
                    suggestion: 'Use una expresión de comparación (x > 0, x == y, etc.)'
                });
            }
        }

        // Analizar bloque then
        if (node.body) {
            this.symbolTable.enterScope('if-then');
            for (const statement of node.body) {
                this.analyzeNode(statement);
            }
            this.symbolTable.exitScope();
        }

        // Analizar bloque else (si existe)
        if (node.alternate) {
            this.symbolTable.enterScope('if-else');
            for (const statement of node.alternate) {
                this.analyzeNode(statement);
            }
            this.symbolTable.exitScope();
        }

        return DataType.NONE;
    }

    /**
     * Analiza una estructura WHILE
     */
    private analyzeWhileStatement(node: ASTNode): DataType {
        // Analizar condición
        if (node.condition) {
            const conditionType = this.analyzeNode(node.condition);
            const token = node.token;

            if (conditionType !== DataType.BOOLEAN &&
                conditionType !== DataType.UNKNOWN &&
                token) {
                this.addError({
                    type: 'semantic',
                    category: 'type_mismatch',
                    message: `Condición del 'while' debe ser booleana, se encontró '${conditionType}'`,
                    line: token.line,
                    column: token.column,
                    suggestion: 'Use una expresión de comparación'
                });
            }
        }

        // Analizar cuerpo del while
        if (node.body) {
            this.symbolTable.enterScope('while');
            for (const statement of node.body) {
                this.analyzeNode(statement);
            }
            this.symbolTable.exitScope();
        }

        return DataType.NONE;
    }

    /**
     * Analiza una declaración de clase
     */
    private analyzeClassDeclaration(node: ASTNode): DataType {
        const className = node.className ?? '';
        const token = node.token;

        if (!token) {
            return DataType.UNKNOWN;
        }

        // Verificar que el nombre no esté ya usado
        const existing = this.symbolTable.lookup(className);
        if (existing) {
            this.addError({
                type: 'semantic',
                category: 'redeclaration',
                message: `La clase '${className}' ya está declarada`,
                line: token.line,
                column: token.column,
                suggestion: 'Use un nombre diferente para la clase'
            });
            return DataType.UNKNOWN;
        }

        // Registrar la clase en la tabla de símbolos
        const classSymbol: Symbol = {
            name: className,
            type: SymbolType.CLASS,
            dataType: DataType.UNKNOWN,
            scope: Scope.GLOBAL,
            line: token.line,
            column: token.column,
            initialized: true,
            methods: [],
            attributes: []
        };

        this.symbolTable.insert(classSymbol);

        // Entrar al scope de la clase
        this.symbolTable.enterScope(`class:${className}`);

        // Analizar atributos
        if (node.attributes) {
            for (const attr of node.attributes) {
                this.analyzeNode(attr);
            }
            classSymbol.attributes = node.attributes.map(attr => ({
                name: attr.value || "unknown",
                dataType: this.mapStringToDataType(attr.returnType),
                scope: this.getScopeType(this.symbolTable.getCurrentScope()),
                line: attr.token?.line || 0,
                column: attr.token?.column || 0,
                type: SymbolType.VARIABLE,
                initialized: true
            }));
        }

        // Analizar métodos
        if (node.methods) {
            for (const method of node.methods) {
                this.analyzeNode(method);
            }
            classSymbol.methods = node.methods.map(method => ({
                name: method.methodName || "unknown",
                dataType: this.mapStringToDataType(method.returnType),
                scope: this.getScopeType(this.symbolTable.getCurrentScope()),
                line: method.token?.line || 0,
                column: method.token?.column || 0,
                type: SymbolType.FUNCTION,
                initialized: true
            }));
        }

        // Salir del scope de la clase
        this.symbolTable.exitScope();

        return DataType.UNKNOWN;
    }

    /**
     * Analiza una declaración de método
     */
    private analyzeMethodDeclaration(node: ASTNode): DataType {
        const methodName = node.methodName ?? '';
        const token = node.token;

        if (!token) {
            return DataType.UNKNOWN;
        }

        // Verificar que el nombre no esté ya usado en el scope actual
        const existing = this.symbolTable.lookupCurrent(methodName);
        if (existing) {
            this.addError({
                type: 'semantic',
                category: 'redeclaration',
                message: `El método '${methodName}' ya está declarado en este scope`,
                line: token.line,
                column: token.column,
                suggestion: 'Use un nombre diferente para el método'
            });
        }

        // Registrar el método en la tabla de símbolos
        const methodSymbol: Symbol = {
            name: methodName,
            type: SymbolType.FUNCTION,
            dataType: DataType.UNKNOWN,
            scope: this.symbolTable.getCurrentScope() === 'global' ? Scope.GLOBAL : Scope.CLASS,
            line: token.line,
            column: token.column,
            initialized: true,
            parameters: node.parameters?.map(p => ({
                name: p.name,
                dataType: DataType.UNKNOWN,
                line: p.token.line,
                column: p.token.column
            })) || []
        };

        this.symbolTable.insert(methodSymbol);

        // Entrar al scope del método
        this.currentFunction = methodName;
        this.symbolTable.enterScope(`function:${methodName}`);

        // Registrar parámetros en el scope del método
        if (node.parameters) {
            for (const param of node.parameters) {
                const paramSymbol: Symbol = {
                    name: param.name,
                    type: SymbolType.PARAMETER,
                    dataType: DataType.UNKNOWN,
                    scope: Scope.LOCAL,
                    line: param.token.line,
                    column: param.token.column,
                    initialized: true
                };

                const inserted = this.symbolTable.insert(paramSymbol);
                if (!inserted) {
                    this.addError({
                        type: 'semantic',
                        category: 'redeclaration',
                        message: `Parámetro duplicado: '${param.name}'`,
                        line: param.token.line,
                        column: param.token.column,
                        suggestion: 'Use nombres únicos para los parámetros'
                    });
                }
            }
        }

        // Analizar cuerpo del método
        if (node.body) {
            for (const statement of node.body) {
                this.analyzeNode(statement);
            }
        }

        // Salir del scope del método
        this.symbolTable.exitScope();
        this.currentFunction = null;

        return DataType.UNKNOWN;
    }

    /**
     * Analiza una estructura FOR
     */
    private analyzeForStatement(node: ASTNode): DataType {
        this.symbolTable.enterScope('for');

        // Analizar inicialización
        if (node.initialization) {
            this.analyzeNode(node.initialization);
        }

        // Analizar condición
        if (node.condition) {
            const conditionType = this.analyzeNode(node.condition);
            const token = node.token;

            if (conditionType !== DataType.BOOLEAN &&
                conditionType !== DataType.UNKNOWN &&
                token) {
                this.addError({
                    type: 'semantic',
                    category: 'type_mismatch',
                    message: `Condición del 'for' debe ser booleana, se encontró '${conditionType}'`,
                    line: token.line,
                    column: token.column,
                    suggestion: 'Use una expresión de comparación'
                });
            }
        }

        // Analizar actualización
        if (node.update) {
            this.analyzeNode(node.update);
        }

        // Analizar cuerpo
        if (node.body) {
            for (const statement of node.body) {
                this.analyzeNode(statement);
            }
        }

        this.symbolTable.exitScope();
        return DataType.NONE;
    }

    /**
     * Agrega un error semántico
     */
    private addError(error: SemanticError): void {
        this.errors.push(error);
    }

    /**
     * Obtiene la tabla de símbolos
     */
    public getSymbolTable(): SymbolTable {
        return this.symbolTable;
    }

    /**
     * Obtiene los errores
     */
    public getErrors(): SemanticError[] {
        return this.errors;
    }

    /**
     * Mapea un string a un DataType
     */
    private mapStringToDataType(type?: string): DataType {
        switch (type) {
            case "int":
                return DataType.INT;
            case "float":
                return DataType.FLOAT;
            case "string":
                return DataType.STRING;
            case "boolean":
                return DataType.BOOLEAN;
            case "none":
                return DataType.NONE;
            default:
                return DataType.UNKNOWN;
        }
    }

    /**
     * Convierte un string de scope a Scope
     */
    private getScopeType(scope: string): Scope {
        switch (scope) {
            case "global":
                return Scope.GLOBAL;
            case "local":
                return Scope.LOCAL;
            case "class":
                return Scope.CLASS;
            default:
                return Scope.GLOBAL; // Valor predeterminado
        }
    }
}