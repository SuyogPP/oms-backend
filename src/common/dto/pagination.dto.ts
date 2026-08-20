import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { PaginationMeta } from '../interfaces/response-envelope.interface';
import { FilterCondition, parseFilterQuery } from './filtering.dto';

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

/**
 * Standard Pagination Query DTO.
 */
export class PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Page number (1-based)',
        default: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        default: 10,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    pageSize: number = 10;

    get offset(): number {
        return (this.page - 1) * this.pageSize;
    }
}

/**
 * Standard Sorting Query DTO.
 */
export class SortingQueryDto {
    @ApiPropertyOptional({
        description: 'Field to sort by',
        example: 'CreatedAt',
    })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({
        description: 'Sort direction (ASC or DESC)',
        enum: SortOrder,
        default: SortOrder.DESC,
    })
    @IsOptional()
    @IsEnum(SortOrder, { message: 'sortOrder must be either ASC or DESC' })
    sortOrder: SortOrder = SortOrder.DESC;
}

/**
 * Base Query DTO combining pagination, sorting, free-text search, and column-level filters.
 */
export class BaseQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({
        description: 'Free text search query',
        example: 'john',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Field to sort by',
        example: 'CreatedAt',
    })
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({
        description: 'Sort direction (ASC or DESC)',
        enum: SortOrder,
        default: SortOrder.DESC,
    })
    @IsOptional()
    @IsEnum(SortOrder, { message: 'sortOrder must be either ASC or DESC' })
    sortOrder: SortOrder = SortOrder.DESC;

    @ApiPropertyOptional({
        description: 'Column filters (e.g. JSON array or shorthand: "EventType:EQ:LOGIN_FAILURE,CreatedAt:GTE:2026-08-01")',
        type: [FilterCondition],
    })
    @IsOptional()
    @Transform(({ value }) => parseFilterQuery(value))
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FilterCondition)
    filters?: FilterCondition[];
}

/**
 * Paginated Result wrapper class.
 */
export class PaginatedResult<T> {
    items: T[];
    pagination: PaginationMeta;

    constructor(items: T[], total: number, page: number, pageSize: number) {
        this.items = items;
        const totalPages = Math.ceil(total / pageSize) || 1;
        this.pagination = {
            page: Number(page),
            pageSize: Number(pageSize),
            total: Number(total),
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        };
    }

    static create<T>(items: T[], total: number, query: PaginationQueryDto): PaginatedResult<T> {
        return new PaginatedResult<T>(items, total, query.page, query.pageSize);
    }
}

/**
 * Sanitizes and validates column names for SQL Server ORDER BY to prevent SQL injection.
 */
export function sanitizeSortColumn(
    sortBy: string | undefined,
    allowedColumns: string[],
    defaultColumn: string,
): string {
    if (!sortBy) return defaultColumn;
    const match = allowedColumns.find(
        (col) => col.toLowerCase() === sortBy.trim().toLowerCase(),
    );
    return match || defaultColumn;
}
