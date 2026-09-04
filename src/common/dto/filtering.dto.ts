import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Supported comparison and lookup operators for SQL query filtering.
 */
export enum FilterOperator {
  EQ = 'EQ', // Equals (=)
  NE = 'NE', // Not Equals (<>)
  GT = 'GT', // Greater Than (>)
  GTE = 'GTE', // Greater Than or Equal (>=)
  LT = 'LT', // Less Than (<)
  LTE = 'LTE', // Less Than or Equal (<=)
  IN = 'IN', // Included in list (IN (...))
  NOT_IN = 'NOT_IN', // Not in list (NOT IN (...))
  CONTAINS = 'CONTAINS', // Substring search (LIKE '%val%')
  STARTS_WITH = 'STARTS_WITH', // Prefix search (LIKE 'val%')
  ENDS_WITH = 'ENDS_WITH', // Suffix search (LIKE '%val')
  IS_NULL = 'IS_NULL', // IS NULL
  IS_NOT_NULL = 'IS_NOT_NULL', // IS NOT NULL
  BETWEEN = 'BETWEEN', // BETWEEN @val1 AND @val2
}

/**
 * Individual filter condition.
 */
export class FilterCondition {
  @ApiPropertyOptional({
    description: 'Database field or property name to filter on',
    example: 'EventType',
  })
  @IsString()
  @IsNotEmpty()
  field: string;

  @ApiPropertyOptional({
    description: 'Filter operator',
    enum: FilterOperator,
    default: FilterOperator.EQ,
  })
  @IsEnum(FilterOperator)
  operator: FilterOperator = FilterOperator.EQ;

  @ApiPropertyOptional({
    description:
      'Filter value (single value, array for IN, or [from, to] for BETWEEN)',
    example: 'LOGIN_FAILURE',
  })
  @IsOptional()
  value?: any;

  constructor(partial?: Partial<FilterCondition>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}

/**
 * Helper to parse various query-string filter formats:
 * 1. JSON array string: `?filters=[{"field":"EventType","operator":"EQ","value":"LOGIN_SUCCESS"}]`
 * 2. Comma/colon shorthand: `?filter=EventType:EQ:LOGIN_SUCCESS,CreatedAt:GTE:2026-08-01`
 * 3. Array of objects directly from body or parsed query
 */
export function parseFilterQuery(value: any): FilterCondition[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return parseShorthandCondition(item);
        }
        if (item instanceof FilterCondition) return item;
        return plainToInstance(FilterCondition, item);
      })
      .filter((c): c is FilterCondition => c !== null);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Try parsing JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return plainToInstance(FilterCondition, arr);
      } catch {
        // fall through to shorthand parser
      }
    }

    // Shorthand format: field:operator:value,field2:operator:value
    return trimmed
      .split(',')
      .map((chunk) => parseShorthandCondition(chunk.trim()))
      .filter((c): c is FilterCondition => c !== null);
  }

  return [];
}

function parseShorthandCondition(chunk: string): FilterCondition | null {
  if (!chunk) return null;
  const parts = chunk.split(':');
  if (parts.length === 1) {
    return new FilterCondition({
      field: parts[0],
      operator: FilterOperator.EQ,
      value: true,
    });
  }
  if (parts.length === 2) {
    return new FilterCondition({
      field: parts[0],
      operator: FilterOperator.EQ,
      value: parts[1],
    });
  }
  const operator =
    (parts[1].toUpperCase() as FilterOperator) in FilterOperator
      ? (parts[1].toUpperCase() as FilterOperator)
      : FilterOperator.EQ;
  const rawVal = parts.slice(2).join(':');
  let value: any = rawVal;
  if (operator === FilterOperator.IN || operator === FilterOperator.NOT_IN) {
    value = rawVal.split('|').map((s) => s.trim());
  } else if (operator === FilterOperator.BETWEEN) {
    value = rawVal.split('|').map((s) => s.trim());
  }
  return new FilterCondition({ field: parts[0], operator, value });
}

/**
 * Filter Query DTO that can be used standalone or extended.
 */
export class FilteringQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter conditions (as JSON string or shorthand: field:operator:value)',
    type: [FilterCondition],
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterQuery(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterCondition)
  filters?: FilterCondition[];
}
