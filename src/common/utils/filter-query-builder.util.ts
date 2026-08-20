import { FilterCondition, FilterOperator } from '../dto/filtering.dto';

export interface ColumnMapping {
    [field: string]: string; // e.g. { userId: 'e.UserID', eventType: 'e.EventType' }
}

export interface BuildWhereOptions {
    filters?: FilterCondition[];
    allowedColumns?: string[] | ColumnMapping;
    defaultWhere?: string;
    startIndex?: number;
}

export interface ParameterizedWhereResult {
    whereClause: string; // e.g. "WHERE e.UserID = @0 AND e.EventType = @1"
    params: any[];
}

/**
 * Builds a safe, parameterized SQL Server WHERE clause from filter conditions.
 * Prevents SQL injection by strictly matching fields against an allowed whitelist.
 */
export function buildWhereClause(options: BuildWhereOptions): ParameterizedWhereResult {
    const { filters = [], allowedColumns = [], defaultWhere, startIndex = 0 } = options;

    const clauses: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    if (defaultWhere) {
        clauses.push(defaultWhere);
    }

    // Determine column resolver (map or array)
    const resolveColumn = (field: string): string | null => {
        if (Array.isArray(allowedColumns)) {
            const match = allowedColumns.find(
                (col) => col.toLowerCase() === field.trim().toLowerCase(),
            );
            return match || null;
        } else if (allowedColumns && typeof allowedColumns === 'object') {
            const lowerField = field.trim().toLowerCase();
            for (const key of Object.keys(allowedColumns)) {
                if (key.toLowerCase() === lowerField) {
                    return allowedColumns[key];
                }
            }
        }
        return null;
    };

    for (const filter of filters) {
        if (!filter || !filter.field) continue;

        const dbColumn = resolveColumn(filter.field);
        if (!dbColumn) {
            // Field not in whitelist, skip to prevent SQL injection or invalid column errors
            continue;
        }

        const op = filter.operator || FilterOperator.EQ;
        const val = filter.value;

        switch (op) {
            case FilterOperator.EQ:
                if (val === null || val === undefined) {
                    clauses.push(`${dbColumn} IS NULL`);
                } else {
                    clauses.push(`${dbColumn} = @${paramIndex}`);
                    params.push(val);
                    paramIndex++;
                }
                break;

            case FilterOperator.NE:
                if (val === null || val === undefined) {
                    clauses.push(`${dbColumn} IS NOT NULL`);
                } else {
                    clauses.push(`${dbColumn} <> @${paramIndex}`);
                    params.push(val);
                    paramIndex++;
                }
                break;

            case FilterOperator.GT:
                clauses.push(`${dbColumn} > @${paramIndex}`);
                params.push(val);
                paramIndex++;
                break;

            case FilterOperator.GTE:
                clauses.push(`${dbColumn} >= @${paramIndex}`);
                params.push(val);
                paramIndex++;
                break;

            case FilterOperator.LT:
                clauses.push(`${dbColumn} < @${paramIndex}`);
                params.push(val);
                paramIndex++;
                break;

            case FilterOperator.LTE:
                clauses.push(`${dbColumn} <= @${paramIndex}`);
                params.push(val);
                paramIndex++;
                break;

            case FilterOperator.CONTAINS:
                clauses.push(`${dbColumn} LIKE @${paramIndex}`);
                params.push(`%${val}%`);
                paramIndex++;
                break;

            case FilterOperator.STARTS_WITH:
                clauses.push(`${dbColumn} LIKE @${paramIndex}`);
                params.push(`${val}%`);
                paramIndex++;
                break;

            case FilterOperator.ENDS_WITH:
                clauses.push(`${dbColumn} LIKE @${paramIndex}`);
                params.push(`%${val}`);
                paramIndex++;
                break;

            case FilterOperator.IS_NULL:
                clauses.push(`${dbColumn} IS NULL`);
                break;

            case FilterOperator.IS_NOT_NULL:
                clauses.push(`${dbColumn} IS NOT NULL`);
                break;

            case FilterOperator.IN:
                if (Array.isArray(val) && val.length > 0) {
                    const inPlaceholders: string[] = [];
                    for (const item of val) {
                        inPlaceholders.push(`@${paramIndex}`);
                        params.push(item);
                        paramIndex++;
                    }
                    clauses.push(`${dbColumn} IN (${inPlaceholders.join(', ')})`);
                }
                break;

            case FilterOperator.NOT_IN:
                if (Array.isArray(val) && val.length > 0) {
                    const notInPlaceholders: string[] = [];
                    for (const item of val) {
                        notInPlaceholders.push(`@${paramIndex}`);
                        params.push(item);
                        paramIndex++;
                    }
                    clauses.push(`${dbColumn} NOT IN (${notInPlaceholders.join(', ')})`);
                }
                break;

            case FilterOperator.BETWEEN:
                if (Array.isArray(val) && val.length >= 2) {
                    clauses.push(`${dbColumn} BETWEEN @${paramIndex} AND @${paramIndex + 1}`);
                    params.push(val[0]);
                    params.push(val[1]);
                    paramIndex += 2;
                }
                break;

            default:
                clauses.push(`${dbColumn} = @${paramIndex}`);
                params.push(val);
                paramIndex++;
                break;
        }
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return { whereClause, params };
}
