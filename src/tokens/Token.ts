import { TokenType } from "../types/tokenType";

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}