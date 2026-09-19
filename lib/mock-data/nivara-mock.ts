// Mock data for Nivara Redesign Prototype (100% fictional data)
// Preserves all roles, calculations, statuses, and workflow invariants

export type Role = "EMPLOYEE" | "MANAGER" | "SUPER_ADMIN" | "CTO";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId?: string;
  teamName?: string;
  balance: number; // in USD
}

export interface MockService {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  defaultPrice?: number;
}

export interface MockPurchaseRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterBalance: number;
  serviceId: string;
  serviceName: string;
  estimatedCost: number;
  needDescription: string;
  status: "SUBMITTED" | "PURCHASED" | "REJECTED" | "CANCELLED";
  rejectionReason?: string;
  createdAt: string;
  teamId: string;
}

export interface MockActivePlan {
  id: string;
  purchaseId: string;
  userId: string;
  userName: string;
  serviceName: string;
  category: string;
  periodStart: string;
  periodEnd: string;
  autoRenew: boolean;
  nonRenewalRequested: boolean;
  nonRenewalAcknowledged: boolean;
  status: "ACTIVE" | "EXPIRED";
  actualCost: number;
  companyContribution: number;
  employeeContribution: number;
}

export interface MockTeamMember {
  id: string;
  name: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER";
  isActive: boolean;
  balance: number;
  monthlyAllocationOverride?: number;
}

export interface MockBudgetMemberAllocation {
  memberId: string;
  memberName: string;
  currentBalance: number;
  useCustomOverride: boolean;
  customAmount: number;
}

export interface MockSharedTransaction {
  id: string;
  createdAt: string;
  type: "TOPUP" | "PURCHASE";
  amount: number;
  runningBalance: number;
  description: string;
  authorName: string;
}

export interface MockAuditEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  details: string;
}

// Pre-configured fictional users for switching views in prototype
export const MOCK_USERS: MockUser[] = [
  {
    id: "user-emp-1",
    name: "پرهام کیانی",
    email: "parham.k@acme-corp.internal",
    role: "EMPLOYEE",
    teamId: "team-platform",
    teamName: "تیم پلتفرم و زیرساخت",
    balance: 45.0,
  },
  {
    id: "user-emp-2",
    name: "مینا صبوری (موجودی صفر)",
    email: "mina.s@acme-corp.internal",
    role: "EMPLOYEE",
    teamId: "team-platform",
    teamName: "تیم پلتفرم و زیرساخت",
    balance: 0.0,
  },
  {
    id: "user-mgr-1",
    name: "نیما پارسا (مدیر تیم)",
    email: "nima.p@acme-corp.internal",
    role: "MANAGER",
    teamId: "team-platform",
    teamName: "تیم پلتفرم و زیرساخت",
    balance: 120.0,
  },
  {
    id: "user-admin-1",
    name: "سارا رادمنش (Super Admin)",
    email: "sara.rad@acme-corp.internal",
    role: "SUPER_ADMIN",
    balance: 200.0,
  },
  {
    id: "user-cto-1",
    name: "دکتر کیان مهرابی (CTO)",
    email: "kian.cto@acme-corp.internal",
    role: "CTO",
    balance: 0,
  },
];

export const MOCK_SERVICES: MockService[] = [
  { id: "srv-1", name: "GitHub Copilot Enterprise", category: "AI Code Assistant", isActive: true, defaultPrice: 21 },
  { id: "srv-2", name: "OpenAI ChatGPT Team", category: "AI LLM Platform", isActive: true, defaultPrice: 25 },
  { id: "srv-3", name: "Claude Team by Anthropic", category: "AI Reasoning", isActive: true, defaultPrice: 30 },
  { id: "srv-4", name: "JetBrains All Products Pack", category: "Developer Tools", isActive: true, defaultPrice: 49 },
  { id: "srv-5", name: "Figma Organization", category: "Product Design", isActive: true, defaultPrice: 45 },
  { id: "srv-6", name: "Midjourney Pro Tier", category: "Generative Media", isActive: false, defaultPrice: 60 },
];

export const INITIAL_REQUESTS: MockPurchaseRequest[] = [
  {
    id: "req-101",
    requesterId: "user-emp-1",
    requesterName: "پرهام کیانی",
    requesterBalance: 45.0,
    serviceId: "srv-1",
    serviceName: "GitHub Copilot Enterprise",
    estimatedCost: 21.0,
    needDescription: "توسعه سریع‌تر ماژول‌های زیرساخت و ریفکتور سرویس‌های میکروسرویس پلتفرم",
    status: "SUBMITTED",
    createdAt: "2026-09-18T10:30:00Z",
    teamId: "team-platform",
  },
  {
    id: "req-102",
    requesterId: "user-emp-3",
    requesterName: "آرین زندی",
    requesterBalance: 30.0,
    serviceId: "srv-4",
    serviceName: "JetBrains All Products Pack",
    estimatedCost: 49.0,
    needDescription: "استفاده از محیط RustRover و GoLand برای سرویس جدید توزیع‌شده",
    status: "REJECTED",
    rejectionReason: "لایسنس سازمانی شناور برای تیم موجود است؛ لطفاً به هلپ‌دسک تیکت بزنید.",
    createdAt: "2026-09-15T08:15:00Z",
    teamId: "team-platform",
  },
  {
    id: "req-103",
    requesterId: "user-emp-1",
    requesterName: "پرهام کیانی",
    requesterBalance: 45.0,
    serviceId: "srv-2",
    serviceName: "OpenAI ChatGPT Team",
    estimatedCost: 25.0,
    needDescription: "تحقیق روی پایپ‌لاین‌های پرامپتینگ و ارزیابی توکن‌ها",
    status: "PURCHASED",
    createdAt: "2026-09-01T14:20:00Z",
    teamId: "team-platform",
  },
  {
    id: "req-104",
    requesterId: "user-emp-4",
    requesterName: "سحر نوری",
    requesterBalance: 50.0,
    serviceId: "srv-5",
    serviceName: "Figma Organization",
    estimatedCost: 45.0,
    needDescription: "تغییر اولویت پروژه و عدم نیاز در این ماه",
    status: "CANCELLED",
    createdAt: "2026-09-12T09:00:00Z",
    teamId: "team-platform",
  },
];

export const INITIAL_ACTIVE_PLANS: MockActivePlan[] = [
  {
    id: "plan-501",
    purchaseId: "pur-201",
    userId: "user-emp-1",
    userName: "پرهام کیانی",
    serviceName: "GitHub Copilot Enterprise",
    category: "AI Code Assistant",
    periodStart: "2026-08-20",
    periodEnd: "2026-09-20",
    autoRenew: true,
    nonRenewalRequested: false,
    nonRenewalAcknowledged: false,
    status: "ACTIVE",
    actualCost: 21.0,
    companyContribution: 21.0,
    employeeContribution: 0.0,
  },
  {
    id: "plan-502",
    purchaseId: "pur-202",
    userId: "user-emp-1",
    userName: "پرهام کیانی",
    serviceName: "OpenAI ChatGPT Team",
    category: "AI LLM Platform",
    periodStart: "2026-09-01",
    periodEnd: "2026-10-01",
    autoRenew: true,
    nonRenewalRequested: true,
    nonRenewalAcknowledged: false,
    status: "ACTIVE",
    actualCost: 25.0,
    companyContribution: 25.0,
    employeeContribution: 0.0,
  },
  {
    id: "plan-503",
    purchaseId: "pur-203",
    userId: "user-emp-3",
    userName: "آرین زندی",
    serviceName: "JetBrains GoLand",
    category: "Developer Tools",
    periodStart: "2026-07-15",
    periodEnd: "2026-08-15",
    autoRenew: false,
    nonRenewalRequested: false,
    nonRenewalAcknowledged: false,
    status: "EXPIRED",
    actualCost: 29.0,
    companyContribution: 29.0,
    employeeContribution: 0.0,
  },
];

export const INITIAL_TEAM_MEMBERS: MockTeamMember[] = [
  { id: "user-emp-1", name: "پرهام کیانی", email: "parham.k@acme-corp.internal", role: "EMPLOYEE", isActive: true, balance: 45.0 },
  { id: "user-emp-2", name: "مینا صبوری", email: "mina.s@acme-corp.internal", role: "EMPLOYEE", isActive: true, balance: 0.0 },
  { id: "user-emp-3", name: "آرین زندی", email: "arian.z@acme-corp.internal", role: "EMPLOYEE", isActive: true, balance: 30.0, monthlyAllocationOverride: 70 },
  { id: "user-emp-4", name: "سحر نوری", email: "sahar.n@acme-corp.internal", role: "EMPLOYEE", isActive: true, balance: 50.0 },
  { id: "user-emp-5", name: "کامران بهرامی (غیرفعال)", email: "kamran.b@acme-corp.internal", role: "EMPLOYEE", isActive: false, balance: 0.0 },
];

export const INITIAL_SHARED_TRANSACTIONS: MockSharedTransaction[] = [
  {
    id: "tx-301",
    createdAt: "2026-09-01T09:00:00Z",
    type: "TOPUP",
    amount: 500.0,
    runningBalance: 500.0,
    description: "شارژ اولیه تنخواه سه‌ماهه سوم تیم پلتفرم از تنخواه مالی شرکت",
    authorName: "نیما پارسا",
  },
  {
    id: "tx-302",
    createdAt: "2026-09-05T11:30:00Z",
    type: "PURCHASE",
    amount: 140.0,
    runningBalance: 360.0,
    description: "خرید لایسنس سرور CI/CD اختصاصی و رانرهای مشترک تیم",
    authorName: "نیما پارسا",
  },
  {
    id: "tx-303",
    createdAt: "2026-09-14T16:00:00Z",
    type: "PURCHASE",
    amount: 85.0,
    runningBalance: 275.0,
    description: "اشتراک سرور توسعه گراف و دیتابیس تست برخط تیم",
    authorName: "نیما پارسا",
  },
];

export const INITIAL_AUDIT_EVENTS: MockAuditEvent[] = [
  {
    id: "aud-901",
    timestamp: "2026-09-19T14:32:00Z",
    actorName: "نیما پارسا",
    actorRole: "MANAGER",
    action: "BUDGET_DRAFT_SAVED",
    entityType: "TeamBudgetAllocation",
    details: "پیش‌نویس تخصیص ماه 2026-09 با بودجه پایه $50 و 1 استثنا ذخیره شد",
  },
  {
    id: "aud-902",
    timestamp: "2026-09-18T11:00:00Z",
    actorName: "پرهام کیانی",
    actorRole: "EMPLOYEE",
    action: "PURCHASE_REQUEST_SUBMITTED",
    entityType: "PurchaseRequest",
    details: "درخواست خرید GitHub Copilot به مبلغ تخمینی $21 ارسال شد",
  },
  {
    id: "aud-903",
    timestamp: "2026-09-15T08:20:00Z",
    actorName: "نیما پارسا",
    actorRole: "MANAGER",
    action: "PURCHASE_REQUEST_REJECTED",
    entityType: "PurchaseRequest",
    details: "درخواست JetBrains آرین زندی به دلیل وجود لایسنس شناور رد شد",
  },
  {
    id: "aud-904",
    timestamp: "2026-09-14T16:05:00Z",
    actorName: "نیما پارسا",
    actorRole: "MANAGER",
    action: "TEAM_SHARED_PURCHASE",
    entityType: "SharedBudget",
    details: "خرید غیرشخصی اشتراک سرور تست به مبلغ $85 از حساب اشتراکی کسر شد",
  },
  {
    id: "aud-905",
    timestamp: "2026-09-10T10:15:00Z",
    actorName: "سارا رادمنش",
    actorRole: "SUPER_ADMIN",
    action: "SERVICE_CREATED",
    entityType: "ServiceCatalog",
    details: "سرویس Claude Team by Anthropic به کاتالوگ ابزارها افزوده شد",
  },
];
