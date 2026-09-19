# Nivara — Database Design

**Status:** Implemented base schema (MVP in progress)  
**Version:** 0.1

## 1. Design principles

- داده‌های مالی immutable هستند؛ اصلاحات با رکورد adjustment و دلیل انجام می‌شوند.
- مبلغ‌ها با `Decimal` ذخیره می‌شوند، نه `Float`.
- تکمیل خرید و ثبت تراکنش بودجه در یک database transaction انجام می‌شود.
- رکوردهای حذف‌شده‌ی عملیاتی ترجیحاً soft-delete می‌شوند تا history از بین نرود.
- هر کاربر حداکثر عضو یک تیم فعال است.
- هر تیم دقیقاً یک مدیر فعال دارد.

## 2. Entity relationship overview

```text
User ───────────────< PurchaseRequest >──────────── Service
 │                         │
 │                         └────────────── Purchase
 │                                           │
 ├── Team (member)                           └── RenewalRequest
 └── Team (manager)

Team ───────────────< BudgetAllocation >──── BudgetPeriod
 │                         │
 └──────────────< TeamPurchase

BudgetAccount ─────< BudgetTransaction

User ───────────────< Notification
User ───────────────< AuditLog
User ───────────────< Session
```

## 3. Tables

### users

```text
id              UUID PK
email           VARCHAR UNIQUE NOT NULL
password_hash   VARCHAR NOT NULL
first_name      VARCHAR NOT NULL
last_name       VARCHAR NOT NULL
role            ENUM(SUPER_ADMIN, CTO, MANAGER, EMPLOYEE)
status          ENUM(ACTIVE, INACTIVE)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
```

### sessions

```text
id              UUID PK
token_hash      VARCHAR UNIQUE NOT NULL
user_id         UUID FK users NOT NULL
expires_at      TIMESTAMP NOT NULL
created_at      TIMESTAMP NOT NULL
```

فقط hash توکن نشست در پایگاه ذخیره می‌شود؛ توکن خام در cookie با ویژگی‌های `HttpOnly`، `SameSite=Lax` و در production با `Secure` نگهداری می‌شود. حذف فیزیکی کاربر نشست‌های او را cascade حذف می‌کند؛ غیرفعال‌کردن یا soft-delete کاربر نیز دسترسی نشست را فوراً نامعتبر می‌کند.

### teams

```text
id              UUID PK
name            VARCHAR NOT NULL
manager_id      UUID FK users NOT NULL
status          ENUM(ACTIVE, INACTIVE)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
```

`manager_id` باید به یک کاربر با نقش Manager اشاره کند. این قانون در application و در عملیات تغییر مدیر enforce می‌شود.

### team_memberships

```text
id              UUID PK
team_id         UUID FK teams NOT NULL
user_id         UUID FK users NOT NULL
joined_at       TIMESTAMP NOT NULL
left_at         TIMESTAMP NULL
```

Constraint: هر کاربر فقط یک membership فعال دارد.

### services

```text
id              UUID PK
name            VARCHAR NOT NULL
category        VARCHAR NULL
status          ENUM(ACTIVE, INACTIVE)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
```

### budget_periods

```text
id              UUID PK
name            VARCHAR NOT NULL
starts_at       TIMESTAMP NOT NULL
ends_at         TIMESTAMP NOT NULL
status          ENUM(DRAFT, OPEN, LOCKED, CLOSED)
created_at      TIMESTAMP NOT NULL
locked_at       TIMESTAMP NULL
```

در هر لحظه فقط یک دوره باید `OPEN` باشد. پس از شروع/قفل‌شدن دوره، allocationهای همان دوره قابل ویرایش نیستند. CTO در MVP دوره و بودجه را فقط مشاهده می‌کند.

### budget_allocations

```text
id              UUID PK
period_id       UUID FK budget_periods NOT NULL
team_id         UUID FK teams NOT NULL
user_id         UUID FK users NOT NULL
amount          DECIMAL(12,2) NOT NULL
source          ENUM(TEAM_DEFAULT, INDIVIDUAL_OVERRIDE)
confirmed_by    UUID FK users NOT NULL
confirmed_at    TIMESTAMP NOT NULL
created_at      TIMESTAMP NOT NULL
```

Constraint: برای هر `period_id + user_id` فقط یک allocation نهایی وجود دارد.

### budget_accounts

```text
id              UUID PK
owner_type      ENUM(USER, TEAM) NOT NULL
user_id         UUID FK users NULL
team_id         UUID FK teams NULL
created_at      TIMESTAMP NOT NULL
```

در هر رکورد فقط یکی از `user_id` یا `team_id` مقدار دارد.

### budget_transactions

```text
id              UUID PK
account_id      UUID FK budget_accounts NOT NULL
period_id       UUID FK budget_periods NULL
type            ENUM(ALLOCATION, CARRY_OVER, PURCHASE_DEBIT, ADJUSTMENT)
amount          DECIMAL(12,2) NOT NULL
reference_type  VARCHAR NULL
reference_id    UUID NULL
description     VARCHAR NULL
created_by      UUID FK users NOT NULL
created_at      TIMESTAMP NOT NULL
```

مبالغ ورودی مثبت و debitها منفی ذخیره می‌شوند. `EMPLOYEE_CONTRIBUTION` هزینه‌ی خارج از اعتبار شرکت است و transaction بودجه‌ای محسوب نمی‌شود؛ در Purchase ثبت می‌شود.

### purchase_requests

```text
id              UUID PK
requester_id    UUID FK users NOT NULL
team_id         UUID FK teams NOT NULL
service_id      UUID FK services NOT NULL
requested_amount DECIMAL(12,2) NOT NULL
note            TEXT NULL
status          ENUM(SUBMITTED, PURCHASED, REJECTED, CANCELLED)
rejection_reason TEXT NULL
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
```

### purchases

```text
id                  UUID PK
request_id          UUID FK purchase_requests NULL
team_id             UUID FK teams NOT NULL
user_id             UUID FK users NULL
service_id          UUID FK services NOT NULL
actual_amount       DECIMAL(12,2) NOT NULL
company_amount      DECIMAL(12,2) NOT NULL
employee_contribution DECIMAL(12,2) NOT NULL
start_date          DATE NOT NULL
end_date            DATE NULL
renewal_status      ENUM(AUTO, MANUAL, NOT_RENEWING, NOT_APPLICABLE)
plan_status         ENUM(ACTIVE, RENEWED, EXPIRED)
purchased_by        UUID FK users NOT NULL
created_at          TIMESTAMP NOT NULL
updated_at          TIMESTAMP NOT NULL
```

برای خرید شخصی `user_id` و `request_id` پر می‌شوند. برای خرید غیرشخصی `user_id` و `request_id` خالی و `team_id` پر می‌شود.

### renewal_requests

```text
id              UUID PK
purchase_id     UUID FK purchases NOT NULL
requested_by    UUID FK users NOT NULL
 status          ENUM(SUBMITTED, ACKNOWLEDGED, CANCELLED)
note            TEXT NULL
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL
```

### notifications

```text
id              UUID PK
recipient_id    UUID FK users NOT NULL
type            ENUM(BUDGET_ALLOCATION, EXPIRY_REMINDER, RENEWAL_REQUEST, SYSTEM)
title           VARCHAR NOT NULL
body            TEXT NOT NULL
read_at         TIMESTAMP NULL
created_at      TIMESTAMP NOT NULL
```

### audit_logs

```text
id              UUID PK
actor_id        UUID FK users NOT NULL
action          VARCHAR NOT NULL
entity_type     VARCHAR NOT NULL
entity_id       UUID NOT NULL
metadata        JSONB NULL
created_at      TIMESTAMP NOT NULL
```

## 4. Critical operations

### Confirm personal purchase

در یک transaction:

1. بررسی شود درخواست `SUBMITTED` است.
2. مبلغ واقعی ثبت شود.
3. موجودی حساب فرد محاسبه شود.
4. `company_amount = min(actual_amount, available_balance)` محاسبه شود.
5. `employee_contribution = actual_amount - company_amount` محاسبه شود.
6. `PURCHASE_DEBIT` ثبت شود.
7. Purchase ایجاد شود.
8. وضعیت درخواست به `PURCHASED` تغییر کند.
9. Audit log ثبت شود.

### Confirm budget allocation

در یک transaction:

1. دوره بررسی شود که هنوز شروع/قفل نشده باشد.
2. allocation گروهی و overrideهای فردی نهایی شوند.
3. transactionهای `ALLOCATION` ثبت شوند.
4. دوره lock شود.
5. اعلان داخلی برای اعضای تیم ایجاد شود.
6. Audit log ثبت شود.

## 5. Operational decisions

- **DECISION:** CTO در MVP فقط مشاهده‌کننده است و دوره یا بودجه را تغییر نمی‌دهد.
- **DECISION:** تاریخ‌ها در database با UTC ذخیره می‌شوند و در UI به‌صورت میلادی نمایش داده می‌شوند.
- **DECISION:** کاربران، تیم‌ها و سرویس‌ها فقط soft-delete می‌شوند.
- **DECISION:** وضعیت پایان پلن توسط مدیر تعیین می‌شود؛ مدیر آن را به `RENEWED` یا `EXPIRED` تغییر می‌دهد.
- **DECISION:** مدیر فقط درخواست عدم تمدید را مشاهده می‌کند؛ workflow تأیید جداگانه ندارد.
- **DECISION:** اعلان deadline و reminder تکرارشونده در این مرحله لازم نیست.
