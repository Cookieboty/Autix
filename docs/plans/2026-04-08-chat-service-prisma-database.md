# services/chat Prisma + pgvector Database Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Prisma ORM + pgvector support to `services/chat`, defining Conversation, Message, Document, and DocumentChunk tables, and exposing a global `PrismaModule`/`PrismaService`.

**Architecture:** Schema lives directly in `services/chat/prisma/schema.prisma` (Option A — self-contained). A global `PrismaModule` is registered in `AppModule`, exporting `PrismaService` to all feature modules. The DocumentChunk table stores vector embeddings via the `pgvector` Prisma extension.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 15+, pgvector extension, Bun

---

### Task 1: Install Prisma dependencies

**Files:**
- Modify: `services/chat/package.json` (via bun add)

**Step 1: Install runtime and dev dependencies**

Run from repo root (or `cd services/chat` first):

```bash
cd /Users/botycookie/test/llm/services/chat
bun add @prisma/client
bun add -d prisma
```

Expected: `node_modules/.prisma` and `node_modules/@prisma/client` present.

**Step 2: Verify install**

```bash
bunx prisma --version
```

Expected: prints Prisma CLI version (6.x).

**Step 3: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/package.json bun.lockb
git commit -m "feat(chat): add prisma and @prisma/client dependencies"
```

---

### Task 2: Initialize Prisma and configure DATABASE_URL

**Files:**
- Create: `services/chat/prisma/schema.prisma`
- Modify: `services/chat/.env`

**Step 1: Run prisma init**

```bash
cd /Users/botycookie/test/llm/services/chat
bunx prisma init --datasource-provider postgresql
```

Expected: Creates `prisma/schema.prisma` and appends `DATABASE_URL` to `.env`.

**Step 2: Update DATABASE_URL in .env**

The generated `.env` will have a placeholder. Replace it with your actual local PostgreSQL URL:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/autix_chat?schema=public"
```

> Note: Adjust username/password/dbname to match your local PostgreSQL setup.

**Step 3: Verify schema.prisma was created**

```bash
cat services/chat/prisma/schema.prisma
```

Expected: Contains `datasource db { provider = "postgresql" ... }` and `generator client { ... }`.

**Step 4: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/prisma/schema.prisma
git commit -m "feat(chat): initialize prisma with postgresql datasource"
```

> `.env` is gitignored — do not add it to git.

---

### Task 3: Design and write the Prisma schema

**Files:**
- Modify: `services/chat/prisma/schema.prisma`

**Step 1: Replace schema.prisma with full schema**

Replace the entire contents of `services/chat/prisma/schema.prisma` with:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model Conversation {
  id        String    @id @default(cuid())
  userId    String
  title     String    @default("New Conversation")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]

  @@index([userId])
  @@map("conversations")
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           MessageRole
  content        String
  createdAt      DateTime     @default(now())

  @@index([conversationId])
  @@map("messages")
}

enum MessageRole {
  USER
  ASSISTANT
}

model Document {
  id        String          @id @default(cuid())
  userId    String
  filename  String
  mimeType  String
  createdAt DateTime        @default(now())
  chunks    DocumentChunk[]

  @@index([userId])
  @@map("documents")
}

model DocumentChunk {
  id         String                  @id @default(cuid())
  documentId String
  document   Document                @relation(fields: [documentId], references: [id], onDelete: Cascade)
  content    String
  embedding  Unsupported("vector")?
  chunkIndex Int

  @@index([documentId])
  @@map("document_chunks")
}
```

**Step 2: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/prisma/schema.prisma
git commit -m "feat(chat): define Prisma schema - Conversation, Message, Document, DocumentChunk with pgvector"
```

---

### Task 4: Enable pgvector extension in PostgreSQL and run migration

**Files:**
- Creates: `services/chat/prisma/migrations/*/migration.sql`

**Step 1: Ensure pgvector extension exists in your database**

Connect to your PostgreSQL database and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

You can do this via psql:

```bash
psql -U postgres -d autix_chat -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

> If the database doesn't exist yet, create it first: `createdb -U postgres autix_chat`

**Step 2: Run initial migration**

```bash
cd /Users/botycookie/test/llm/services/chat
bunx prisma migrate dev --name init
```

Expected output:
```
Applying migration `20260408_init`
Database changes applied
✔  Generated Prisma Client
```

**Step 3: Verify migration files were created**

```bash
ls services/chat/prisma/migrations/
```

Expected: a timestamped folder like `20260408000000_init/migration.sql`.

**Step 4: Commit migration**

```bash
cd /Users/botycookie/test/llm
git add services/chat/prisma/migrations/
git commit -m "feat(chat): add initial Prisma migration - conversations, messages, documents, document_chunks"
```

---

### Task 5: Generate Prisma Client

**Files:**
- Modifies: `services/chat/node_modules/.prisma/client/` (generated, not committed)

**Step 1: Generate client**

```bash
cd /Users/botycookie/test/llm/services/chat
bunx prisma generate
```

Expected:
```
✔ Generated Prisma Client (vX.Y.Z) to ./node_modules/.prisma/client
```

**Step 2: Add generate script to package.json**

In `services/chat/package.json`, add to `scripts`:

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:studio": "prisma studio"
```

**Step 3: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/package.json
git commit -m "feat(chat): add prisma scripts to package.json"
```

---

### Task 6: Create PrismaService

**Files:**
- Create: `services/chat/src/prisma/prisma.service.ts`

**Step 1: Create the file**

Create `services/chat/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Step 2: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/src/prisma/prisma.service.ts
git commit -m "feat(chat): add PrismaService extending PrismaClient"
```

---

### Task 7: Create PrismaModule

**Files:**
- Create: `services/chat/src/prisma/prisma.module.ts`

**Step 1: Create the file**

Create `services/chat/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Step 2: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/src/prisma/prisma.module.ts
git commit -m "feat(chat): add global PrismaModule"
```

---

### Task 8: Register PrismaModule in AppModule

**Files:**
- Modify: `services/chat/src/app.module.ts`

**Step 1: Add PrismaModule import**

Update `services/chat/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LlmModule } from './llm/llm.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [PrismaModule, LlmModule, AuthModule],
})
export class AppModule {}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/botycookie/test/llm/services/chat
bun run typecheck
```

Expected: no errors.

**Step 3: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/src/app.module.ts
git commit -m "feat(chat): register PrismaModule in AppModule"
```

---

### Task 9: Verify service starts correctly

**Step 1: Build the service**

```bash
cd /Users/botycookie/test/llm/services/chat
bun run build
```

Expected: `dist/` created with no TypeScript errors.

**Step 2: Start the service**

```bash
bun run start
```

Expected: NestJS starts, logs show `PrismaClient` connecting to the database without errors.

**Step 3: Confirm DB connection**

Look for no errors in the startup logs. If you see `Can't reach database server`, verify:
- PostgreSQL is running locally
- `DATABASE_URL` in `.env` is correct
- The `autix_chat` database exists

---

### Task 10: Add DATABASE_URL to .env.example

**Files:**
- Modify: `services/chat/.env.example` (create if it doesn't exist)

**Step 1: Create/update .env.example**

Add `DATABASE_URL` placeholder so other developers know what's needed:

```bash
cat >> services/chat/.env.example << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/autix_chat?schema=public"
EOF
```

If `.env.example` doesn't exist, create it with all required variables:

```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=your_embedding_api_key_here
JWT_SECRET=your-super-secret-key-min-32-chars-change-in-production
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/autix_chat?schema=public"
```

**Step 2: Commit**

```bash
cd /Users/botycookie/test/llm
git add services/chat/.env.example
git commit -m "chore(chat): add DATABASE_URL to .env.example"
```

---

## Summary

After completing all tasks:

| What | Where |
|------|-------|
| Prisma schema | `services/chat/prisma/schema.prisma` |
| Migrations | `services/chat/prisma/migrations/` |
| PrismaService | `services/chat/src/prisma/prisma.service.ts` |
| PrismaModule | `services/chat/src/prisma/prisma.module.ts` |
| AppModule registration | `services/chat/src/app.module.ts` |

Any feature module that needs database access can inject `PrismaService` directly — no need to import `PrismaModule` again since it's `@Global()`.

```typescript
// Example usage in any service
@Injectable()
export class SomeService {
  constructor(private prisma: PrismaService) {}

  async getConversations(userId: string) {
    return this.prisma.conversation.findMany({ where: { userId } });
  }
}
```
