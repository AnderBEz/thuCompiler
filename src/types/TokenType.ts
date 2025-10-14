export enum TokenType {
    // Palabras clave de Python
    KEYWORD = 'KEYWORD',

    // Identificadores
    IDENTIFIER = 'IDENTIFIER',

    // Literales
    INTEGER = 'INTEGER',
    FLOAT = 'FLOAT',
    STRING = 'STRING',
    BOOLEAN = 'BOOLEAN',
    NONE = 'NONE',

    // Operadores
    ARITHMETIC_OPERATOR = 'ARITHMETIC_OPERATOR',
    ASSIGNMENT_OPERATOR = 'ASSIGNMENT_OPERATOR',
    COMPARISON_OPERATOR = 'COMPARISON_OPERATOR',
    LOGICAL_OPERATOR = 'LOGICAL_OPERATOR',
    BITWISE_OPERATOR = 'BITWISE_OPERATOR',
    MEMBERSHIP_OPERATOR = 'MEMBERSHIP_OPERATOR',
    IDENTITY_OPERATOR = 'IDENTITY_OPERATOR',

    // Símbolos
    LPAREN = 'LPAREN',
    RPAREN = 'RPAREN',
    LBRACKET = 'LBRACKET',
    RBRACKET = 'RBRACKET',
    LBRACE = 'LBRACE',  // Para diccionarios y sets
    RBRACE = 'RBRACE',
    COMMA = 'COMMA',
    COLON = 'COLON',
    SEMICOLON = 'SEMICOLON',
    DOT = 'DOT',
    ARROW = 'ARROW',  // Para funciones ->

    // Indentación (específico de Python)
    INDENT = 'INDENT',
    DEDENT = 'DEDENT',
    NEWLINE = 'NEWLINE',

    // Comentarios
    COMMENT = 'COMMENT',

    ERROR = 'ERROR',

    // Otros
    EOF = 'EOF',
    UNKNOWN = 'UNKNOWN'
}