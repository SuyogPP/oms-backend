export interface JwtUser {
    id: number;
    email: string;
    role: string;
    permissions: string[];
}