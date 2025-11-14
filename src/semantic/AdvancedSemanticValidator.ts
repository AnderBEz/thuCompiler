import { ASTNode } from "../parser/Parser";
import { SemanticError } from "./SymbolTable";

/**
 * Validador Semántico Avanzado
 * Actividades 9 y 10: Validaciones avanzadas de expresiones y estructuras
 */
export class AdvancedSemanticValidator {
    private errors: SemanticError[];
    private warnings: SemanticError[];

    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Ejecuta todas las validaciones avanzadas
     */
    public validate(ast: ASTNode | null): {
        errors: SemanticError[];
        warnings: SemanticError[];
    } {
        this.errors = [];
        this.warnings = [];

        if (!ast) {
            return { errors: this.errors, warnings: this.warnings };
        }

        this.validateNode(ast);

        return {
            errors: this.errors,
            warnings: this.warnings
        };
    }

    /**
     * Valida un nodo recursivamente
     */
    private validateNode(node: ASTNode): void {
        // Validaciones específicas por tipo de nodo
        switch (node.type) {
            case 'Program':
                this.validateProgram(node);
                break;

            case 'BinaryExpression':
                this.validateBinaryExpression(node);
                break;

            case 'WhileStatement':
                this.validateWhileLoop(node);
                break;

            case 'ForStatement':
                this.validateForLoop(node);
                break;

            case 'IfStatement':
                this.validateIfStatement(node);
                break;

            case 'MethodDeclaration':
                this.validateMethod(node);
                break;

            case 'ClassDeclaration':
                this.validateClass(node);
                break;
        }

        // Validar hijos recursivamente
        if (node.children) {
            for (const child of node.children) {
                this.validateNode(child);
            }
        }

        if (node.body) {
            for (const statement of node.body) {
                this.validateNode(statement);
            }
        }

        if (node.left) this.validateNode(node.left);
        if (node.right) this.validateNode(node.right);
        if (node.condition) this.validateNode(node.condition);
    }

    /**
     * Valida el programa completo
     */
    private validateProgram(node: ASTNode): void {
        if (!node.children || node.children.length === 0) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Programa vacío',
                line: 1,
                column: 1,
                suggestion: 'Agregue al menos una sentencia al programa'
            });
        }
    }

    // ============ VALIDACIONES DE EXPRESIONES (Actividad 9) ============

    /**
     * Valida expresiones binarias para detectar operaciones peligrosas
     */
    private validateBinaryExpression(node: ASTNode): void {
        if (!node.operator || !node.left || !node.right) return;

        // Detectar división por cero en literales
        if ((node.operator === '/' || node.operator === '//') &&
            node.right.type === 'IntegerLiteral' &&
            node.right.value === '0') {

            this.addError({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'División por cero detectada',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Verifique que el divisor no sea cero antes de dividir'
            });
        }

        // Detectar operaciones redundantes (x - x, x / x, etc.)
        if (node.left.type === 'Identifier' &&
            node.right.type === 'Identifier' &&
            node.left.value === node.right.value) {

            if (node.operator === '-') {
                this.addWarning({
                    type: 'semantic',
                    category: 'invalid_operation',
                    message: `Operación redundante: ${node.left.value} - ${node.right.value} siempre es 0`,
                    line: node.token?.line ?? 0,
                    column: node.token?.column ?? 0,
                    suggestion: 'Considere simplificar la expresión'
                });
            } else if (node.operator === '/') {
                this.addWarning({
                    type: 'semantic',
                    category: 'invalid_operation',
                    message: `Operación redundante: ${node.left.value} / ${node.right.value} siempre es 1`,
                    line: node.token?.line ?? 0,
                    column: node.token?.column ?? 0,
                    suggestion: 'Considere simplificar la expresión'
                });
            }
        }

        // Detectar multiplicación o división por 1
        if (node.right.type === 'IntegerLiteral' && node.right.value === '1') {
            if (node.operator === '*' || node.operator === '/') {
                this.addWarning({
                    type: 'semantic',
                    category: 'invalid_operation',
                    message: `Operación innecesaria: ${node.operator === '*' ? 'multiplicar' : 'dividir'} por 1`,
                    line: node.token?.line ?? 0,
                    column: node.token?.column ?? 0,
                    suggestion: 'Esta operación no cambia el valor, considere eliminarla'
                });
            }
        }

        // Detectar suma o resta de 0
        if (node.right.type === 'IntegerLiteral' && node.right.value === '0') {
            if (node.operator === '+' || node.operator === '-') {
                this.addWarning({
                    type: 'semantic',
                    category: 'invalid_operation',
                    message: `Operación innecesaria: ${node.operator === '+' ? 'sumar' : 'restar'} 0`,
                    line: node.token?.line ?? 0,
                    column: node.token?.column ?? 0,
                    suggestion: 'Esta operación no cambia el valor, considere eliminarla'
                });
            }
        }
    }

    // ============ VALIDACIONES DE ESTRUCTURAS DE CONTROL (Actividad 10) ============

    /**
     * Valida bucles WHILE para detectar posibles bucles infinitos
     */
    private validateWhileLoop(node: ASTNode): void {
        if (!node.condition) return;

        // Detectar condición siempre verdadera
        if (node.condition.type === 'BooleanLiteral' && node.condition.value === 'True') {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Posible bucle infinito: condición siempre verdadera',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Asegúrese de que haya una condición de salida dentro del bucle'
            });
        }

        // Detectar condición siempre falsa
        if (node.condition.type === 'BooleanLiteral' && node.condition.value === 'False') {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle while nunca se ejecutará: condición siempre falsa',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Revise la lógica de la condición'
            });
        }

        // Detectar bucle vacío
        if (!node.body || node.body.length === 0) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle while vacío',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue sentencias dentro del bucle o considere eliminarlo'
            });
        }
    }

    /**
     * Valida bucles FOR
     */
    private validateForLoop(node: ASTNode): void {
        // Detectar for vacío
        if (!node.body || node.body.length === 0) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle for vacío',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue sentencias dentro del bucle o considere eliminarlo'
            });
        }

        // Validar que la condición no sea siempre falsa
        if (node.condition?.type === 'BooleanLiteral' && node.condition.value === 'False') {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle for nunca se ejecutará: condición siempre falsa',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Revise la lógica de la condición'
            });
        }

        // Validar que haya inicialización, condición y actualización
        if (!node.initialization) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle for sin inicialización',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Considere agregar una inicialización'
            });
        }

        if (!node.condition) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle for sin condición de terminación',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue una condición para evitar bucles infinitos'
            });
        }

        if (!node.update) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bucle for sin actualización',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue una actualización para evitar bucles infinitos'
            });
        }
    }

    /**
     * Valida estructuras IF
     */
    private validateIfStatement(node: ASTNode): void {
        if (!node.condition) return;

        // Detectar condición siempre verdadera
        if (node.condition.type === 'BooleanLiteral' && node.condition.value === 'True') {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Condición if siempre verdadera',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'El bloque else nunca se ejecutará. Considere eliminar el if'
            });
        }

        // Detectar condición siempre falsa
        if (node.condition.type === 'BooleanLiteral' && node.condition.value === 'False') {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Condición if siempre falsa',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'El bloque then nunca se ejecutará. Considere eliminar el if'
            });
        }

        // Detectar if vacío
        if (!node.body || node.body.length === 0) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bloque if vacío',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue sentencias o considere eliminar el if'
            });
        }

        // Detectar else vacío
        if (node.alternate && node.alternate.length === 0) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: 'Bloque else vacío',
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue sentencias o elimine el else'
            });
        }
    }

    // ============ VALIDACIONES DE MÉTODOS Y CLASES ============

    /**
     * Valida declaraciones de métodos
     */
    private validateMethod(node: ASTNode): void {
        const methodName = node.methodName ?? '';

        // Detectar método vacío
        if (!node.body || node.body.length === 0) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Método '${methodName}' está vacío`,
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue implementación al método o use pass'
            });
        }

        // Detectar muchos parámetros (code smell)
        if (node.parameters && node.parameters.length > 5) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Método '${methodName}' tiene muchos parámetros (${node.parameters.length})`,
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Considere agrupar parámetros relacionados en un objeto'
            });
        }

        // Validar nombres de parámetros
        if (node.parameters) {
            for (const param of node.parameters) {
                if (param.name.length === 1 && param.name !== param.name.toLowerCase()) {
                    this.addWarning({
                        type: 'semantic',
                        category: 'invalid_operation',
                        message: `Parámetro '${param.name}' usa mayúscula`,
                        line: param.token.line,
                        column: param.token.column,
                        suggestion: 'Por convención, use minúsculas para nombres de parámetros'
                    });
                }
            }
        }
    }

    /**
     * Valida declaraciones de clases
     */
    private validateClass(node: ASTNode): void {
        const className = node.className ?? '';

        // Validar nombre de clase (debe empezar con mayúscula)
        //@ts-ignore
        if (className && className.length > 0 && className[0] !== className[0].toUpperCase()) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Nombre de clase '${className}' debería empezar con mayúscula`,
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Por convención, los nombres de clases usan PascalCase'
            });
        }

        // Detectar clase vacía
        if ((!node.methods || node.methods.length === 0) &&
            (!node.attributes || node.attributes.length === 0)) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Clase '${className}' está vacía`,
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Agregue métodos o atributos a la clase'
            });
        }

        // Detectar clase con solo atributos (podría ser un diccionario)
        if (node.attributes && node.attributes.length > 0 &&
            (!node.methods || node.methods.length === 0)) {
            this.addWarning({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Clase '${className}' solo tiene atributos, sin métodos`,
                line: node.token?.line ?? 0,
                column: node.token?.column ?? 0,
                suggestion: 'Considere usar un diccionario en lugar de una clase'
            });
        }
    }

    /**
     * Agrega un error
     */
    private addError(error: SemanticError): void {
        this.errors.push(error);
    }

    /**
     * Agrega un warning
     */
    private addWarning(warning: SemanticError): void {
        this.warnings.push(warning);
    }

    /**
     * Obtiene todos los errores
     */
    public getErrors(): SemanticError[] {
        return this.errors;
    }

    /**
     * Obtiene todos los warnings
     */
    public getWarnings(): SemanticError[] {
        return this.warnings;
    }
}