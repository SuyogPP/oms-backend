import { ConnectionPool } from 'mssql';

export interface DatabaseConnection {
    pool: ConnectionPool;
}