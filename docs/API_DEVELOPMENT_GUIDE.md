# OMS Backend: API Development Guide for Freshers

Welcome to the OMS Backend team! This guide will walk you through the process of building a new API endpoint from scratch in our NestJS application. 

By following this guide, you will understand how the different layers of our application interact and how to write clean, maintainable, and consistent code.

---

## 🏗️ 1. Understanding the Architecture

We follow a **Domain-Driven Modular Architecture**. For every API request, the flow looks like this:

1. **Client Request**: A frontend app sends an HTTP request (e.g., `POST /users`).
2. **Controller**: Receives the request, validates the input payload using a **DTO**, and passes data to the Service.
3. **Service**: Contains the core business logic. It applies rules and asks the Repository to fetch or save data.
4. **Repository**: Handles all direct database interactions using raw SQL queries via `mssql` and `typeorm` DataSource.
5. **Response**: The Repository returns data to the Service, which returns it to the Controller, which finally sends an HTTP response back to the client.

---

## 🛠️ 2. Step-by-Step API Development

Let's build a new API endpoint (e.g., "Create a Product"). We will assume you are working inside the `products` module. If the module doesn't exist, you can generate it using the Nest CLI: `npx nest g module modules/products`.

### Step 1: Create the DTO (Data Transfer Object)
A DTO defines the exact structure of data the client is allowed to send. We use `class-validator` to automatically check if the incoming data is correct.

**File:** `src/modules/products/dto/create-product.dto.ts`
```typescript
import { IsNotEmpty, IsString, IsNumber, MaxLength, IsOptional } from 'class-validator';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsNumber()
    price: number;

    @IsOptional()
    @IsString()
    description?: string;
}
```
*Tip: Always use decorators like `@IsNotEmpty()`, `@IsString()`, etc., to secure your APIs against bad data.*

### Step 2: Create the Repository
The repository is strictly responsible for running database queries. In this project, we use raw SQL queries via the TypeORM `DataSource`.

**File:** `src/modules/products/repositories/products.repository.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateProductDto } from '../dto/create-product.dto';

@Injectable()
export class ProductsRepository {
    // Inject DataSource to run raw SQL queries
    constructor(private readonly dataSource: DataSource) {}

    async createProduct(dto: CreateProductDto) {
        // Example of a raw SQL insertion using parameterized queries.
        // NOTE: Syntax might slightly vary depending on MSSQL driver mapping, 
        // but always use parameterized queries to prevent SQL Injection!
        const result = await this.dataSource.query(
            `INSERT INTO Products (Name, Price, Description)
             OUTPUT INSERTED.*
             VALUES (@0, @1, @2)`,
            [dto.name, dto.price, dto.description]
        );
        return result[0];
    }
}
```

### Step 3: Create the Service
The service orchestrates business logic. It calls the repository to do the heavy lifting with the database.

**File:** `src/modules/products/services/products.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { ProductsRepository } from '../repositories/products.repository';
import { CreateProductDto } from '../dto/create-product.dto';

@Injectable()
export class ProductsService {
    // Inject the Repository into the Service
    constructor(private readonly productsRepository: ProductsRepository) {}

    async create(dto: CreateProductDto) {
        // You can add business logic here (e.g., checking if product already exists)
        return this.productsRepository.createProduct(dto);
    }
}
```

### Step 4: Create the Controller
The controller exposes the HTTP endpoint to the outside world.

**File:** `src/modules/products/controllers/products.controller.ts`
```typescript
import { Body, Controller, Post, Inject } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dto/create-product.dto';

@Controller('products') // Defines the route: http://localhost:3000/products
export class ProductsController {
    // Inject the Service into the Controller
    constructor(
        @Inject(ProductsService)
        private readonly productsService: ProductsService,
    ) {}

    @Post() // Maps to a POST request
    async create(@Body() dto: CreateProductDto) {
        // NestJS automatically validates the `dto` because of class-validator!
        return this.productsService.create(dto);
    }
}
```

### Step 5: Register Everything in the Module
For NestJS to recognize your new Controller, Service, and Repository, you must register them in the module file.

**File:** `src/modules/products/products.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ProductsController } from './controllers/products.controller';
import { ProductsService } from './services/products.service';
import { ProductsRepository } from './repositories/products.repository';

@Module({
    controllers: [ProductsController],
    providers: [ProductsService, ProductsRepository],
    exports: [ProductsService] // Export if other modules need to use this service
})
export class ProductsModule {}
```

---

## 🎯 3. Best Practices & Rules to Follow

1. **Strict Folder Structure:** Always place files in their designated folders (`controllers`, `services`, `repositories`, `dto`, `entities`). Reference `PROJECT_MANUAL.md` for the exact layout.
2. **No Business Logic in Controllers:** Controllers should only receive the request, optionally log it, and pass it immediately to the Service.
3. **No Database Calls in Services:** Services should never write SQL queries. They must ask the Repository to fetch or save data.
4. **Always Validate Inputs:** Never trust client data. Always create a DTO and use `class-validator` decorators to enforce strict types.
5. **Raw SQL over ORM:** This project uses raw SQL via TypeORM's `DataSource` for `mssql` integration. Always remember to use **parameterized queries** to prevent SQL injection vulnerabilities.

---
**Welcome aboard and happy coding! 🚀**
