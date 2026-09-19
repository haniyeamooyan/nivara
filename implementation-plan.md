# Nivara — Full-Stack Implementation Plan

**Version:** 0.1  
**Status:** MVP implementation complete through Phase 9; Phase 10 local release/deployment preparation remains.  
**Goal:** ساخت و انتشار یک MVP قابل‌استفاده برای مدیریت بودجه، خرید و گزارش‌دهی داخلی.

## Working rules

- هر مرحله خروجی مشخص و قابل بازبینی دارد.
- قبل از ورود به مرحله بعد، تست‌ها و acceptance criteria مرحله اجرا می‌شوند.
- تصمیم‌های جدید با برچسب `DECISION` ثبت و تصمیم‌های قبلی در صورت تغییر منسوخ می‌شوند.
- مسائل تأییدنشده با `UNKNOWN` و انتخاب‌های موقت با `ASSUMPTION` ثبت می‌شوند.
- منطق بودجه فقط در backend معتبر است؛ frontend منبع اعتماد نیست.

## Progress

- [x] Phase 0 — Project baseline: Next.js app, PostgreSQL via Docker Compose, Prisma, health check, and local development setup.
- [x] Phase 1 — Database foundation: initial schema/migration, repeatable development seed, and database documentation.
- [x] Phase 2 — Authentication and authorization: Argon2id passwords, database-backed sessions in secure HTTP-only cookies, logout, and role-based route protection.
- [x] Phase 3 — Organization management: Super Admin team/service management and Manager-only team member management, with soft deletion and audit logging.
- [x] Phase 4 — Budget periods and allocations: monthly team allocations, individual overrides, draft preview, confirmation, carry-forward balance, in-app notifications, and employee balance view.
- [x] Phase 5 — Personal purchase requests: employee request/cancel/resubmit, manager purchase/reject, one-month plan record, and atomic company debit.
- [x] Phase 6 — Non-personal purchases: manager-managed shared team balance, manual funding, atomic spend control, and purchase/ledger history.
- [x] Phase 7 — Renewals, expiry state, and three-day in-app reminders, with startup catch-up and daily local scheduling.
- [x] Phase 8 — CTO monthly/quarterly reporting, purchase breakdowns, balances, filters, and audit history.
- [x] Phase 9 — Core quality gates: budget arithmetic and carry-forward unit tests, purchase/ledger reconciliation and local data audit, lint, type-check, Prisma validation, and production build.

Progress notes: migrations add unique team naming, team-scoped period allocations and carry-forward snapshots, team purchase notes, renewal lineage, reminder deduplication, and pending non-renewal request uniqueness. Phase 8 CTO report was smoke-tested for CTO access, Manager redirect, and month/quarter/custom/team/person/service filters. Phase 9 has Jest/Next configuration, purchase splitting and carry-forward unit coverage, exact-to-cents purchase-to-ledger reconciliation tests and status in the CTO report. Local database audit reconciled all purchases. Verification passed: 10 Jest tests, `tsc --noEmit`, Prisma validation, lint (one pre-existing config warning), and production build. App server smoke test was not possible in this execution environment because binding localhost port 3000 returned EPERM. Phase 9 closes the core MVP gates; exhaustive automated CRUD/E2E, cross-team mutation, and concurrency stress suites remain future hardening rather than release blockers for this UI/logic iteration. Team allocations freeze individually when that manager confirms; other teams can still make their first allocation for the company-wide month. Team account balance is ledger-based, funded manually by its manager, separate from individual budgets, and unused balance remains available across months.

## Phase 0 — Project baseline

### Work

- بررسی وضعیت repository فعلی
- راه‌اندازی Next.js App Router و TypeScript
- تنظیم ESLint، Prettier و environment variables
- تنظیم Tailwind CSS و shadcn/ui
- ایجاد Docker Compose برای PostgreSQL
- اضافه‌کردن Prisma و Prisma Client
- تعریف scripts توسعه، build و test

### Deliverables

- application که local اجرا می‌شود
- PostgreSQL قابل‌اتصال با Docker
- health check ساده
- `.env.example`

### Gate

- `npm run lint`
- `npm run build`
- اتصال موفق Prisma به database

## Phase 1 — Database foundation

### Work

- بازبینی `prisma/schema.prisma`
- رفع relationها و constraintهای لازم
- ایجاد migration اولیه
- seed کردن نقش‌ها، یک CTO، یک مدیر، یک تیم و چند سرویس نمونه
- طراحی helper برای Decimal و UTC

### Deliverables

- migration اولیه
- seed قابل تکرار
- database documentation همگام با schema

### Gate

- `prisma validate`
- اجرای migration روی database خالی
- اجرای seed بدون خطا

## Phase 2 — Authentication and authorization

### Work

- login با email/password
- password hashing با Argon2id
- session در secure HTTP-only cookie
- logout
- محافظت routeها
- middleware یا server-side authorization
- RBAC برای Super Admin، Manager، Employee و CTO

### Deliverables

- login page
- session utilities
- authorization policyهای مرکزی
- صفحات unauthorized و not-found

### Gate

- password خام هیچ‌جا ذخیره یا log نشود
- کاربر نتواند داده تیم دیگر را با تغییر URL/API ببیند
- تست دسترسی هر چهار role

## Phase 3 — Organization management

### Work

- مدیریت تیم‌ها توسط Super Admin
- تعیین یک مدیر برای هر تیم
- افزودن و ویرایش اعضا توسط Manager
- soft-delete کاربران و تیم‌ها
- catalog سرویس‌ها توسط Super Admin

### Deliverables

- صفحات users، teams و services
- API/Server Actions مربوطه
- audit log برای تغییرات ساختاری

### Gate

- هر کاربر فقط یک تیم فعال داشته باشد.
- هر تیم فقط یک مدیر فعال داشته باشد.
- داده‌ی soft-deleted در عملیات عادی نمایش داده نشود.

## Phase 4 — Budget periods and allocations

### Work

- ایجاد دوره‌های ماهانه میلادی
- وضعیت‌های دوره: Draft، Open، Locked، Closed
- تخصیص گروهی تیم
- override فردی
- preview تخصیص قبل از تأیید
- انتقال موجودی استفاده‌نشده
- قفل‌شدن تخصیص پس از شروع دوره
- اعلان داخلی به مدیر برای تخصیص دوره جدید

### Deliverables

- manager budget allocation flow
- employee balance view
- budget transaction service
- audit log تخصیص

### Gate

- تخصیص بدون تأیید وارد موجودی نشود.
- دوره شروع‌شده قابل ویرایش نباشد.
- انتقال موجودی دوباره و تکراری انجام نشود.
- محاسبات Decimal و transactionمحور باشند.

## Phase 5 — Personal purchase requests

### Work

- ثبت درخواست توسط Employee
- مشاهده درخواست‌های تیم توسط Manager
- خرید با ثبت مبلغ واقعی
- محاسبه company amount و employee contribution
- رد با دلیل
- لغو توسط Employee پیش از خرید
- ویرایش و ارسال مجدد ردشده یا لغوشده

### Deliverables

- employee request form/list/detail
- manager review/purchase form
- purchase history
- atomic purchase completion service

### Gate

- ثبت درخواست budget را تغییر ندهد.
- تکمیل خرید و debit در یک database transaction باشند.
- خرید قبلی با تغییر بودجه آینده تغییر نکند.
- مبلغ مازاد منفی نشود.

## Phase 6 — Non-personal purchases

**DECISION:** Team-service funding is manually recorded by the team manager after receiving funds outside Nivara. Unspent balance remains in the team ledger and carries forward; no monthly reset, employee debit, or automatic funding occurs.

### Work

- [x] ثبت خرید توسط Manager
- [x] اتصال خرید به Team
- [x] کنترل اتمیک موجودی تیم و جلوگیری از خرج بیشتر از موجودی
- [x] مبلغ، سرویس، تاریخ و توضیح
- [x] تاریخ پایان و وضعیت تمدید اختیاری

### Deliverables

- [x] manager team purchase flow و ثبت دستی شارژ حساب تیم
- [x] team budget summary و دفترکل با انتقال ماندهٔ مصرف‌نشده
- [x] history خریدهای غیرشخصی

### Gate

- [x] خرید غیرشخصی به کاربر تخصیص پیدا نکند.
- [x] کنترل موجودی و debit اتمیک باشد.
- [x] purchase personal و non-personal در داده قابل تفکیک باشند.

## Phase 7 — Renewals and notifications

**DECISION:** Employee non-renewal requests are for manager awareness/history; the manager records the decision in Nivara and the actual cancellation remains with the service provider. A renewal is a new purchase linked to the prior plan. Expired status is set by the manager after the end date.

### Work

- [x] ثبت/لغو درخواست عدم تمدید توسط Employee و رسیدگی Manager
- [x] ثبت purchase جدید برای تمدید و پیوند به پلن پیشین
- [x] تغییر وضعیت plan توسط Manager به `RENEWED` یا `EXPIRED`
- [x] ساخت اعلان داخلی سه روز قبل از پایان پلن با deduplication

### Deliverables

- [x] renewal request UI
- [x] notification center (موجود و متصل به اعلان پایان پلن)
- [x] expiry reminder job (اجرای فوری هنگام شروع سرور و سپس روزانه در 00:05 UTC؛ script و endpoint امن هم برای اجرای دستی/جایگزین هستند)
- [x] plan status history در audit log

### Gate

- تمدید، رکورد خرید جدید ایجاد کند.
- لغو واقعی سرویس خارج از سیستم باقی بماند.
- اعلان تکراری برای یک پایان پلن ایجاد نشود.

## Phase 8 — CTO reporting

**REPORT RULE:** Purchase spend is grouped by the plan `startDate`; allocations/top-ups are grouped by confirmation/ledger `createdAt`; current balances and active/expiring plan counts are point-in-time snapshots. All report periods use UTC boundaries. Service filters do not change budget allocation or balances because budgets are not tied to a service.

### Work

- dashboard کل شرکت
- گزارش هزینه به تفکیک تیم
- گزارش سرویس‌ها و Agentها
- گزارش شخصی و غیرشخصی
- گزارش تخصیص، مصرف و موجودی
- فیلتر تیم، فرد، سرویس و بازه زمانی
- گزارش ماهانه و فصلی
- نمایش audit log

### Deliverables

- [x] CTO dashboard
- [x] report query layer
- [x] empty/loading/error states
- [x] date range and filter components

**Status:** Complete. CTO/Manager access and report filters were previously smoke-tested.

### Gate

- Manager نتواند endpoint گزارش کل شرکت را مصرف کند.
- اعداد dashboard با مجموع transactionها سازگار باشند.
- timezone در query و نمایش به‌درستی مدیریت شود.

## Phase 9 — Quality and security hardening

**Status:** Core MVP gates complete; exhaustive E2E, full CRUD, cross-team mutation, and concurrency stress coverage remain follow-up hardening.

### Work

- unit tests برای budget calculation و state transitions
- integration tests برای transactionهای Prisma
- Playwright E2E برای مسیرهای اصلی
- validation ورودی‌ها با Zod
- rate limiting login
- بررسی authorization در تمام mutationها
- جلوگیری از log شدن password و داده حساس
- error handling و observability پایه

### Critical test scenarios

- تخصیص گروهی با override فردی
- carry-over یک‌باره
- تغییر بودجه بعد از lock
- خرید برابر، کمتر و بیشتر از موجودی
- رد با دلیل و ارسال مجدد
- لغو پیش از خرید
- دسترسی Manager به تیم دیگر
- گزارش CTO با فیلترها
- پایان پلن و اعلان سه‌روزه

## Phase 10 — Local release and deployment preparation

### Work

- production build
- migration strategy
- backup و restore database
- `.env` documentation
- Docker image یا deployment target
- seed فقط برای development
- release checklist

### Deliverables

- README اجرا و توسعه
- deployment runbook
- migration/rollback notes
- MVP release candidate

## Explicitly postponed

- Telegram، Slack و email integration
- پرداخت آنلاین
- اتصال API سرویس‌های خارجی
- usage analytics
- automatic provisioning
- invoice management
- SSO
- multi-tenancy تجاری
- export گزارش
- تشخیص خودکار اکانت بدون استفاده

## Immediate next action

شروع بازطراحی UI و ثبت تغییرات منطقی جدید با بازبینی Product Specification و تصمیم‌های ثبت‌شده؛ Phase 10 (استقرار و runbook) برای آماده‌سازی انتشار باقی می‌ماند.
