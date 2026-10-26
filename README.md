# Nivara

A role-based budget and software-purchase management platform for teams. Nivara supports purchase requests, monthly budget allocation, shared team spending, renewals, reporting, and audit history.

## Tech stack

- Next.js 15 and React 19
- TypeScript
- Prisma and PostgreSQL
- Jest and Playwright
- Docker Compose for local PostgreSQL

## Features

- Role-based workflows for employees, managers, CTOs, and administrators
- Personal and shared team budget tracking
- Purchase requests, approvals, renewals, and expiry reminders
- Financial history, reports, and audit logs
- Persian-first UI with localization support

## Local development

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:generate
npm run db:migrate
npm run dev
```

## Quality checks

```bash
npm run lint
npm test
npm run test:e2e
```

> The project is under active development.
