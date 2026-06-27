# OMS Backend Project Description & Manual

This manual provides an overview of the OMS Backend project structure, focusing on the directory organization and the specific API structure implemented across modules.

## 1. Project Overview
This project is a backend application built using NestJS. It follows a modular architecture to organize feature sets, ensure separation of concerns, and make the codebase scalable and maintainable.

## 2. General Directory Structure

Here is the high-level structure of the `src/` directory:

```text
src/
├── app.module.ts          # Main application module that imports all feature modules
├── main.ts                # Application entry point
├── common/                # Shared resources across the app (constants, decorators, filters, guards, etc.)
├── config/                # Environment configuration loading and validation
├── database/              # Database connection and setup
└── modules/               # Feature modules containing the core business features (e.g., authorization, health)
```

## 3. Module Architecture (API Structure)

The backend follows a domain-driven module structure. To maintain consistency and separation of concerns, each feature module should strictly adhere to the following directory and file responsibilities:

| Folder / File | Responsibility |
| ------------- | -------------- |
| `controllers/`| HTTP endpoints only. They receive client requests, call services, and return responses. |
| `services/`   | Business logic. They orchestrate rules, process data, and connect controllers to repositories. |
| `repositories/`| SQL queries using `mssql`. They handle all direct database interactions. |
| `dto/`        | Request validation (Data Transfer Objects). Used to validate incoming payload structures. |
| `entities/`   | API response models. Represents the structure of data as it exists in the database/system. |
| `interfaces/` | TypeScript contracts. Defines typings and abstractions for the module. |
| `mapper/`     | Convert database rows to API models. Handles data transformation between layers. |
| `constants/`  | Module-specific constants. |

> **Note**: Depending on module complexity, some components like `mapper` and `constants` might exist as standalone files (e.g., `*.mapper.ts`, `*.constants.ts`) at the module root rather than in dedicated folders.

## 4. Example Module Layout (`users` module)

As a concrete reference, here is how a complete module (like the `users` module under `authorization`) is structured based on the above guidelines:

```text
src/modules/authorization/users/
├── controllers/
│   └── users.controller.ts
├── dto/
│   ├── assign-roles.dto.ts
│   ├── assign-scopes.dto.ts
│   ├── create-user.dto.ts
│   ├── list-users.dto.ts
│   ├── update-user.dto.ts
│   └── user-response.dto.ts
├── entities/
│   └── user.entity.ts
├── interfaces/
│   └── user.interface.ts
├── repositories/
│   └── users.repository.ts
├── services/
│   └── users.service.ts
├── index.ts
├── users.constants.ts       # Standalone constants file
├── users.mapper.ts          # Standalone mapper file
└── users.module.ts          # NestJS module definition
```





[
  'REQUISITION.CREATE',
  'REQUISITION.VIEW',
  'REQUISITION.APPROVE',
  'REQUISITION.REJECT',
  'BUDGET.VIEW',
  'BUDGET.LOCK',
  'BUDGET.RELEASE',
  'INTERVIEW.SCHEDULE',
  'INTERVIEW.BYPASS',
  'CANDIDATE.VIEW',
  'CANDIDATE.UNMASK',
  'USER.MANAGE',
  'ROLE.MANAGE',
  'SECURITY.FAILED_LOGINS.VIEW',
  'SECURITY.SESSIONS.REVOKE',
  'SECURITY.EVENTS.EXPORT',
  'SECURITY.ADMIN',
  'SECURITY.USERS.FORCE_LOGOUT',
  'SECURITY.DASHBOARD.VIEW',
  'SECURITY.EVENTS.VIEW',
  'SECURITY.SESSIONS.VIEW'
]
