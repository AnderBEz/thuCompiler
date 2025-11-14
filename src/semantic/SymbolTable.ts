import { Token } from "../tokens/Token";

// Tipos de datos soportados en Python
export enum DataType {
    INT = 'int',
    FLOAT = 'float',
    STRING = 'string',
    BOOLEAN = 'boolean',
    NONE = 'none',
    UNKNOWN = 'unknown'
}

// Tipo de símbolo
export enum SymbolType {
    VARIABLE = 'variable',
    FUNCTION = 'function',
    CLASS = 'class',
    PARAMETER = 'parameter'
}

// Alcance del símbolo
export enum Scope {
    GLOBAL = 'global',
    LOCAL = 'local',
    CLASS = 'class'
}

// Información de un símbolo
export interface Symbol {
    name: string;
    type: SymbolType;
    dataType: DataType;
    scope: Scope;
    line: number;
    column: number;
    initialized: boolean;
    value?: any;
    // Para funciones
    parameters?: Parameter[];
    returnType?: DataType;
    // Para clases
    methods?: Symbol[];
    attributes?: Symbol[];
}

export interface Parameter {
    name: string;
    dataType: DataType;
    line: number;
    column: number;
}

// Error semántico
export interface SemanticError {
    type: 'semantic';
    category: 'undefined_variable' | 'redeclaration' | 'type_mismatch' |
    'uninitialized_variable' | 'invalid_operation' | 'scope_error' |
    'parameter_mismatch' | 'return_type_mismatch';
    message: string;
    line: number;
    column: number;
    suggestion: string;
}

/**
 * Tabla de Símbolos con manejo de alcances (scopes)
 */
export class SymbolTable {
    private scopes: Map<string, Symbol>[];
    private currentScope: number;
    private scopeNames: string[];
    private errors: SemanticError[];

    constructor() {
        this.scopes = [new Map()]; // Scope global
        this.currentScope = 0;
        this.scopeNames = ['global'];
        this.errors = [];
    }

    /**
     * Entra a un nuevo scope (función, clase, bloque)
     */
    public enterScope(scopeName: string): void {
        this.scopes.push(new Map());
        this.currentScope++;
        this.scopeNames.push(scopeName);
    }

    /**
     * Sale del scope actual
     */
    public exitScope(): void {
        if (this.currentScope > 0) {
            this.scopes.pop();
            this.scopeNames.pop();
            this.currentScope--;
        }
    }

    /**
     * Inserta un símbolo en la tabla
     */
    public insert(symbol: Symbol): boolean {
        const currentScopeTable = this.scopes[this.currentScope];

        // Verificar redeclaración en el scope actual
        if (currentScopeTable?.has(symbol.name)) {
            const existing = currentScopeTable.get(symbol.name);
            this.addError({
                type: 'semantic',
                category: 'redeclaration',
                message: `La variable '${symbol.name}' ya fue declarada en línea ${existing?.line}`,
                line: symbol.line,
                column: symbol.column,
                suggestion: `Use un nombre diferente o reutilice la variable existente`
            });
            return false;
        }

        currentScopeTable?.set(symbol.name, symbol);
        return true;
    }

    /**
     * Busca un símbolo en todos los scopes (de actual a global)
     */
    public lookup(name: string): Symbol | undefined {
        // Buscar desde el scope actual hacia arriba
        for (let i = this.currentScope; i >= 0; i--) {
            const scope = this.scopes[i];
            if (scope?.has(name)) {
                return scope.get(name);
            }
        }
        return undefined;
    }

    /**
     * Busca un símbolo solo en el scope actual
     */
    public lookupCurrent(name: string): Symbol | undefined {
        return this.scopes[this.currentScope]?.get(name);
    }

    /**
     * Actualiza un símbolo existente
     */
    public update(name: string, updates: Partial<Symbol>): boolean {
        const symbol = this.lookup(name);
        if (!symbol) {
            return false;
        }

        Object.assign(symbol, updates);
        return true;
    }

    /**
     * Marca una variable como inicializada
     */
    public markInitialized(name: string, value?: any): boolean {
        return this.update(name, { initialized: true, value });
    }

    /**
     * Verifica si una variable está declarada
     */
    public isDeclared(name: string): boolean {
        return this.lookup(name) !== undefined;
    }

    /**
     * Verifica si una variable está inicializada
     */
    public isInitialized(name: string): boolean {
        const symbol = this.lookup(name);
        return symbol?.initialized ?? false;
    }

    /**
     * Obtiene el tipo de dato de un símbolo
     */
    public getDataType(name: string): DataType | undefined {
        return this.lookup(name)?.dataType;
    }

    /**
     * Verifica compatibilidad de tipos para asignación
     */
    public checkTypeCompatibility(
        targetType: DataType,
        sourceType: DataType,
        line: number,
        column: number
    ): boolean {
        // Python es dinámicamente tipado, pero podemos hacer algunas validaciones

        // None puede asignarse a cualquier cosa
        if (sourceType === DataType.NONE) {
            return true;
        }

        // Int a Float es válido (promoción implícita)
        if (targetType === DataType.FLOAT && sourceType === DataType.INT) {
            return true;
        }

        // Mismo tipo siempre es válido
        if (targetType === sourceType) {
            return true;
        }

        // Tipos desconocidos se permiten (Python dinámico)
        if (targetType === DataType.UNKNOWN || sourceType === DataType.UNKNOWN) {
            return true;
        }

        // Otros casos son incompatibles
        this.addError({
            type: 'semantic',
            category: 'type_mismatch',
            message: `No se puede asignar tipo '${sourceType}' a variable de tipo '${targetType}'`,
            line,
            column,
            suggestion: `Convierta explícitamente el tipo o use una variable del tipo correcto`
        });

        return false;
    }

    /**
     * Infiere el tipo de dato de un valor literal
     */
    public inferDataType(value: string, tokenType: string): DataType {
        switch (tokenType) {
            case 'INTEGER':
                return DataType.INT;
            case 'FLOAT':
                return DataType.FLOAT;
            case 'STRING':
                return DataType.STRING;
            case 'BOOLEAN':
                return DataType.BOOLEAN;
            case 'NONE':
                return DataType.NONE;
            default:
                return DataType.UNKNOWN;
        }
    }

    /**
     * Valida operación aritmética entre tipos
     */
    public validateArithmeticOperation(
        leftType: DataType,
        rightType: DataType,
        operator: string,
        line: number,
        column: number
    ): DataType | null {
        const numericTypes = [DataType.INT, DataType.FLOAT];

        // Ambos deben ser numéricos
        if (!numericTypes.includes(leftType) || !numericTypes.includes(rightType)) {
            this.addError({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Operador '${operator}' no válido entre tipos '${leftType}' y '${rightType}'`,
                line,
                column,
                suggestion: `Use tipos numéricos (int, float) para operaciones aritméticas`
            });
            return null;
        }

        // Resultado es float si alguno es float
        if (leftType === DataType.FLOAT || rightType === DataType.FLOAT) {
            return DataType.FLOAT;
        }

        return DataType.INT;
    }

    /**
     * Valida operación lógica entre tipos
     */
    public validateLogicalOperation(
        leftType: DataType,
        rightType: DataType,
        operator: string,
        line: number,
        column: number
    ): DataType | null {
        // En Python, cualquier tipo puede usarse en contexto booleano
        // pero es mejor si son explícitamente booleanos

        if (leftType !== DataType.BOOLEAN || rightType !== DataType.BOOLEAN) {
            // Advertencia, no error (Python permite esto)
            this.addError({
                type: 'semantic',
                category: 'invalid_operation',
                message: `Operador lógico '${operator}' usado con tipos no booleanos: '${leftType}' y '${rightType}'`,
                line,
                column,
                suggestion: `Use expresiones booleanas explícitas para mayor claridad`
            });
        }

        return DataType.BOOLEAN;
    }

    /**
     * Valida operación de comparación entre tipos
     */
    public validateComparisonOperation(
        leftType: DataType,
        rightType: DataType,
        operator: string,
        line: number,
        column: number
    ): DataType | null {
        // Tipos deben ser comparables
        const comparableTypes = [DataType.INT, DataType.FLOAT, DataType.STRING];

        if (!comparableTypes.includes(leftType) || !comparableTypes.includes(rightType)) {
            this.addError({
                type: 'semantic',
                category: 'invalid_operation',
                message: `No se puede comparar tipos '${leftType}' y '${rightType}' con operador '${operator}'`,
                line,
                column,
                suggestion: `Compare tipos compatibles (números con números, strings con strings)`
            });
            return null;
        }

        // Comparar tipos diferentes (int con string) es error
        if (leftType !== rightType &&
            !(leftType === DataType.INT && rightType === DataType.FLOAT) &&
            !(leftType === DataType.FLOAT && rightType === DataType.INT)) {
            this.addError({
                type: 'semantic',
                category: 'type_mismatch',
                message: `Comparación entre tipos incompatibles: '${leftType}' y '${rightType}'`,
                line,
                column,
                suggestion: `Convierta ambos valores al mismo tipo antes de comparar`
            });
            return null;
        }

        return DataType.BOOLEAN;
    }

    /**
     * Agrega un error semántico
     */
    private addError(error: SemanticError): void {
        this.errors.push(error);
    }

    /**
     * Obtiene todos los errores
     */
    public getErrors(): SemanticError[] {
        return this.errors;
    }

    /**
     * Limpia los errores
     */
    public clearErrors(): void {
        this.errors = [];
    }

    /**
     * Obtiene el scope actual
     */
    public getCurrentScope(): string {
        return this.scopeNames[this.currentScope] ?? 'unknown';
    }

    /**
     * Obtiene todos los símbolos del scope actual
     */
    public getCurrentSymbols(): Map<string, Symbol> {
        return this.scopes[this.currentScope] ?? new Map();
    }

    /**
     * Obtiene todos los símbolos de todos los scopes
     */
    public getAllSymbols(): Symbol[] {
        const allSymbols: Symbol[] = [];
        this.scopes.forEach(scope => {
            scope.forEach(symbol => allSymbols.push(symbol));
        });
        return allSymbols;
    }

    /**
     * Exporta la tabla de símbolos para debugging
     */
    public export(): any {
        return {
            currentScope: this.getCurrentScope(),
            scopes: this.scopes.map((scope, index) => ({
                name: this.scopeNames[index],
                symbols: Array.from(scope.entries()).map(([name, symbol]) => ({
                    ...symbol,
                    name
                }))
            })),
            errors: this.errors
        };
    }

    /**
     * Resetea la tabla de símbolos
     */
    public reset(): void {
        this.scopes = [new Map()];
        this.currentScope = 0;
        this.scopeNames = ['global'];
        this.errors = [];
    }
}