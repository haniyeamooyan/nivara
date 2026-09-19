// Localization dictionary supporting Persian (default RTL) and English (LTR)
// Covers all pages, actions, statuses, financial scopes, and validation messages

export type Locale = "fa" | "en";

export interface TranslationDict {
  [key: string]: {
    fa: string;
    en: string;
  };
}

export const DICTIONARY: TranslationDict = {
  // Brand & Global
  "app.name": { fa: "نیوارا", en: "Nivara" },
  "app.tagline": { fa: "مدیریت یکپارچه بودجه و خریدهای ابری و هوش مصنوعی", en: "AI & SaaS Budget & Procurement Management" },
  "app.prototype_notice": {
    fa: "حالت پیش‌نمایش طراحی (شاخه fix/style) — داده‌های ۱۰۰٪ ساختگی بدون تغییر در مخزن اصلی",
    en: "Redesign Prototype (fix/style branch) — 100% fictional mock data without altering main repository",
  },
  "app.switch_role": { fa: "سوییچ نقش کاربری (پروتوتایپ):", en: "Switch Role (Prototype):" },
  "app.toggle_lang": { fa: "تغییر به English", en: "Switch to فارسی" },
  "app.toggle_theme": { fa: "تغییر تم", en: "Toggle Theme" },

  // Navigation
  "nav.dashboard": { fa: "داشبورد", en: "Dashboard" },
  "nav.my_purchases": { fa: "خریدهای من", en: "My Purchases" },
  "nav.team_requests": { fa: "صف بررسی درخواست‌ها", en: "Team Requests" },
  "nav.team_budgets": { fa: "تخصیص بودجه تیم", en: "Budget Allocation" },
  "nav.team_shared": { fa: "حساب اشتراکی تیم", en: "Team Shared Budget" },
  "nav.team_renewals": { fa: "تمدیدها و انقضا", en: "Renewals & Expiry" },
  "nav.team_members": { fa: "اعضای تیم", en: "Team Members" },
  "nav.admin_teams": { fa: "تیم‌ها و مدیران", en: "Teams & Managers" },
  "nav.admin_services": { fa: "کاتالوگ سرویس‌ها", en: "Service Catalog" },
  "nav.cto_reports": { fa: "گزارش جامع شرکت", en: "Company Reports" },
  "nav.logout": { fa: "خروج از حساب", en: "Sign Out" },

  // Roles
  "role.EMPLOYEE": { fa: "کارمند", en: "Employee" },
  "role.MANAGER": { fa: "مدیر تیم", en: "Team Manager" },
  "role.SUPER_ADMIN": { fa: "مدیر ارشد سامانه", en: "Super Admin" },
  "role.CTO": { fa: "مدیر ارشد فنی (CTO)", en: "Chief Technology Officer" },

  // Scopes
  "scope.personal": { fa: "محدوده شخصی", en: "Personal Scope" },
  "scope.team": { fa: "محدوده تیمی", en: "Team Scope" },
  "scope.company": { fa: "محدوده کل شرکت", en: "Company-wide Scope" },

  // Statuses
  "status.SUBMITTED": { fa: "در انتظار بررسی", en: "Pending Review" },
  "status.PURCHASED": { fa: "خرید نهایی شده", en: "Purchased" },
  "status.REJECTED": { fa: "رد شده", en: "Rejected" },
  "status.CANCELLED": { fa: "لغو شده توسط متقاضی", en: "Cancelled" },
  "status.ACTIVE": { fa: "پلن فعال", en: "Active Plan" },
  "status.EXPIRED": { fa: "منقضی شده", en: "Expired" },
  "status.LOCKED": { fa: "تأیید و قفل‌شده", en: "Confirmed & Locked" },
  "status.DRAFT": { fa: "پیش‌نویس باز", en: "Draft" },

  // Dashboard
  "dash.welcome": { fa: "خوش آمدید", en: "Welcome" },
  "dash.personal_balance": { fa: "مانده اعتبار شخصی شما", en: "Your Personal Budget Balance" },
  "dash.balance_hint": {
    fa: "این مانده شامل اعتبار استفاده‌نشده دوره‌های گذشته است که منتقل شده است. ارسال درخواست خرید، اعتباری را مسدود یا کسر نمی‌کند.",
    en: "This balance includes unspent carried-over budget from prior months. Submitting a request does NOT deduct or reserve any balance.",
  },
  "dash.action_needed_budget": { fa: "اقدام لازم: تخصیص بودجه ماه جاری قفل نشده است", en: "Action Required: Current month budget allocation is not locked" },
  "dash.action_needed_budget_desc": {
    fa: "برای ماه 2026-09، تخصیص اولیه را بررسی، مبالغ استثنا را تنظیم و جهت اعمال در سیستم تأیید نهایی کنید.",
    en: "Review the team baseline and member overrides for 2026-09, then confirm to activate.",
  },
  "dash.btn_manage_budget": { fa: "بررسی و قفل تخصیص بودجه", en: "Review & Lock Allocation" },
  "dash.recent_notifications": { fa: "اعلان‌های اخیر", en: "Recent Notifications" },

  // Purchases
  "purchases.title": { fa: "خریدهای من و درخواست‌های ابزار", en: "My Purchases & Tool Requests" },
  "purchases.request_form_title": { fa: "ثبت درخواست خرید ابزار / سرویس هوش مصنوعی", en: "Request New AI / SaaS Service" },
  "purchases.direct_form_title": { fa: "ثبت مستقیم خرید شخصی (ویژه مدیر)", en: "Register Direct Personal Purchase (Manager/Admin)" },
  "purchases.direct_hint": {
    fa: "این خرید بدون نیاز به تأیید ثبت می‌شود. تا سقف موجودی از مانده شخصی شما کسر شده و مابقی به عنوان سهم شخصی ثبت خواهد شد.",
    en: "This purchase registers directly without approval. Up to available balance is deducted from your budget, and any excess is recorded as personal contribution.",
  },
  "purchases.zero_balance_warn": {
    fa: "موجودی قابل استفاده شما صفر دلار است. ثبت درخواست جدید فقط در صورت داشتن مانده بیشتر از صفر مجاز است.",
    en: "Your available balance is $0.00. Submitting new requests is only allowed when available balance is greater than zero.",
  },
  "purchases.service_select": { fa: "انتخاب سرویس از کاتالوگ", en: "Select Service from Catalog" },
  "purchases.estimated_cost": { fa: "مبلغ تخمینی ماهانه (USD)", en: "Estimated Monthly Cost (USD)" },
  "purchases.need_desc": { fa: "شرح نیاز کاری و توجیه استفاده", en: "Business Need & Justification" },
  "purchases.btn_submit": { fa: "ارسال درخواست برای مدیر تیم", en: "Submit Request to Manager" },
  "purchases.btn_direct_buy": { fa: "ثبت قطعی خرید شخصی", en: "Register Personal Purchase" },
  "purchases.active_plans": { fa: "پلن‌های فعال من", en: "My Active Plans" },
  "purchases.req_history": { fa: "تاریخچه درخواست‌ها و خریدها", en: "Request & Purchase History" },
  "purchases.btn_cancel": { fa: "لغو درخواست", en: "Cancel Request" },
  "purchases.btn_request_non_renewal": { fa: "درخواست عدم تمدید", en: "Request Non-Renewal" },
  "purchases.rejection_reason_label": { fa: "علت رد درخواست توسط مدیر:", en: "Rejection Reason by Manager:" },

  // Team Requests
  "requests.title": { fa: "صف بررسی و تصمیم‌گیری درخواست‌های تیم", en: "Team Purchase Requests Queue" },
  "requests.subtitle": {
    fa: "مدیر می‌تواند درخواست را با ثبت خرید قطعی و تعیین مبلغ واقعی نهایی کند یا با ذکر دلیل الزامی رد نماید.",
    en: "Managers can finalize requests with actual purchase cost or reject with a mandatory reason.",
  },
  "requests.empty": { fa: "در حال حاضر هیچ درخواست بازی در انتظار بررسی نیست.", en: "There are currently no open requests pending review." },
  "requests.applicant": { fa: "متقاضی", en: "Applicant" },
  "requests.available_balance": { fa: "موجودی فعلی عضو:", en: "Member Current Balance:" },
  "requests.actual_cost_label": { fa: "مبلغ واقعی خرید (USD)", en: "Actual Purchase Cost (USD)" },
  "requests.start_date_label": { fa: "تاریخ شروع دوره", en: "Start Date" },
  "requests.auto_renew_label": { fa: "تمدید خودکار ماهانه", en: "Monthly Auto-Renewal" },
  "requests.btn_complete": { fa: "ثبت خرید قطعی", en: "Confirm Purchase" },
  "requests.reject_reason_label": { fa: "دلیل رد درخواست (الزامی - حداقل ۳ نویسه)", en: "Rejection Reason (Required - min 3 chars)" },
  "requests.btn_reject": { fa: "رد درخواست با ثبت دلیل", en: "Reject Request" },

  // Budget Allocation
  "budgets.title": { fa: "تخصیص بودجه ماهانه تیم", en: "Monthly Team Budget Allocation" },
  "budgets.month_label": { fa: "دوره بودجه (ماه میلادی جاری):", en: "Budget Period (Current Month):" },
  "budgets.baseline_label": { fa: "مبلغ پایه پیش‌فرض برای هر عضو (USD):", en: "Team Baseline per Member (USD):" },
  "budgets.new_allocation": { fa: "اعتبار جدید تخصیصی", en: "New Allocated Funds" },
  "budgets.carry_over": { fa: "مانده انتقالی دوره‌های قبل", en: "Carried-Over Balance" },
  "budgets.projected_total": { fa: "مجموع موجودی پس از تایید", en: "Total Balance After Confirmation" },
  "budgets.btn_save_draft": { fa: "ذخیره پیش‌نویس", en: "Save Draft" },
  "budgets.btn_confirm_lock": { fa: "تأیید نهایی و قفل تخصیص ماه", en: "Confirm & Lock Allocation" },
  "budgets.locked_badge": { fa: "تخصیص این ماه قفل و فعال شده است", en: "This month's allocation is locked and active" },

  // Shared Budget
  "shared.title": { fa: "حساب خریدهای غیرشخصی و اشتراکی تیم", en: "Team Shared Non-Personal Budget" },
  "shared.current_balance": { fa: "موجودی حساب اشتراکی تیم", en: "Team Shared Account Balance" },
  "shared.balance_note": {
    fa: "این موجودی کاملاً مستقل از اعتبارهای شخصی کارکنان است و مستقیماً توسط مدیر شارژ و مدیریت می‌شود.",
    en: "This balance is completely separate from employee personal budgets and is managed directly by the manager.",
  },
  "shared.topup_title": { fa: "ثبت شارژ دستی تنخواه تیم", en: "Top Up Shared Funds" },
  "shared.purchase_title": { fa: "ثبت خرید غیرشخصی از حساب تیم", en: "Register Non-Personal Team Purchase" },
  "shared.ledger_title": { fa: "دفترکل تراکنش‌های اشتراکی تیم", en: "Team Shared Ledger" },

  // Renewals & Expiry
  "renewals.title": { fa: "مدیریت تمدیدها، انقضا و درخواست‌های لغو", en: "Renewals, Expiry & Non-Renewal Management" },
  "renewals.expired_notice": { fa: "پلن‌های گذشته نیازمند به‌روزرسانی به وضعیت Expired", en: "Past Plans Pending Expired Status" },
  "renewals.btn_mark_expired": { fa: "ثبت وضعیت Expired در سیستم", en: "Mark as Expired" },
  "renewals.non_renew_requests": { fa: "درخواست‌های عدم تمدید از سوی کارکنان", en: "Employee Non-Renewal Requests" },
  "renewals.btn_ack_non_renew": { fa: "تأیید عدم تمدید و قطع تمدید خودکار", en: "Acknowledge & Disable Auto-Renew" },

  // Team Members
  "members.title": { fa: "مدیریت اعضای تیم", en: "Team Members Management" },
  "members.btn_add": { fa: "افزودن عضو جدید", en: "Add Team Member" },
  "members.name_label": { fa: "نام و نام خانوادگی", en: "Full Name" },
  "members.email_label": { fa: "ایمیل سازمانی", en: "Work Email" },
  "members.role_label": { fa: "نقش سازمانی", en: "Role" },
  "members.status_label": { fa: "وضعیت", en: "Status" },
  "members.balance_label": { fa: "موجودی کیف پول", en: "Budget Balance" },
  "members.actions_label": { fa: "عملیات", en: "Actions" },
  "members.btn_deactivate": { fa: "غیرفعال‌سازی", en: "Deactivate" },

  // Super Admin
  "admin.teams_title": { fa: "مدیریت تیم‌ها و مدیران سازمان", en: "Organization Teams & Managers" },
  "admin.services_title": { fa: "کاتالوگ ابزارها و سرویس‌های مجاز هوش مصنوعی", en: "Approved AI & SaaS Services Catalog" },
  "admin.btn_create_team": { fa: "ایجاد تیم جدید", en: "Create New Team" },
  "admin.btn_create_service": { fa: "افزودن سرویس به کاتالوگ", en: "Add Service to Catalog" },

  // CTO Reports
  "reports.title": { fa: "گزارش جامع وضعیت بودجه و خریدهای شرکت", en: "Company-Wide Budget & Procurement Audit Report" },
  "reports.reconciliation_title": { fa: "وضعیت تطبیق دفترکل و اسناد خرید (Reconciliation)", en: "General Ledger Reconciliation Status" },
  "reports.reconciled_clean": {
    fa: "تطبیق دفترکل کاملاً متوازن است. تمام خریدهای ثبت‌شده دارای سند بدهکار متناظر هستند و مغایرتی وجود ندارد.",
    en: "Ledger is fully reconciled. All registered purchases match exact debit transactions with $0.00 discrepancy.",
  },
  "reports.reconciled_discrepancy": {
    fa: "هشدار مغایرت در تطبیق دفترکل! موارد عدم انطباق شناسایی شده است:",
    en: "Reconciliation Discrepancy Detected! The following mismatches were identified:",
  },
  "reports.audit_title": { fa: "تاریخچه حسابرسی رویدادها (Audit Log)", en: "System Audit Log (Last 50 Events)" },
};

export function t(key: string, locale: Locale = "fa"): string {
  if (DICTIONARY[key]) {
    return DICTIONARY[key][locale] || DICTIONARY[key].fa;
  }
  return key;
}
