# How to Build a CRUD API in OMS Backend

A step-by-step guide for junior developers on how to add new APIs to the OMS NestJS backend. Everything in this guide is based on the patterns already used in this codebase — follow these patterns exactly so your code stays consistent with the rest of the project.

---

## Table of Contents

1. [Project Architecture Overview](#1-project-architecture-overview)
2. [Before You Start — Understand the Stack](#2-before-you-start--understand-the-stack)
3. [File Structure for a Module](#3-file-structure-for-a-module)
4. [Step 1 — Create the Module Folder](#step-1--create-the-module-folder)
5. [Step 2 — Define the Interface](#step-2--define-the-interface)
6. [Step 3 — Create the Entity (API Response Shape)](#step-3--create-the-entity-api-response-shape)
7. [Step 4 — Create the DTO (API Request Shape)](#step-4--create-the-dto-api-request-shape)
8. [Step 5 — Define Constants and Error Codes](#step-5--define-constants-and-error-codes)
9. [Step 6 — Build the Repository (Database Queries)](#step-6--build-the-repository-database-queries)
10. [Step 7 — Build the Service (Business Logic)](#step-7--build-the-service-business-logic)
11. [Step 8 — Build the Controller (HTTP Endpoints)](#step-8--build-the-controller-http-endpoints)
12. [Step 9 — Create the index.ts Barrel File](#step-9--create-the-indexts-barrel-file)
13. [Step 10 — Register Everything in the Module](#step-10--register-everything-in-the-module)
14. [Common Patterns Cheatsheet](#common-patterns-cheatsheet)
15. [Things You Must Never Do](#things-you-must-never-do)

---

## 1. Project Architecture Overview

This backend follows a layered architecture. When a request comes in, it flows like this:

```
HTTP Request
    ↓
Controller        ← Handles routing, input parsing, auth guards
    ↓
Service           ← All business logic and validation lives here
    ↓
Repository        ← Raw SQL queries against the database
    ↓
SQL Server DB     ← The actual data
```

Each domain (e.g. "organization units", "users") gets its own **module** folder. Inside it, you build one set of these layers.

---

## 2. Before You Start — Understand the Stack

| Technology | Purpose |
|---|---|
| **NestJS** | The backend framework (similar to Express but more structured) |
| **TypeScript** | All code is typed. No `any` unless absolutely necessary |
| **TypeORM DataSource** | Used only for raw SQL queries — we do NOT use TypeORM decorators or entities |
| **SQL Server (MSSQL)** | The database. All tables are in schemas like `masters`, `auth`, `org` |
| **class-validator** | Validates incoming request bodies (DTOs) |
| **Swagger / OpenAPI** | Auto-generated API docs at `/api/docs` |

> **Key rule:** We use **raw SQL** (`dataSource.query(sql, [params])`) everywhere, NOT TypeORM's ORM features like `@Entity`, `Repository`, or `find()`. The TypeORM `DataSource` is used only for running raw SQL.

---

## 3. File Structure for a Module

Here is what a complete module looks like. We'll use a fictional **"Products"** module as our example throughout this guide.

```
src/modules/products/
├── controllers/
│   └── products.controller.ts        ← HTTP routes
├── dto/
│   ├── create-product.dto.ts         ← Request body for POST
│   └── update-product.dto.ts         ← Request body for PATCH
├── entities/
│   └── product.entity.ts             ← API response shape (what we return)
├── interfaces/
│   └── product.interface.ts          ← Internal TypeScript interface (raw DB row)
├── repositories/
│   └── products.repository.ts        ← All SQL queries
├── services/
│   └── products.service.ts           ← Business logic
├── index.ts                          ← Barrel export file
├── products.constants.ts             ← Permission codes, error codes, enums
└── products.module.ts                ← NestJS module wiring
```

---

## Step 1 — Create the Module Folder

Create all the folders you need:

```bash
mkdir -p src/modules/products/controllers
mkdir -p src/modules/products/dto
mkdir -p src/modules/products/entities
mkdir -p src/modules/products/interfaces
mkdir -p src/modules/products/repositories
mkdir -p src/modules/products/services
```

---

## Step 2 — Define the Interface

The **interface** is a TypeScript type that mirrors exactly what the database returns for a single row. Think of it as a "raw DB row" type.

**File:** `src/modules/products/interfaces/product.interface.ts`

```typescript
// This is the shape of the raw row the database returns.
// Property names use camelCase — SQL aliasing handles the conversion.
export interface IProduct {
  productId: string;      // maps to product_id (UNIQUEIDENTIFIER in DB)
  productCode: string;    // maps to product_code
  productName: string;    // maps to product_name
  categoryId: string;     // maps to category_id
  unitPrice: number;      // maps to unit_price
  isActive: boolean;      // maps to is_active
  createdAt: Date;        // maps to created_at
  updatedAt: Date;        // maps to updated_at
}

// If you need a filter/query type for list endpoints:
export interface IProductFilterOptions {
  categoryId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}
```

**Why this exists:** The repository returns raw DB rows. We use this interface to get TypeScript autocomplete and type safety inside the service layer.

---

## Step 3 — Create the Entity (API Response Shape)

The **entity** is the shape of the JSON that gets sent back to the frontend. It uses `@ApiProperty` decorators so Swagger shows it in the docs.

**File:** `src/modules/products/entities/product.entity.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductEntity {
  @ApiProperty({
    example: '1053433E-F36B-1410-85ED-009A959FB122',
    description: 'Unique product identifier (UUID)',
  })
  productId: string;

  @ApiProperty({ example: 'PROD-001', description: 'Unique product code' })
  productCode: string;

  @ApiProperty({ example: 'Laptop Stand', description: 'Product display name' })
  productName: string;

  @ApiProperty({
    example: '33333333-3333-3333-3333-333333333333',
    description: 'Category this product belongs to',
  })
  categoryId: string;

  @ApiProperty({ example: 149.99, description: 'Unit price in AED' })
  unitPrice: number;

  @ApiProperty({ example: true, description: 'Whether product is active' })
  isActive: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-01T00:00:00Z' })
  updatedAt: Date;
}
```

**Tip:** Use `@ApiPropertyOptional` for nullable or optional fields.

---

## Step 4 — Create the DTO (API Request Shape)

**DTOs (Data Transfer Objects)** define what the frontend sends in the request body. They use `class-validator` decorators to automatically validate input. If validation fails, NestJS returns a 400 error automatically.

### Create DTO

**File:** `src/modules/products/dto/create-product.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateProductDto {
  // Required string field with length limits
  @ApiProperty({ example: 'PROD-001', description: 'Unique product code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,49}$/, {
    message: 'Code must be uppercase alphanumeric (e.g. PROD-001)',
  })
  productCode: string;

  // Required string field
  @ApiProperty({ example: 'Laptop Stand' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  productName: string;

  // Required UUID reference
  @ApiProperty({ example: '33333333-3333-3333-3333-333333333333' })
  @IsUUID()
  categoryId: string;

  // Required number
  @ApiProperty({ example: 149.99 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  // Optional boolean field
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;
}
```

### Update DTO

**File:** `src/modules/products/dto/update-product.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';

// Everything is optional for PATCH — only send what you want to change
export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Laptop Stand Pro' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @ApiPropertyOptional({ example: '33333333-3333-3333-3333-333333333333' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 199.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

**Common validators to know:**

| Decorator | What it does |
|---|---|
| `@IsString()` | Must be a string |
| `@IsNotEmpty()` | Cannot be empty string |
| `@IsOptional()` | Field is not required |
| `@IsUUID()` | Must be a valid UUID |
| `@IsNumber()` | Must be a number |
| `@IsBoolean()` | Must be true or false |
| `@IsEnum(MyEnum)` | Must be one of the enum values |
| `@MaxLength(n)` | Max string length |
| `@MinLength(n)` | Min string length |
| `@Min(n)` | Min number value |
| `@Matches(regex)` | Must match the regex pattern |

---

## Step 5 — Define Constants and Error Codes

Keep all magic strings in one place. Never hardcode permission codes or error codes directly in your services or controllers.

**File:** `src/modules/products/products.constants.ts`

```typescript
/**
 * Domain X — Products Constants
 */

// ============================================================
// Permission Codes
// Must match what is seeded in the auth.tbl_Permissions table
// ============================================================
export const PRODUCT_PERMISSIONS = {
  VIEW:   'PRODUCT.VIEW',
  CREATE: 'PRODUCT.CREATE',
  UPDATE: 'PRODUCT.UPDATE',
  DELETE: 'PRODUCT.DELETE',
} as const;

export type ProductPermission = typeof PRODUCT_PERMISSIONS[keyof typeof PRODUCT_PERMISSIONS];

// ============================================================
// Business Rule Error Codes
// Used in thrown HttpExceptions so the frontend can handle them
// ============================================================
export const PRODUCT_ERROR_CODES = {
  PRODUCT_NOT_FOUND:        'PRODUCT_NOT_FOUND',
  PRODUCT_CODE_DUPLICATE:   'PRODUCT_CODE_DUPLICATE',
  PRODUCT_CATEGORY_INVALID: 'PRODUCT_CATEGORY_INVALID',
} as const;

export type ProductErrorCode = typeof PRODUCT_ERROR_CODES[keyof typeof PRODUCT_ERROR_CODES];
```

---

## Step 6 — Build the Repository (Database Queries)

The repository contains **only SQL queries**. No business logic goes here.

**File:** `src/modules/products/repositories/products.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IProduct, IProductFilterOptions } from '../interfaces/product.interface';

@Injectable()
export class ProductsRepository {
  constructor(private readonly dataSource: DataSource) {}

  // Helper: use query runner if provided (for transactions), otherwise use dataSource directly
  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  // ─────────────────────────────────────────────
  // READ: Find a single product by its UUID
  // ─────────────────────────────────────────────
  async findById(productId: string, qr?: QueryRunner): Promise<IProduct | null> {
    const sql = `
      SELECT
        p.product_id       AS productId,
        p.product_code     AS productCode,
        p.product_name     AS productName,
        p.category_id      AS categoryId,
        p.unit_price       AS unitPrice,
        p.is_active        AS isActive,
        p.created_at       AS createdAt,
        p.updated_at       AS updatedAt
      FROM [masters].[tbl_Products] p
      WHERE p.product_id = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [productId]);
    return rows.length > 0 ? rows[0] : null;
  }

  // ─────────────────────────────────────────────
  // READ: Find by unique code (for duplicate check)
  // ─────────────────────────────────────────────
  async findByCode(productCode: string, qr?: QueryRunner): Promise<IProduct | null> {
    const sql = `
      SELECT
        p.product_id   AS productId,
        p.product_code AS productCode,
        p.product_name AS productName,
        p.is_active    AS isActive
      FROM [masters].[tbl_Products] p
      WHERE p.product_code = @0;
    `;
    const rows = await this.getExecutor(qr).query(sql, [productCode]);
    return rows.length > 0 ? rows[0] : null;
  }

  // ─────────────────────────────────────────────
  // READ: Paginated list with optional filters
  // ─────────────────────────────────────────────
  async findAll(
    options: IProductFilterOptions,
    qr?: QueryRunner,
  ): Promise<{ rows: IProduct[]; total: number }> {
    const { categoryId, isActive, search, page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions dynamically
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 0;

    if (categoryId !== undefined) {
      conditions.push(`p.category_id = @${paramIndex++}`);
      params.push(categoryId);
    }
    if (isActive !== undefined) {
      conditions.push(`p.is_active = @${paramIndex++}`);
      params.push(isActive ? 1 : 0);
    }
    if (search) {
      conditions.push(`(p.product_name LIKE @${paramIndex} OR p.product_code LIKE @${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = conditions.join(' AND ');

    const countSql = `SELECT COUNT(*) AS total FROM [masters].[tbl_Products] p WHERE ${where};`;
    const dataSql = `
      SELECT
        p.product_id       AS productId,
        p.product_code     AS productCode,
        p.product_name     AS productName,
        p.category_id      AS categoryId,
        p.unit_price       AS unitPrice,
        p.is_active        AS isActive,
        p.created_at       AS createdAt,
        p.updated_at       AS updatedAt
      FROM [masters].[tbl_Products] p
      WHERE ${where}
      ORDER BY p.product_name ASC
      OFFSET @${paramIndex} ROWS FETCH NEXT @${paramIndex + 1} ROWS ONLY;
    `;

    const executor = this.getExecutor(qr);
    const [countResult, rows] = await Promise.all([
      executor.query(countSql, params),
      executor.query(dataSql, [...params, offset, pageSize]),
    ]);

    return {
      rows,
      total: Number(countResult[0]?.total ?? 0),
    };
  }

  // ─────────────────────────────────────────────
  // CREATE: Insert and return new UUID
  // ─────────────────────────────────────────────
  async create(
    data: {
      productCode: string;
      productName: string;
      categoryId: string;
      unitPrice: number;
      isActive: boolean;
      createdBy: string;
    },
    qr?: QueryRunner,
  ): Promise<string> {
    // Use OUTPUT INSERTED to return the generated primary key
    const sql = `
      INSERT INTO [masters].[tbl_Products] (
        product_code,
        product_name,
        category_id,
        unit_price,
        is_active,
        created_at,
        updated_at,
        created_by
      )
      OUTPUT INSERTED.product_id
      VALUES (@0, @1, @2, @3, @4, SYSUTCDATETIME(), SYSUTCDATETIME(), @5);
    `;
    const result = await this.getExecutor(qr).query(sql, [
      data.productCode,
      data.productName,
      data.categoryId,
      data.unitPrice,
      data.isActive ? 1 : 0,
      data.createdBy,
    ]);
    // OUTPUT returns an array of rows — grab the first row's ID
    return result[0].product_id;
  }

  // ─────────────────────────────────────────────
  // UPDATE: Partial update (only given fields)
  // ─────────────────────────────────────────────
  async update(
    productId: string,
    data: {
      productName?: string;
      categoryId?: string;
      unitPrice?: number;
      isActive?: boolean;
      updatedBy: string;
    },
    qr?: QueryRunner,
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = SYSUTCDATETIME()', 'updated_by = @0'];
    const params: any[] = [data.updatedBy];
    let paramIndex = 1;

    if (data.productName !== undefined) {
      setClauses.push(`product_name = @${paramIndex++}`);
      params.push(data.productName);
    }
    if (data.categoryId !== undefined) {
      setClauses.push(`category_id = @${paramIndex++}`);
      params.push(data.categoryId);
    }
    if (data.unitPrice !== undefined) {
      setClauses.push(`unit_price = @${paramIndex++}`);
      params.push(data.unitPrice);
    }
    if (data.isActive !== undefined) {
      setClauses.push(`is_active = @${paramIndex++}`);
      params.push(data.isActive ? 1 : 0);
    }

    params.push(productId); // Last param = the WHERE clause value
    const sql = `
      UPDATE [masters].[tbl_Products]
      SET ${setClauses.join(', ')}
      WHERE product_id = @${paramIndex};
    `;
    await this.getExecutor(qr).query(sql, params);
  }

  // ─────────────────────────────────────────────
  // DELETE (soft): Mark as inactive instead of deleting
  // ─────────────────────────────────────────────
  async softDelete(productId: string, deletedBy: string, qr?: QueryRunner): Promise<void> {
    const sql = `
      UPDATE [masters].[tbl_Products]
      SET is_active = 0,
          updated_at = SYSUTCDATETIME(),
          updated_by = @1
      WHERE product_id = @0;
    `;
    await this.getExecutor(qr).query(sql, [productId, deletedBy]);
  }
}
```

### Important SQL Rules

1. **Always alias columns to camelCase** using `AS`:
   ```sql
   p.product_id AS productId,   -- ✅ correct
   p.product_id,                -- ❌ never do this — TypeScript won't know the field name
   ```

2. **Always use parameterized queries** (`@0`, `@1`, etc.) — never string interpolation:
   ```typescript
   query(sql, [productId])                   // ✅ safe
   query(`WHERE id = '${productId}'`)        // ❌ NEVER — SQL injection vulnerability
   ```

3. **Always prefix table names with schema** (`[masters].[tbl_Products]`).

4. **Always accept and pass the `QueryRunner` parameter** — it enables transactions.

---

## Step 7 — Build the Service (Business Logic)

The service validates inputs, calls the repository, and throws proper errors.

**File:** `src/modules/products/services/products.service.ts`

```typescript
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IProduct } from '../interfaces/product.interface';
import { ProductEntity } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PRODUCT_ERROR_CODES } from '../products.constants';
import { ProductsRepository } from '../repositories/products.repository';
import { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────
  // Private helper: map raw DB row → API entity
  // ─────────────────────────────────────────────
  private toEntity(row: IProduct): ProductEntity {
    return {
      productId:   row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryId:  row.categoryId,
      unitPrice:   Number(row.unitPrice),
      isActive:    Boolean(row.isActive),
      createdAt:   new Date(row.createdAt),
      updatedAt:   new Date(row.updatedAt),
    };
  }

  // ─────────────────────────────────────────────
  // GET /products/:id
  // ─────────────────────────────────────────────
  async findById(productId: string): Promise<ProductEntity> {
    const row = await this.productsRepository.findById(productId);
    if (!row) {
      throw new HttpException(
        {
          code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
          message: `Product [${productId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.toEntity(row);
  }

  // ─────────────────────────────────────────────
  // GET /products
  // ─────────────────────────────────────────────
  async findAll(options: {
    categoryId?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { rows, total } = await this.productsRepository.findAll(options);
    return {
      data: rows.map((r) => this.toEntity(r)),
      total,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
    };
  }

  // ─────────────────────────────────────────────
  // POST /products
  // ─────────────────────────────────────────────
  async create(dto: CreateProductDto, user: ICurrentUser): Promise<ProductEntity> {
    // 1. Validate: check for duplicate code
    const existing = await this.productsRepository.findByCode(dto.productCode);
    if (existing) {
      throw new HttpException(
        {
          code: PRODUCT_ERROR_CODES.PRODUCT_CODE_DUPLICATE,
          message: `A product with code [${dto.productCode}] already exists.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    // 2. Use a transaction for safe writes
    const qr: QueryRunner = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 3. Insert into DB
      const newId = await this.productsRepository.create(
        {
          productCode: dto.productCode.toUpperCase().trim(),
          productName: dto.productName.trim(),
          categoryId:  dto.categoryId,
          unitPrice:   dto.unitPrice,
          isActive:    dto.isActive ?? true,
          createdBy:   user.userId,
        },
        qr,
      );

      await qr.commitTransaction();

      // 4. Return the newly created record
      return this.findById(newId);
    } catch (error) {
      await qr.rollbackTransaction();
      throw error; // Re-throw — NestJS converts unhandled errors to 500
    } finally {
      await qr.release(); // ALWAYS release the connection
    }
  }

  // ─────────────────────────────────────────────
  // PATCH /products/:id
  // ─────────────────────────────────────────────
  async update(
    productId: string,
    dto: UpdateProductDto,
    user: ICurrentUser,
  ): Promise<ProductEntity> {
    // 1. Check the record exists first
    const existing = await this.productsRepository.findById(productId);
    if (!existing) {
      throw new HttpException(
        {
          code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
          message: `Product [${productId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Apply the update
    await this.productsRepository.update(productId, {
      productName: dto.productName?.trim(),
      categoryId:  dto.categoryId,
      unitPrice:   dto.unitPrice,
      isActive:    dto.isActive,
      updatedBy:   user.userId,
    });

    // 3. Return the updated record
    return this.findById(productId);
  }

  // ─────────────────────────────────────────────
  // DELETE /products/:id
  // ─────────────────────────────────────────────
  async remove(productId: string, user: ICurrentUser): Promise<void> {
    // 1. Check the record exists
    const existing = await this.productsRepository.findById(productId);
    if (!existing) {
      throw new HttpException(
        {
          code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
          message: `Product [${productId}] was not found.`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Soft-delete (set is_active = 0, don't physically delete rows)
    await this.productsRepository.softDelete(productId, user.userId);
  }
}
```

### Key Service Rules

- **Always check if a record exists** before updating or deleting — throw `NOT_FOUND` if it doesn't.
- **Use transactions** (`QueryRunner`) whenever you write to the database, especially for multiple writes.
- **Always `release()` the QueryRunner** in a `finally` block so the DB connection is freed even if an error occurs.
- **Never return raw DB rows to the controller** — always map through `toEntity()` first.
- **Trim strings** before saving (`dto.productName.trim()`).

---

## Step 8 — Build the Controller (HTTP Endpoints)

The controller maps HTTP routes to service methods. Keep it thin — no business logic here, just routing and guards.

**File:** `src/modules/products/controllers/products.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permissions.guard';
import { InternalUserGuard } from '../../organization/org-scope/guards/internal-user.guard';
import { AuditInterceptor } from '../../audit/interceptor/audit.interceptor';
import { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductEntity } from '../entities/product.entity';
import { PRODUCT_PERMISSIONS } from '../products.constants';
import { ProductsService } from '../services/products.service';

@ApiTags('Products')                                       // Groups endpoints in Swagger UI
@ApiBearerAuth()                                           // All endpoints require JWT token
@UseGuards(InternalUserGuard, PermissionGuard)             // Auth guards applied globally
@UseInterceptors(AuditInterceptor)                         // Logs every request to audit table
@Controller('products')                                    // Base path: /api/v1/products
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─────────────────────────────────────────────
  // GET /api/v1/products
  // ─────────────────────────────────────────────
  @Get()
  @RequirePermissions(PRODUCT_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Get paginated list of products' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll({
      page:     page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/products/:id
  // ─────────────────────────────────────────────
  @Get(':id')
  @RequirePermissions(PRODUCT_PERMISSIONS.VIEW)
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, type: ProductEntity })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductEntity> {
    return this.productsService.findById(id);
  }

  // ─────────────────────────────────────────────
  // POST /api/v1/products
  // ─────────────────────────────────────────────
  @Post()
  @RequirePermissions(PRODUCT_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, type: ProductEntity })
  @ApiResponse({ status: 409, description: 'Product code already exists' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ProductEntity> {
    return this.productsService.create(dto, user);
  }

  // ─────────────────────────────────────────────
  // PATCH /api/v1/products/:id
  // ─────────────────────────────────────────────
  @Patch(':id')
  @RequirePermissions(PRODUCT_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update an existing product' })
  @ApiResponse({ status: 200, type: ProductEntity })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ProductEntity> {
    return this.productsService.update(id, dto, user);
  }

  // ─────────────────────────────────────────────
  // DELETE /api/v1/products/:id
  // ─────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)        // Returns 204 (no body) on success
  @RequirePermissions(PRODUCT_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Soft-delete a product' })
  @ApiResponse({ status: 204, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    return this.productsService.remove(id, user);
  }
}
```

### Controller Rules

| Decorator/Pattern | When to use it |
|---|---|
| `@ParseUUIDPipe` | Always — for UUID route params like `:id`. Validates format automatically. |
| `@CurrentUser()` | When you need the logged-in user's ID (e.g. for `createdBy`, `updatedBy`). |
| `@RequirePermissions()` | Every endpoint — specify which permission is needed. |
| `@HttpCode(HttpStatus.NO_CONTENT)` | DELETE endpoints that return no body. |
| `@Query()` params as `string` | Always receive query strings as `string`, then convert in the service. |

**HTTP Status codes to use:**
- `200 OK` — successful GET or PATCH
- `201 Created` — successful POST (NestJS default for POST)
- `204 No Content` — successful DELETE (no response body)
- `400 Bad Request` — validation failed (NestJS handles this automatically via class-validator)
- `401 Unauthorized` — not logged in (guards handle this automatically)
- `403 Forbidden` — missing permission (PermissionGuard handles this)
- `404 Not Found` — record doesn't exist (you throw this in the service)
- `409 Conflict` — duplicate record (you throw this in the service)
- `500 Internal Server Error` — unhandled error (never throw this manually)

---

## Step 9 — Create the index.ts Barrel File

The barrel file re-exports everything from the module so other modules can import cleanly from one place.

**File:** `src/modules/products/index.ts`

```typescript
export * from './products.constants';
export * from './interfaces/product.interface';
export * from './entities/product.entity';
export * from './dto/create-product.dto';
export * from './dto/update-product.dto';
export * from './repositories/products.repository';
export * from './services/products.service';
export * from './controllers/products.controller';
```

---

## Step 10 — Register Everything in the Module

The NestJS module file wires everything together via dependency injection. Every class must be declared in `providers` before it can be injected.

**File:** `src/modules/products/products.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ProductsController } from './controllers/products.controller';
import { ProductsRepository } from './repositories/products.repository';
import { ProductsService } from './services/products.service';

@Module({
  controllers: [ProductsController],  // ← registers HTTP routes
  providers: [
    ProductsService,        // ← business logic class
    ProductsRepository,     // ← SQL queries class
  ],
  exports: [
    ProductsService,        // ← export if other modules need to call ProductsService
    ProductsRepository,     // ← export if other modules need to run product queries
  ],
})
export class ProductsModule {}
```

Then **register your module in the app root** (`src/app.module.ts`):

```typescript
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    // ... existing modules ...
    ProductsModule,   // ← add yours here
  ],
})
export class AppModule {}
```

---

## Common Patterns Cheatsheet

### Throw a 404 Not Found

```typescript
throw new HttpException(
  {
    code: PRODUCT_ERROR_CODES.PRODUCT_NOT_FOUND,
    message: `Product [${productId}] was not found.`,
  },
  HttpStatus.NOT_FOUND,
);
```

### Throw a 409 Conflict (duplicate)

```typescript
throw new HttpException(
  {
    code: PRODUCT_ERROR_CODES.PRODUCT_CODE_DUPLICATE,
    message: `A product with code [${dto.productCode}] already exists.`,
  },
  HttpStatus.CONFLICT,
);
```

### Use a database transaction

```typescript
const qr = this.dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
try {
  await this.productsRepository.create(data, qr);
  // add more writes here if needed
  await qr.commitTransaction();
} catch (err) {
  await qr.rollbackTransaction();
  throw err;
} finally {
  await qr.release(); // ← ALWAYS release, even on error
}
```

### Get the ID of a newly inserted row

In SQL:
```sql
INSERT INTO [masters].[tbl_Products] (...)
OUTPUT INSERTED.product_id
VALUES (...);
```

In TypeScript:
```typescript
const result = await executor.query(sql, params);
const newId: string = result[0].product_id;
```

### Build a dynamic WHERE clause

```typescript
const conditions: string[] = ['1=1'];
const params: any[] = [];
let i = 0;

if (options.isActive !== undefined) {
  conditions.push(`p.is_active = @${i++}`);
  params.push(options.isActive ? 1 : 0);
}
if (options.search) {
  conditions.push(`p.product_name LIKE @${i++}`);
  params.push(`%${options.search}%`);
}

const where = conditions.join(' AND ');
const sql = `SELECT ... FROM [masters].[tbl_Products] p WHERE ${where}`;
await this.dataSource.query(sql, params);
```

### Pagination in SQL Server (MSSQL syntax)

```sql
SELECT ...
FROM [masters].[tbl_Products]
ORDER BY product_name ASC
OFFSET @5 ROWS FETCH NEXT @6 ROWS ONLY;
```

```typescript
const offset = (page - 1) * pageSize;   // page 1 → offset 0, page 2 → offset 20
params.push(offset, pageSize);
```

---

## Things You Must Never Do

| ❌ Don't | ✅ Do instead |
|---|---|
| Put SQL inside the Service | Move SQL to the Repository |
| Put business logic inside the Controller | Move it to the Service |
| Use string interpolation in SQL queries | Use `@0`, `@1` parameterized queries |
| Use TypeORM `@Entity` decorator | Use plain `class` with `@ApiProperty` |
| Hardcode permission strings in code | Use constants from `*.constants.ts` |
| Hardcode error code strings | Use error codes from `*.constants.ts` |
| Return a raw DB row directly from Service | Always map through `toEntity()` |
| Forget `await qr.release()` | Always wrap query runner in `try/finally` |
| Use `ParseIntPipe` for UUID params | Use `ParseUUIDPipe` |
| Use snake_case column names in TypeScript | Always SQL-alias with `AS camelCase` |
| Use `any` type without a comment explaining why | Use proper TypeScript interfaces |

---

## Quick Reference: API Endpoint Naming

| Action | HTTP Method | Example Route | Permission |
|---|---|---|---|
| List all (paginated) | `GET` | `/products` | `PRODUCT.VIEW` |
| Get single record | `GET` | `/products/:id` | `PRODUCT.VIEW` |
| Create | `POST` | `/products` | `PRODUCT.CREATE` |
| Partial update | `PATCH` | `/products/:id` | `PRODUCT.UPDATE` |
| Soft-delete | `DELETE` | `/products/:id` | `PRODUCT.DELETE` |
| Activate | `POST` | `/products/:id/activate` | `PRODUCT.UPDATE` |
| Deactivate | `POST` | `/products/:id/deactivate` | `PRODUCT.UPDATE` |
| Export to Excel | `GET` | `/products/export` | `PRODUCT.EXPORT` |

> **Always use `PATCH` (not `PUT`)** for updates. PATCH means "update only the fields I send". We never use PUT in this codebase.

---

## Summary: Checklist for a New Module

Copy this checklist when building a new domain:

```
[ ] src/modules/my-domain/interfaces/my-entity.interface.ts
[ ] src/modules/my-domain/entities/my-entity.entity.ts
[ ] src/modules/my-domain/dto/create-my-entity.dto.ts
[ ] src/modules/my-domain/dto/update-my-entity.dto.ts
[ ] src/modules/my-domain/my-domain.constants.ts
[ ] src/modules/my-domain/repositories/my-entity.repository.ts
[ ] src/modules/my-domain/services/my-entity.service.ts
[ ] src/modules/my-domain/controllers/my-entity.controller.ts
[ ] src/modules/my-domain/index.ts
[ ] src/modules/my-domain/my-domain.module.ts
[ ] Registered in src/app.module.ts
```

Done! Follow this pattern and your API will be consistent with the rest of the OMS codebase. 🚀
