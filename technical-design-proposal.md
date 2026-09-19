# Nivara — Technical Design Proposal

**Status:** Proposed  
**Version:** 0.1  
**Related document:** `mvp-product-specification.md`

## 1. Technical goals

- ساخت محصول واقعی با معماری قابل توسعه
- فراهم‌کردن مسیر یادگیری Backend و Full-Stack
- حفظ منطق مالی و تاریخچه به‌صورت قابل ردیابی
- ساده نگه‌داشتن MVP و جلوگیری از وابستگی به سرویس‌های خارجی

## 2. Proposed stack

### Application

- Next.js App Router + TypeScript
- دلیل: Nivara یک application داخلی با UI، authentication، CRUD، workflow و گزارش است؛ بنابراین یک application یکپارچه سرعت ساخت MVP و سادگی deployment را افزایش می‌دهد. تجربه فعلی تو با React و Next.js نیز هزینه یادگیری را پایین می‌آورد.
- جایگزین ردشده برای MVP: جداسازی Next.js و NestJS؛ این گزینه برای API مستقل و چند client مناسب‌تر است، اما فعلاً سربار دو application، دو deployment و هماهنگی بیشتر ایجاد می‌کند.
- TanStack Query برای server state
- دلیل: cache، invalidation و mutationهای درخواست‌ها و بودجه را قابل‌کنترل می‌کند و از پراکندگی state در صفحات جلوگیری می‌کند.
- React Hook Form + Zod برای فرم و validation
- دلیل: فرم‌های تخصیص بودجه و ثبت خرید پیچیده‌اند؛ React Hook Form re-render کمی دارد و Zod امکان اشتراک schema بین validation و type inference را فراهم می‌کند.
- Tailwind CSS + shadcn/ui
- دلیل: کنترل کامل روی ظاهر، مناسب‌بودن برای dashboardهای داخلی، دسترسی‌پذیری پایه بر مبنای Radix و هماهنگی با TypeScript بدون وابستگی به theme سنگین.

### Backend داخل Next.js

- Route Handlers و server-side services
- دلیل: برای MVP تمام مصرف‌کنندگان API در همان application هستند و نیاز به API عمومی یا mobile client تأیید نشده است. جداسازی domain services از Route Handlerها امکان استخراج backend در آینده را حفظ می‌کند.
- PostgreSQL
- دلیل: داده‌ها رابطه‌ای و transactionمحور هستند؛ users، teams، allocations، purchases و audit logs به constraint و consistency نیاز دارند.
- Prisma ORM
- دلیل: schema خوانا، migration رسمی، type-safety و سرعت مناسب برای تیم کوچک/یک توسعه‌دهنده دارد.
- Session-based authentication در secure HTTP-only cookies
- دلیل: برای یک Next.js application داخلی، session امن در cookie ساده‌تر از مدیریت token در client است و ریسک نگهداری token در localStorage را ندارد.
- Argon2id برای hash کردن password
- دلیل: برای password storage طراحی شده و انتخاب ترجیحی امن‌تری نسبت به نگهداری password خام یا hashهای ضعیف است.

### Testing and operations

- Jest برای unit و integration tests
- Playwright برای end-to-end tests
- Docker Compose برای اجرای local PostgreSQL و سرویس‌ها
- OpenAPI در صورت نیاز به client مستقل؛ در MVP ابتدا قراردادهای داخلی و schemaهای Zod کافی هستند.

## 3. Proposed repository structure

```text
nivara/
├── app/              # Next.js routes and pages
├── components/       # UI components
├── modules/          # domain services and repositories
├── lib/              # shared infrastructure
├── prisma/           # schema and migrations
├── tests/            # unit and E2E tests
└── docs/             # product and technical documents
```

`ASSUMPTION`: پروژه در MVP یک Next.js application مستقل است، نه monorepo؛ در صورت ایجاد client یا سرویس مستقل، ساختار قابل استخراج خواهد بود.

## 4. Core domain modules

### Identity and access

- Authentication
- Users
- Roles
- Teams
- Membership

### Budget

- Budget periods
- Team allocations
- Individual overrides
- Balance calculation
- Budget transactions

### Purchasing

- Services/agents catalog
- Personal purchase requests
- Non-personal team purchases
- Purchase lifecycle
- Renewal requests

### Notifications and audit

- In-app notifications
- Expiry reminders
- Audit log

### Reporting

- CTO dashboard queries
- Monthly and quarterly aggregations
- Filters by team, user, service and date range

## 5. Important financial design rule

موجودی نباید فقط با یک عدد قابل ویرایش نگهداری شود. هر تغییر مالی باید transaction داشته باشد.

نمونه transactionها:

- `ALLOCATION`
- `CARRY_OVER`
- `PURCHASE_DEBIT`
- `EMPLOYEE_CONTRIBUTION`
- `ADJUSTMENT`

موجودی قابل‌استفاده از مجموع transactionهای معتبر محاسبه یا از یک projection کنترل‌شده نگهداری می‌شود.

## 6. Initial entities

```text
User
Role
Team
Service
BudgetPeriod
BudgetAllocation
BudgetTransaction
PurchaseRequest
Purchase
RenewalRequest
Notification
AuditLog
```

## 7. API boundaries

```text
/auth
/users
/teams
/services
/budget-periods
/allocations
/purchase-requests
/purchases
/renewals
/notifications
/reports
/audit-logs
```

تمام endpointها باید authorization را در backend enforce کنند؛ محدودکردن routeها در frontend به‌تنهایی کافی نیست.

## 8. Consistency rules

- شروع دوره بودجه و قفل‌شدن تخصیص‌ها باید operation اتمیک باشد.
- تکمیل خرید و ثبت debit باید در یک database transaction انجام شود.
- مبلغ واقعی خرید باید immutable یا فقط از طریق adjustment دارای دلیل تغییر کند.
- تغییر نقش، تیم، بودجه، وضعیت درخواست و خرید باید audit شود.
- مقادیر پولی با decimal در database ذخیره شوند، نه floating point.
- currency در MVP حداقل `USD` است؛ پشتیبانی چندارزی هنوز تصمیم‌گیری نشده است.

## 9. Proposed implementation sequence

1. تثبیت stack و repository setup
2. طراحی ERD و schema دیتابیس
3. authentication و RBAC
4. teams و users
5. budget periods و allocations
6. purchase requests و purchase completion
7. renewals و notifications
8. CTO reports
9. audit log و تست end-to-end

## 10. Open decisions

- **DECISION:** UI با Tailwind CSS + shadcn/ui ساخته می‌شود.
- **DECISION:** authentication با session در secure HTTP-only cookie انجام می‌شود.
- **DECISION:** پروژه یک Next.js application مستقل است.
- **DECISION:** اجرای local با Docker انجام می‌شود.
- **DECISION:** زمان‌ها در database به UTC ذخیره می‌شوند.
- **DECISION:** currency در MVP فقط USD است.
- **DECISION:** کاربران، تیم‌ها و سرویس‌ها soft-delete می‌شوند.
