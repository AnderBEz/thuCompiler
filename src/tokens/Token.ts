import { TokenType } from "../types/TokenType";

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    error?: {
        message: string;
        suggestion?: string;
    };
}