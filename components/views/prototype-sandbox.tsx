"use client";

import React, { useState } from "react";
import {
  MOCK_USERS,
  MOCK_SERVICES,
  INITIAL_REQUESTS,
  INITIAL_ACTIVE_PLANS,
  INITIAL_TEAM_MEMBERS,
  INITIAL_SHARED_TRANSACTIONS,
  INITIAL_AUDIT_EVENTS,
  MockUser,
  MockPurchaseRequest,
  MockActivePlan,
  MockTeamMember,
  MockSharedTransaction,
} from "@/lib/mock-data/nivara-mock";
import { t, Locale } from "@/lib/i18n/dictionary";

export default function PrototypeSandbox() {
  // Global Prototype State
  const [locale, setLocale] = useState<Locale>("fa");
  const [isDark, setIsDark] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<MockUser>(MOCK_USERS[0]); // Parham (Employee) by default
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Dynamic In-Memory Mock Records
  const [requests, setRequests] = useState<MockPurchaseRequest[]>(INITIAL_REQUESTS);
  const [activePlans, setActivePlans] = useState<MockActivePlan[]>(INITIAL_ACTIVE_PLANS);
  const [teamMembers, setTeamMembers] = useState<MockTeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [sharedTransactions, setSharedTransactions] = useState<MockSharedTransaction[]>(INITIAL_SHARED_TRANSACTIONS);
  const [sharedBalance, setSharedBalance] = useState<number>(275.0);

  // Manager Budget Allocation State
  const [baselineBudget, setBaselineBudget] = useState<number>(50.0);
  const [overrides, setOverrides] = useState<{ [memberId: string]: number }>({ "user-emp-3": 70.0 });
  const [isBudgetLocked, setIsBudgetLocked] = useState<boolean>(false);
  const [budgetSuccessMsg, setBudgetSuccessMsg] = useState<string>("");

  // Employee Request Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>(MOCK_SERVICES[0].id);
  const [estimatedCost, setEstimatedCost] = useState<number>(MOCK_SERVICES[0].defaultPrice || 21);
  const [needDesc, setNeedDesc] = useState<string>("");
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Direct Purchase State (Manager/Admin)
  const [directServiceId, setDirectServiceId] = useState<string>(MOCK_SERVICES[1].id);
  const [directActualCost, setDirectActualCost] = useState<number>(25.0);
  const [directAutoRenew, setDirectAutoRenew] = useState<boolean>(true);

  // Manager Decision Form State
  const [rejectionReasons, setRejectionReasons] = useState<{ [reqId: string]: string }>({});
  const [actualCostOverrides, setActualCostOverrides] = useState<{ [reqId: string]: number }>({});
  const [decisionFeedback, setDecisionFeedback] = useState<string>("");

  // Shared Budget Forms
  const [topupAmount, setTopupAmount] = useState<number>(200);
  const [topupDesc, setTopupDesc] = useState<string>("");
  const [sharedBuyCost, setSharedBuyCost] = useState<number>(65);
  const [sharedBuyDesc, setSharedBuyDesc] = useState<string>("");

  // State Matrix Showcase Trigger
  const [showStateMatrix, setShowStateMatrix] = useState<boolean>(false);

  // Theme & Direction Attributes
  const isRTL = locale === "fa";
  const directionClass = isRTL ? "rtl" : "ltr";

  // Handlers
  const handleSwitchUser = (userId: string) => {
    const found = MOCK_USERS.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      setActiveTab("dashboard");
      setFormFeedback(null);
    }
  };

  const handleCancelRequest = (reqId: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: "CANCELLED" as const } : r))
    );
  };

  const handleRequestNonRenewal = (planId: string) => {
    setActivePlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, nonRenewalRequested: true } : p))
    );
  };

  const handleEmployeeSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.balance <= 0) {
      setFormFeedback({
        type: "error",
        msg: isRTL
          ? "امکان ثبت درخواست با موجودی صفر وجود ندارد. لطفاً با مدیر تیم تماس بگیرید."
          : "Cannot submit request with zero balance. Please contact your manager.",
      });
      return;
    }
    if (!needDesc.trim()) {
      setFormFeedback({
        type: "error",
        msg: isRTL ? "لطفاً شرح نیاز کاری را وارد کنید." : "Please describe your business need.",
      });
      return;
    }

    const srv = MOCK_SERVICES.find((s) => s.id === selectedServiceId);
    const newReq: MockPurchaseRequest = {
      id: `req-${Date.now().toString().slice(-4)}`,
      requesterId: currentUser.id,
      requesterName: currentUser.name,
      requesterBalance: currentUser.balance,
      serviceId: selectedServiceId,
      serviceName: srv ? srv.name : "Custom Service",
      estimatedCost: Number(estimatedCost),
      needDescription: needDesc,
      status: "SUBMITTED",
      createdAt: new Date().toISOString(),
      teamId: currentUser.teamId || "team-platform",
    };

    setRequests([newReq, ...requests]);
    setNeedDesc("");
    setFormFeedback({
      type: "success",
      msg: isRTL
        ? "درخواست با موفقیت ثبت شد و به صف بررسی مدیر ارسال گردید (اعتباری مسدود نشد)."
        : "Request submitted successfully to manager queue (no balance deducted/reserved).",
    });
  };

  const handleDirectPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const srv = MOCK_SERVICES.find((s) => s.id === directServiceId);
    const cost = Number(directActualCost);
    const companyShare = Math.min(currentUser.balance, cost);
    const employeeShare = Math.max(0, cost - currentUser.balance);

    // Deduct user balance
    setCurrentUser((prev) => ({ ...prev, balance: Math.max(0, prev.balance - companyShare) }));

    const newPlan: MockActivePlan = {
      id: `plan-${Date.now().toString().slice(-4)}`,
      purchaseId: `pur-direct-${Date.now().toString().slice(-4)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      serviceName: srv ? srv.name : "Direct Tool",
      category: srv ? srv.category : "SaaS",
      periodStart: new Date().toISOString().split("T")[0],
      periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      autoRenew: directAutoRenew,
      nonRenewalRequested: false,
      nonRenewalAcknowledged: false,
      status: "ACTIVE",
      actualCost: cost,
      companyContribution: companyShare,
      employeeContribution: employeeShare,
    };

    setActivePlans([newPlan, ...activePlans]);
    setFormFeedback({
      type: "success",
      msg: isRTL
        ? `خرید شخصی مستقیم ثبت شد! سهم شرکت: $${companyShare.toFixed(2)} | سهم شخصی: $${employeeShare.toFixed(2)}`
        : `Direct personal purchase registered! Company funded: $${companyShare.toFixed(2)} | Personal contribution: $${employeeShare.toFixed(2)}`,
    });
  };

  const handleManagerCompletePurchase = (req: MockPurchaseRequest) => {
    const cost = actualCostOverrides[req.id] || req.estimatedCost;
    const applicantBalance = req.requesterBalance;
    const companyShare = Math.min(applicantBalance, cost);
    const personalContribution = Math.max(0, cost - applicantBalance);

    // Update request status
    setRequests((prev) =>
      prev.map((r) => (r.id === req.id ? { ...r, status: "PURCHASED" as const } : r))
    );

    // Create Active Plan
    const newPlan: MockActivePlan = {
      id: `plan-${Date.now().toString().slice(-4)}`,
      purchaseId: `pur-${Date.now().toString().slice(-4)}`,
      userId: req.requesterId,
      userName: req.requesterName,
      serviceName: req.serviceName,
      category: "Approved Tool",
      periodStart: new Date().toISOString().split("T")[0],
      periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      autoRenew: true,
      nonRenewalRequested: false,
      nonRenewalAcknowledged: false,
      status: "ACTIVE",
      actualCost: cost,
      companyContribution: companyShare,
      employeeContribution: personalContribution,
    };

    setActivePlans([newPlan, ...activePlans]);
    setDecisionFeedback(
      isRTL
        ? `خرید برای «${req.requesterName}» ثبت شد. مبلغ کل: $${cost} (سهم شرکت: $${companyShare}، سهم شخصی: $${personalContribution})`
        : `Purchase confirmed for ${req.requesterName}. Total: $${cost} (Company: $${companyShare}, Personal: $${personalContribution})`
    );
  };

  const handleManagerRejectRequest = (reqId: string) => {
    const reason = rejectionReasons[reqId]?.trim();
    if (!reason || reason.length < 3) {
      alert(isRTL ? "دلیل رد درخواست الزامی است (حداقل ۳ نویسه)." : "Rejection reason is required (min 3 chars).");
      return;
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: "REJECTED" as const, rejectionReason: reason } : r))
    );
    setDecisionFeedback(isRTL ? "درخواست با موفقیت رد شد و دلیل در پرونده ثبت گردید." : "Request rejected and reason recorded.");
  };

  // Shared Budget Handlers
  const handleSharedTopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (topupAmount <= 0) return;
    const newBal = sharedBalance + Number(topupAmount);
    setSharedBalance(newBal);
    setSharedTransactions([
      {
        id: `tx-${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
        type: "TOPUP",
        amount: Number(topupAmount),
        runningBalance: newBal,
        description: topupDesc || (isRTL ? "شارژ دستی تنخواه تیم" : "Manual team top-up"),
        authorName: currentUser.name,
      },
      ...sharedTransactions,
    ]);
    setTopupAmount(100);
    setTopupDesc("");
  };

  const handleSharedPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(sharedBuyCost);
    if (cost > sharedBalance) {
      alert(isRTL ? "موجودی حساب اشتراکی برای این خرید کافی نیست!" : "Insufficient shared balance for this purchase!");
      return;
    }
    const newBal = sharedBalance - cost;
    setSharedBalance(newBal);
    setSharedTransactions([
      {
        id: `tx-${Date.now().toString().slice(-4)}`,
        createdAt: new Date().toISOString(),
        type: "PURCHASE",
        amount: cost,
        runningBalance: newBal,
        description: sharedBuyDesc || (isRTL ? "خرید تیمی اشتراکی" : "Team shared purchase"),
        authorName: currentUser.name,
      },
      ...sharedTransactions,
    ]);
    setSharedBuyDesc("");
  };

  // Color classes helper
  const bgCanvas = isDark ? "bg-[#0B0F17] text-[#F8FAFC]" : "bg-[#F8FAFC] text-[#0F172A]";
  const cardBg = isDark ? "bg-[#131B2A] border-[#1E293B]" : "bg-white border-[#E2E8F0]";
  const subBorder = isDark ? "border-[#1E293B]" : "border-[#E2E8F0]";
  const textMuted = isDark ? "text-[#94A3B8]" : "text-[#64748B]";
  const inputBg = isDark ? "bg-[#1B2537] text-white border-[#2A374F]" : "bg-white text-slate-900 border-slate-300";

  return (
    <div className={`min-h-screen ${bgCanvas} ${directionClass} transition-colors duration-200`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Prototype Controls Banner */}
      <header className="sticky top-0 z-50 border-b border-indigo-200/50 bg-indigo-950 px-4 py-2.5 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-semibold text-indigo-100">{t("app.prototype_notice", locale)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-indigo-200">{t("app.switch_role", locale)}</span>
            <div className="flex gap-1">
              {MOCK_USERS.map((user) => {
                const isSelected = currentUser.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSwitchUser(user.id)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400"
                        : "bg-indigo-900/60 text-indigo-200 hover:bg-indigo-800"
                    }`}
                  >
                    {user.name.split(" ")[0]} ({t(`role.${user.role}`, locale)})
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-indigo-800" />

            <button
              onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
              className="rounded-md border border-indigo-700 bg-indigo-900/80 px-2.5 py-1 font-medium text-indigo-100 hover:bg-indigo-800"
            >
              {locale === "fa" ? "English (LTR)" : "فارسی (RTL)"}
            </button>

            <button
              onClick={() => setIsDark(!isDark)}
              className="rounded-md border border-indigo-700 bg-indigo-900/80 px-2.5 py-1 font-medium text-indigo-100 hover:bg-indigo-800"
            >
              {isDark ? "☀️ Light" : "🌙 Dark"}
            </button>

            <button
              onClick={() => setShowStateMatrix(!showStateMatrix)}
              className="rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-500"
            >
              {showStateMatrix ? "Hide State Matrix" : "11 States Matrix"}
            </button>
          </div>
        </div>
      </header>

      {/* Main App Navigation Bar */}
      <nav className={`border-b ${cardBg} px-4 py-3 shadow-xs`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B49DF] text-lg font-bold text-white shadow-sm">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-[#3B49DF] dark:text-[#6366F1]">
                  {t("app.name", locale)}
                </span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  v2.0 Redesign
                </span>
              </div>
              <p className={`text-[12px] ${textMuted}`}>{t("app.tagline", locale)}</p>
            </div>
          </div>

          {/* Role-Specific Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "dashboard"
                  ? "bg-[#3B49DF] text-white"
                  : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
              }`}
            >
              {t("nav.dashboard", locale)}
            </button>

            {/* Employee, Manager, Super Admin have Purchases */}
            {currentUser.role !== "CTO" && (
              <button
                onClick={() => setActiveTab("purchases")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "purchases"
                    ? "bg-[#3B49DF] text-white"
                    : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                }`}
              >
                {t("nav.my_purchases", locale)}
              </button>
            )}

            {/* Manager Tabs */}
            {currentUser.role === "MANAGER" && (
              <>
                <button
                  onClick={() => setActiveTab("team_requests")}
                  className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "team_requests"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.team_requests", locale)}
                  {requests.filter((r) => r.status === "SUBMITTED").length > 0 && (
                    <span className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                      {requests.filter((r) => r.status === "SUBMITTED").length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("team_budgets")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "team_budgets"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.team_budgets", locale)}
                </button>

                <button
                  onClick={() => setActiveTab("team_shared")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "team_shared"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.team_shared", locale)}
                </button>

                <button
                  onClick={() => setActiveTab("team_renewals")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "team_renewals"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.team_renewals", locale)}
                </button>

                <button
                  onClick={() => setActiveTab("team_members")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "team_members"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.team_members", locale)}
                </button>
              </>
            )}

            {/* Super Admin Tabs */}
            {currentUser.role === "SUPER_ADMIN" && (
              <>
                <button
                  onClick={() => setActiveTab("admin_teams")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "admin_teams"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.admin_teams", locale)}
                </button>
                <button
                  onClick={() => setActiveTab("admin_services")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === "admin_services"
                      ? "bg-[#3B49DF] text-white"
                      : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                  }`}
                >
                  {t("nav.admin_services", locale)}
                </button>
              </>
            )}

            {/* CTO Tab */}
            {currentUser.role === "CTO" && (
              <button
                onClick={() => setActiveTab("cto_reports")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "cto_reports"
                    ? "bg-[#3B49DF] text-white"
                    : `hover:bg-slate-100 dark:hover:bg-slate-800 ${textMuted}`
                }`}
              >
                {t("nav.cto_reports", locale)}
              </button>
            )}
          </div>

          {/* User Badge */}
          <div className="flex items-center gap-3">
            <div className="text-end">
              <div className="text-xs font-bold leading-tight">{currentUser.name}</div>
              <div className={`text-[11px] ${textMuted}`}>{t(`role.${currentUser.role}`, locale)}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
              {currentUser.name[0]}
            </div>
          </div>
        </div>
      </nav>

      {/* Optional: 11 States Showcase Panel */}
      {showStateMatrix && (
        <section className="mx-auto my-4 max-w-7xl rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-slate-800 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              🎨 Representative State Matrix Showcase (11 Required States)
            </h3>
            <button onClick={() => setShowStateMatrix(false)} className="text-xs font-bold hover:underline">
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 md:grid-cols-6">
            <div className="rounded-md border bg-white p-2 text-center dark:bg-slate-900">
              <span className="font-semibold">1. Loading:</span>
              <div className="mt-1 h-3 animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
            </div>
            <div className="rounded-md border bg-white p-2 text-center dark:bg-slate-900">
              <span className="font-semibold">2. Empty:</span>
              <p className="mt-1 text-[11px] text-slate-500">«هیچ رکوردی یافت نشد»</p>
            </div>
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-center text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <span className="font-semibold">3. Error:</span>
              <p className="mt-1 text-[11px]">موجودی ناکافی است</p>
            </div>
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-center text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="font-semibold">4. Success:</span>
              <p className="mt-1 text-[11px]">خرید ثبت و کسر شد</p>
            </div>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-center text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="font-semibold">5. Validation:</span>
              <p className="mt-1 text-[11px]">حداقل ۳ نویسه الزامیست</p>
            </div>
            <div className="rounded-md border bg-slate-100 p-2 text-center text-slate-400 dark:bg-slate-800">
              <span className="font-semibold">6. Disabled:</span>
              <button disabled className="mt-1 cursor-not-allowed text-[11px] underline">
                غیرفعال (موجودی صفر)
              </button>
            </div>
            <div className="rounded-md border bg-amber-50 p-2 text-center text-amber-700 dark:bg-amber-900/30">
              <span className="font-semibold">7. Pending:</span>
              <p className="mt-1 font-mono text-[11px]">SUBMITTED</p>
            </div>
            <div className="rounded-md border bg-emerald-50 p-2 text-center text-emerald-700 dark:bg-emerald-900/30">
              <span className="font-semibold">8. Active:</span>
              <p className="mt-1 font-mono text-[11px]">ACTIVE PLAN</p>
            </div>
            <div className="rounded-md border bg-slate-100 p-2 text-center text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <span className="font-semibold">9. Expired:</span>
              <p className="mt-1 font-mono text-[11px]">EXPIRED</p>
            </div>
            <div className="rounded-md border border-green-400 bg-green-50 p-2 text-center text-green-800 dark:bg-green-950/40 dark:text-green-300">
              <span className="font-semibold">10. Reconciled:</span>
              <p className="mt-1 text-[11px]">تراز کامل $0.00</p>
            </div>
            <div className="rounded-md border border-rose-400 bg-rose-50 p-2 text-center text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              <span className="font-semibold">11. Discrepancy:</span>
              <p className="mt-1 text-[11px]">مغایرت سند شناسایی شد</p>
            </div>
          </div>
        </section>
      )}

      {/* Page Content Viewport */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        {/* ========================================================================= */}
        {/* VIEW 1: DASHBOARD                                                        */}
        {/* ========================================================================= */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Hero Welcome Card */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                    {t("dash.welcome", locale)}، {currentUser.name}
                  </h1>
                  <p className={`mt-1 text-sm ${textMuted}`}>
                    {t("scope.personal", locale)} • {currentUser.email} •{" "}
                    {currentUser.teamName || (isRTL ? "بدون تیم اختصاصی" : "No specific team")}
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50 px-4 py-2 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200">
                  <span className="text-xs font-semibold">{t("role." + currentUser.role, locale)}</span>
                </div>
              </div>
            </div>

            {/* Employee Balance Card */}
            {currentUser.role === "EMPLOYEE" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs md:col-span-2`}>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    {t("dash.personal_balance", locale)}
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-extrabold text-[#3B49DF] dark:text-[#6366F1]" dir="ltr">
                      ${currentUser.balance.toFixed(2)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">USD</span>
                  </div>
                  <p className={`mt-3 text-xs leading-relaxed ${textMuted}`}>
                    {t("dash.balance_hint", locale)}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => setActiveTab("purchases")}
                      disabled={currentUser.balance <= 0}
                      className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all ${
                        currentUser.balance > 0
                          ? "bg-[#3B49DF] hover:bg-[#2F3AB2]"
                          : "cursor-not-allowed bg-slate-400"
                      }`}
                    >
                      {currentUser.balance > 0
                        ? t("purchases.request_form_title", locale)
                        : t("purchases.zero_balance_warn", locale)}
                    </button>
                  </div>
                </div>

                <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    {t("purchases.active_plans", locale)}
                  </span>
                  <div className="mt-2 font-mono text-3xl font-bold">
                    {activePlans.filter((p) => p.userId === currentUser.id && p.status === "ACTIVE").length}
                  </div>
                  <p className={`mt-2 text-xs ${textMuted}`}>
                    {isRTL ? "پلن‌های نرم‌افزاری و هوش مصنوعی در حال استفاده شما" : "Active AI & software plans currently in use"}
                  </p>
                </div>
              </div>
            )}

            {/* Manager Action Alert: Budget Lock Pending */}
            {currentUser.role === "MANAGER" && !isBudgetLocked && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white font-bold">
                      !
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        {t("dash.action_needed_budget", locale)}
                      </h4>
                      <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
                        {t("dash.action_needed_budget_desc", locale)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("team_budgets")}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-500"
                  >
                    {t("dash.btn_manage_budget", locale)}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Feed */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold">{t("dash.recent_notifications", locale)}</h3>
              <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-slate-800">
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {isRTL ? "تأیید خرید GitHub Copilot" : "GitHub Copilot Purchase Confirmed"}
                    </span>
                    <p className={`mt-0.5 ${textMuted}`}>
                      {isRTL ? "مدیر تیم خرید شما را با مبلغ $21.00 نهایی کرد." : "Team manager finalized your purchase for $21.00."}
                    </p>
                  </div>
                  <span className={`font-mono text-[11px] ${textMuted}`} dir="ltr">2026-09-18</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {isRTL ? "یادآوری تمدید پلن OpenAI" : "OpenAI Plan Renewal Reminder"}
                    </span>
                    <p className={`mt-0.5 ${textMuted}`}>
                      {isRTL ? "پلن در تاریخ 2026-10-01 تمدید خواهد شد." : "Plan will renew on 2026-10-01."}
                    </p>
                  </div>
                  <span className={`font-mono text-[11px] ${textMuted}`} dir="ltr">2026-09-16</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: PURCHASES (Employee Request & Manager/Admin Direct Purchase)      */}
        {/* ========================================================================= */}
        {activeTab === "purchases" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t("purchases.title", locale)}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {currentUser.role === "EMPLOYEE"
                    ? isRTL
                      ? "ثبت درخواست، مشاهده سوابق و مدیریت تمدید پلن‌های شخصی"
                      : "Submit requests, view history and manage active plans"
                    : isRTL
                    ? "ثبت مستقیم خرید شخصی بدون نیاز به تأیید با کسر از موجودی"
                    : "Register direct personal purchases deducted directly from balance"}
                </p>
              </div>

              {/* Scope Chip */}
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {t("scope.personal", locale)}:{" "}
                <span className="font-mono text-indigo-600 dark:text-indigo-400" dir="ltr">
                  ${currentUser.balance.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Form Feedback Alert */}
            {formFeedback && (
              <div
                className={`rounded-xl border p-4 text-xs font-medium ${
                  formFeedback.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                }`}
              >
                {formFeedback.msg}
              </div>
            )}

            {/* FOR EMPLOYEE: Standard Purchase Request Form */}
            {currentUser.role === "EMPLOYEE" ? (
              <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
                <h3 className="text-sm font-bold text-[#3B49DF] dark:text-[#6366F1]">
                  {t("purchases.request_form_title", locale)}
                </h3>

                {currentUser.balance <= 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    ⚠️ {t("purchases.zero_balance_warn", locale)}
                  </div>
                ) : (
                  <form onSubmit={handleEmployeeSubmitRequest} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">{t("purchases.service_select", locale)}</label>
                      <select
                        value={selectedServiceId}
                        onChange={(e) => {
                          setSelectedServiceId(e.target.value);
                          const s = MOCK_SERVICES.find((x) => x.id === e.target.value);
                          if (s?.defaultPrice) setEstimatedCost(s.defaultPrice);
                        }}
                        className={`w-full rounded-lg border p-2.5 text-xs ${inputBg}`}
                      >
                        {MOCK_SERVICES.filter((s) => s.isActive).map((srv) => (
                          <option key={srv.id} value={srv.id}>
                            {srv.name} ({srv.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1">{t("purchases.estimated_cost", locale)}</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={estimatedCost}
                        onChange={(e) => setEstimatedCost(Number(e.target.value))}
                        className={`w-full rounded-lg border p-2.5 text-xs font-mono ${inputBg}`}
                        dir="ltr"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium mb-1">{t("purchases.need_desc", locale)}</label>
                      <textarea
                        rows={2}
                        value={needDesc}
                        onChange={(e) => setNeedDesc(e.target.value)}
                        placeholder={isRTL ? "مثال: تسریع در نوشتن کدهای بک‌اند و مستندسازی" : "e.g., accelerate backend coding"}
                        className={`w-full rounded-lg border p-2.5 text-xs ${inputBg}`}
                        required
                      />
                    </div>

                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-lg bg-[#3B49DF] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#2F3AB2]"
                      >
                        {t("purchases.btn_submit", locale)}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* FOR MANAGER & ADMIN: Direct Personal Purchase Form */
              <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {t("purchases.direct_form_title", locale)}
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    No Approval Needed
                  </span>
                </div>
                <p className={`mt-1 text-xs ${textMuted}`}>{t("purchases.direct_hint", locale)}</p>

                <form onSubmit={handleDirectPurchase} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">{t("purchases.service_select", locale)}</label>
                    <select
                      value={directServiceId}
                      onChange={(e) => {
                        setDirectServiceId(e.target.value);
                        const s = MOCK_SERVICES.find((x) => x.id === e.target.value);
                        if (s?.defaultPrice) setDirectActualCost(s.defaultPrice);
                      }}
                      className={`w-full rounded-lg border p-2.5 text-xs ${inputBg}`}
                    >
                      {MOCK_SERVICES.filter((s) => s.isActive).map((srv) => (
                        <option key={srv.id} value={srv.id}>
                          {srv.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">{t("requests.actual_cost_label", locale)}</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={directActualCost}
                      onChange={(e) => setDirectActualCost(Number(e.target.value))}
                      className={`w-full rounded-lg border p-2.5 text-xs font-mono ${inputBg}`}
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="directAutoRenew"
                      checked={directAutoRenew}
                      onChange={(e) => setDirectAutoRenew(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-600"
                    />
                    <label htmlFor="directAutoRenew" className="text-xs font-medium">
                      {t("requests.auto_renew_label", locale)}
                    </label>
                  </div>

                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
                    >
                      {t("purchases.btn_direct_buy", locale)}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Active Plans Card Grid */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold mb-4">{t("purchases.active_plans", locale)}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activePlans
                  .filter((p) => p.userId === currentUser.id)
                  .map((plan) => (
                    <div
                      key={plan.id}
                      className={`rounded-xl border ${subBorder} p-4 transition-all hover:shadow-xs`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{plan.serviceName}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            plan.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {t(`status.${plan.status}`, locale)}
                        </span>
                      </div>
                      <div className={`mt-2 text-[11px] ${textMuted}`}>
                        {isRTL ? "دوره:" : "Period:"} <span dir="ltr">{plan.periodStart} ~ {plan.periodEnd}</span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between text-xs">
                        <span className={textMuted}>{isRTL ? "مبلغ واقعی:" : "Cost:"}</span>
                        <span className="font-mono font-bold" dir="ltr">
                          ${plan.actualCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px]">
                        <span className={textMuted}>
                          {plan.autoRenew
                            ? isRTL
                              ? "تمدید ماهانه فعال"
                              : "Auto-renew active"
                            : isRTL
                            ? "عدم تمدید"
                            : "No renew"}
                        </span>
                        {plan.status === "ACTIVE" && !plan.nonRenewalRequested && (
                          <button
                            onClick={() => handleRequestNonRenewal(plan.id)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {t("purchases.btn_request_non_renewal", locale)}
                          </button>
                        )}
                        {plan.nonRenewalRequested && (
                          <span className="text-[10px] font-semibold text-amber-600">
                            {isRTL ? "درخواست عدم تمدید ثبت شد" : "Non-renewal requested"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Request History Table */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold mb-4">{t("purchases.req_history", locale)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">#</th>
                      <th className="pb-2 text-start font-semibold">{t("purchases.service_select", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("purchases.estimated_cost", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.status_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("purchases.need_desc", locale)}</th>
                      <th className="pb-2 text-end font-semibold">{t("members.actions_label", locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {requests
                      .filter((r) => r.requesterId === currentUser.id)
                      .map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-mono text-[11px]">{req.id}</td>
                          <td className="py-3 font-semibold">{req.serviceName}</td>
                          <td className="py-3 font-mono" dir="ltr">${req.estimatedCost.toFixed(2)}</td>
                          <td className="py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                req.status === "SUBMITTED"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : req.status === "PURCHASED"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : req.status === "REJECTED"
                                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {t(`status.${req.status}`, locale)}
                            </span>
                            {req.rejectionReason && (
                              <div className="mt-1 text-[11px] text-red-600">
                                {t("purchases.rejection_reason_label", locale)} {req.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td className={`py-3 max-w-xs truncate ${textMuted}`}>{req.needDescription}</td>
                          <td className="py-3 text-end">
                            {req.status === "SUBMITTED" && (
                              <button
                                onClick={() => handleCancelRequest(req.id)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                {t("purchases.btn_cancel", locale)}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: TEAM REQUESTS QUEUE (Manager Decision Engine)                     */}
        {/* ========================================================================= */}
        {activeTab === "team_requests" && currentUser.role === "MANAGER" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">{t("requests.title", locale)}</h2>
              <p className={`text-xs ${textMuted}`}>{t("requests.subtitle", locale)}</p>
            </div>

            {decisionFeedback && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {decisionFeedback}
              </div>
            )}

            {requests.filter((r) => r.status === "SUBMITTED").length === 0 ? (
              <div className={`rounded-2xl border ${cardBg} p-12 text-center shadow-xs`}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  ✓
                </div>
                <h3 className="mt-3 text-sm font-bold">{t("requests.empty", locale)}</h3>
              </div>
            ) : (
              <div className="space-y-4">
                {requests
                  .filter((r) => r.status === "SUBMITTED")
                  .map((req) => {
                    const applicantBalance = req.requesterBalance;
                    const defaultCost = actualCostOverrides[req.id] ?? req.estimatedCost;
                    const compShare = Math.min(applicantBalance, defaultCost);
                    const persShare = Math.max(0, defaultCost - applicantBalance);

                    return (
                      <div
                        key={req.id}
                        className={`rounded-2xl border ${cardBg} p-6 shadow-xs transition-all`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                          <div>
                            <span className="font-mono text-xs font-semibold text-slate-400">#{req.id}</span>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">
                              {req.serviceName}
                            </h4>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {t("status.SUBMITTED", locale)}
                          </span>
                        </div>

                        {/* Applicant & Cost Overview */}
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <span className={`text-[11px] ${textMuted}`}>{t("requests.applicant", locale)}</span>
                            <div className="font-semibold text-xs mt-0.5">{req.requesterName}</div>
                            <div className={`text-[11px] ${textMuted}`}>
                              {t("requests.available_balance", locale)}{" "}
                              <span className="font-mono font-bold text-indigo-600" dir="ltr">
                                ${applicantBalance.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <span className={`text-[11px] ${textMuted}`}>{t("purchases.need_desc", locale)}</span>
                            <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                              {req.needDescription}
                            </p>
                          </div>
                        </div>

                        {/* Decision Forms: Complete vs Reject */}
                        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 pt-4 border-t">
                          {/* Option A: Confirm Purchase */}
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <h5 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              {t("requests.btn_complete", locale)}
                            </h5>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium mb-1">
                                  {t("requests.actual_cost_label", locale)}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.5"
                                  value={defaultCost}
                                  onChange={(e) =>
                                    setActualCostOverrides({ ...actualCostOverrides, [req.id]: Number(e.target.value) })
                                  }
                                  className={`w-full rounded-md border p-2 text-xs font-mono ${inputBg}`}
                                  dir="ltr"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium mb-1">
                                  {t("requests.start_date_label", locale)}
                                </label>
                                <input
                                  type="date"
                                  defaultValue={new Date().toISOString().split("T")[0]}
                                  className={`w-full rounded-md border p-2 text-xs ${inputBg}`}
                                  dir="ltr"
                                />
                              </div>
                            </div>
                            <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                              {isRTL ? "تسهیم هوشمند:" : "Smart Split:"} سهم شرکت: ${compShare.toFixed(2)} | سهم شخصی: ${persShare.toFixed(2)}
                            </div>
                            <button
                              onClick={() => handleManagerCompletePurchase(req)}
                              className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                              {t("requests.btn_complete", locale)}
                            </button>
                          </div>

                          {/* Option B: Reject Request */}
                          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                            <h5 className="text-xs font-bold text-red-800 dark:text-red-300">
                              {t("requests.btn_reject", locale)}
                            </h5>
                            <div className="mt-3">
                              <label className="block text-[11px] font-medium mb-1">
                                {t("requests.reject_reason_label", locale)}
                              </label>
                              <input
                                type="text"
                                placeholder={isRTL ? "مثال: لایسنس موجود است..." : "e.g., license available"}
                                value={rejectionReasons[req.id] || ""}
                                onChange={(e) =>
                                  setRejectionReasons({ ...rejectionReasons, [req.id]: e.target.value })
                                }
                                className={`w-full rounded-md border p-2 text-xs ${inputBg}`}
                              />
                            </div>
                            <button
                              onClick={() => handleManagerRejectRequest(req.id)}
                              className="mt-3 w-full rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-500"
                            >
                              {t("requests.btn_reject", locale)}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: BUDGET ALLOCATION (Monthly Baseline + Member Overrides + Lock)    */}
        {/* ========================================================================= */}
        {activeTab === "team_budgets" && currentUser.role === "MANAGER" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t("budgets.title", locale)}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {t("budgets.month_label", locale)}{" "}
                  <span className="font-mono font-bold text-indigo-600" dir="ltr">
                    2026-09
                  </span>{" "}
                  (Current Month Only)
                </p>
              </div>

              {isBudgetLocked && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  🔒 {t("budgets.locked_badge", locale)}
                </span>
              )}
            </div>

            {budgetSuccessMsg && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {budgetSuccessMsg}
              </div>
            )}

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {t("budgets.new_allocation", locale)}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-indigo-600" dir="ltr">
                  ${(baselineBudget * (teamMembers.filter((m) => m.isActive).length - 1) + 70).toFixed(2)}
                </div>
              </div>

              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {t("budgets.carry_over", locale)}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-slate-700 dark:text-slate-300" dir="ltr">
                  ${teamMembers.reduce((acc, m) => acc + m.balance, 0).toFixed(2)}
                </div>
              </div>

              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {t("budgets.projected_total", locale)}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-emerald-600" dir="ltr">
                  ${(
                    teamMembers.reduce((acc, m) => acc + m.balance, 0) +
                    baselineBudget * (teamMembers.filter((m) => m.isActive).length - 1) +
                    70
                  ).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Team Baseline Setter */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">{t("budgets.baseline_label", locale)}</label>
                  <p className={`text-xs ${textMuted}`}>
                    {isRTL
                      ? "این مبلغ به عنوان مقدار پیش‌فرض به تمام اعضای فعال تیم تخصیص داده می‌شود."
                      : "Default amount allocated to all active team members"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">$</span>
                  <input
                    type="number"
                    disabled={isBudgetLocked}
                    value={baselineBudget}
                    onChange={(e) => setBaselineBudget(Number(e.target.value))}
                    className={`w-28 rounded-lg border p-2 text-xs font-mono ${inputBg} ${
                      isBudgetLocked ? "cursor-not-allowed opacity-60" : ""
                    }`}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Member Allocations Table */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">{t("members.name_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.status_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("budgets.carry_over", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("budgets.new_allocation", locale)}</th>
                      <th className="pb-2 text-end font-semibold">{t("budgets.projected_total", locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {teamMembers.map((member) => {
                      const overrideVal = overrides[member.id];
                      const allocatedThisMonth = member.isActive
                        ? overrideVal !== undefined
                          ? overrideVal
                          : baselineBudget
                        : 0;
                      const finalBalance = member.balance + allocatedThisMonth;

                      return (
                        <tr key={member.id}>
                          <td className="py-3 font-semibold">
                            {member.name}
                            <div className={`text-[10px] font-normal ${textMuted}`}>{member.email}</div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                member.isActive
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {member.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 font-mono" dir="ltr">
                            ${member.balance.toFixed(2)}
                          </td>
                          <td className="py-3">
                            {member.isActive ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  disabled={isBudgetLocked}
                                  value={allocatedThisMonth}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setOverrides((prev) => ({ ...prev, [member.id]: val }));
                                  }}
                                  className={`w-20 rounded border p-1 text-xs font-mono ${inputBg} ${
                                    isBudgetLocked ? "cursor-not-allowed opacity-60" : ""
                                  }`}
                                  dir="ltr"
                                />
                                {overrideVal !== undefined && (
                                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                    Custom
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className={textMuted}>$0.00</span>
                            )}
                          </td>
                          <td className="py-3 text-end font-mono font-bold text-emerald-600" dir="ltr">
                            ${finalBalance.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              {!isBudgetLocked && (
                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t pt-4">
                  <button
                    onClick={() => {
                      setBudgetSuccessMsg(
                        isRTL ? "پیش‌نویس بودجه ذخیره شد (هنوز قفل نشده است)." : "Budget draft saved (not locked yet)."
                      );
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("budgets.btn_save_draft", locale)}
                  </button>
                  <button
                    onClick={() => {
                      setIsBudgetLocked(true);
                      setBudgetSuccessMsg(
                        isRTL
                          ? "تخصیص بودجه ماه 2026-09 با موفقیت تأیید و قفل شد. اعتبارات اعمال گردید."
                          : "Budget for 2026-09 confirmed and locked successfully. Balances applied."
                      );
                    }}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
                  >
                    {t("budgets.btn_confirm_lock", locale)}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 5: SHARED BUDGET (Team Account, Manual Topup & Shared Purchases)     */}
        {/* ========================================================================= */}
        {activeTab === "team_shared" && currentUser.role === "MANAGER" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">{t("shared.title", locale)}</h2>
              <p className={`text-xs ${textMuted}`}>{t("shared.balance_note", locale)}</p>
            </div>

            {/* Big Shared Balance Card */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <span className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                {t("shared.current_balance", locale)}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-extrabold text-[#3B49DF] dark:text-[#6366F1]" dir="ltr">
                  ${sharedBalance.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-slate-500">USD</span>
              </div>
            </div>

            {/* Two Action Panels: Top-up vs Shared Purchase */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Panel A: Topup */}
              <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
                <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {t("shared.topup_title", locale)}
                </h3>
                <form onSubmit={handleSharedTopup} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {isRTL ? "مبلغ شارژ (USD)" : "Top-up Amount (USD)"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(Number(e.target.value))}
                      className={`w-full rounded-lg border p-2 text-xs font-mono ${inputBg}`}
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {isRTL ? "شرح منبع شارژ تنخواه" : "Source Description / Ref"}
                    </label>
                    <input
                      type="text"
                      value={topupDesc}
                      onChange={(e) => setTopupDesc(e.target.value)}
                      placeholder={isRTL ? "مثال: تنخواه مالی مصوب سپتامبر" : "e.g., Q3 dev petty cash"}
                      className={`w-full rounded-lg border p-2 text-xs ${inputBg}`}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    {t("shared.topup_title", locale)}
                  </button>
                </form>
              </div>

              {/* Panel B: Register Shared Purchase */}
              <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
                <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {t("shared.purchase_title", locale)}
                </h3>
                <form onSubmit={handleSharedPurchase} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {isRTL ? "مبلغ خرید (USD)" : "Purchase Cost (USD)"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={sharedBuyCost}
                      onChange={(e) => setSharedBuyCost(Number(e.target.value))}
                      className={`w-full rounded-lg border p-2 text-xs font-mono ${inputBg}`}
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      {isRTL ? "شرح خرید غیرشخصی تیم" : "Shared Tool Description"}
                    </label>
                    <input
                      type="text"
                      value={sharedBuyDesc}
                      onChange={(e) => setSharedBuyDesc(e.target.value)}
                      placeholder={isRTL ? "مثال: رانرهای مشترک تیم تست" : "e.g., Shared CI runner"}
                      className={`w-full rounded-lg border p-2 text-xs ${inputBg}`}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-[#3B49DF] py-2.5 text-xs font-semibold text-white hover:bg-[#2F3AB2]"
                  >
                    {t("shared.purchase_title", locale)}
                  </button>
                </form>
              </div>
            </div>

            {/* Shared Ledger Table */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold mb-4">{t("shared.ledger_title", locale)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "شناسه" : "ID"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "نوع" : "Type"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "مبلغ" : "Amount"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "مانده پس از تراکنش" : "Balance"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "توضیحات" : "Description"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sharedTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-3 font-mono text-[11px]">{tx.id}</td>
                        <td className="py-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              tx.type === "TOPUP"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-semibold" dir="ltr">
                          {tx.type === "TOPUP" ? `+$${tx.amount.toFixed(2)}` : `-$${tx.amount.toFixed(2)}`}
                        </td>
                        <td className="py-3 font-mono" dir="ltr">
                          ${tx.runningBalance.toFixed(2)}
                        </td>
                        <td className={`py-3 max-w-md ${textMuted}`}>{tx.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 6: RENEWALS & EXPIRY (Manager)                                      */}
        {/* ========================================================================= */}
        {activeTab === "team_renewals" && currentUser.role === "MANAGER" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">{t("renewals.title", locale)}</h2>
            </div>

            {/* Non-Renewal Requests by Employees */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3">
                {t("renewals.non_renew_requests", locale)}
              </h3>
              <div className="space-y-3">
                {activePlans.filter((p) => p.nonRenewalRequested && !p.nonRenewalAcknowledged).length === 0 ? (
                  <p className={`text-xs ${textMuted}`}>
                    {isRTL ? "هیچ درخواست عدم تمدید بازی وجود ندارد." : "No open non-renewal requests."}
                  </p>
                ) : (
                  activePlans
                    .filter((p) => p.nonRenewalRequested && !p.nonRenewalAcknowledged)
                    .map((plan) => (
                      <div
                        key={plan.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"
                      >
                        <div>
                          <div className="text-xs font-bold">{plan.serviceName}</div>
                          <div className={`text-[11px] ${textMuted}`}>
                            {isRTL ? "کاربر:" : "User:"} {plan.userName} | {isRTL ? "پایان دوره:" : "Ends:"} {plan.periodEnd}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setActivePlans((prev) =>
                              prev.map((p) =>
                                p.id === plan.id ? { ...p, nonRenewalAcknowledged: true, autoRenew: false } : p
                              )
                            );
                          }}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                        >
                          {t("renewals.btn_ack_non_renew", locale)}
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Expired Plans Management */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold mb-3">{t("renewals.expired_notice", locale)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">{t("purchases.service_select", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.name_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "تاریخ پایان" : "Period End"}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.status_label", locale)}</th>
                      <th className="pb-2 text-end font-semibold">{t("members.actions_label", locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activePlans.map((plan) => (
                      <tr key={plan.id}>
                        <td className="py-3 font-semibold">{plan.serviceName}</td>
                        <td className="py-3">{plan.userName}</td>
                        <td className="py-3 font-mono" dir="ltr">{plan.periodEnd}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              plan.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {plan.status}
                          </span>
                        </td>
                        <td className="py-3 text-end">
                          {plan.status === "ACTIVE" && (
                            <button
                              onClick={() => {
                                setActivePlans((prev) =>
                                  prev.map((p) => (p.id === plan.id ? { ...p, status: "EXPIRED" as const } : p))
                                );
                              }}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {t("renewals.btn_mark_expired", locale)}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 7: TEAM MEMBERS (Manager)                                           */}
        {/* ========================================================================= */}
        {activeTab === "team_members" && currentUser.role === "MANAGER" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t("members.title", locale)}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {isRTL ? "مدیریت اعضای تیم، وضعیت فعال/غیرفعال و مانده حساب‌ها" : "Manage team members, active status and balances"}
                </p>
              </div>
              <button
                onClick={() => {
                  alert(isRTL ? "فرم افزودن عضو با پسورد اولیه حداقل ۱۲ نویسه باز می‌شود." : "Add member form opens.");
                }}
                className="rounded-lg bg-[#3B49DF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2F3AB2]"
              >
                + {t("members.btn_add", locale)}
              </button>
            </div>

            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">{t("members.name_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.email_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.role_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.balance_label", locale)}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.status_label", locale)}</th>
                      <th className="pb-2 text-end font-semibold">{t("members.actions_label", locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {teamMembers.map((member) => (
                      <tr key={member.id}>
                        <td className="py-3 font-semibold">{member.name}</td>
                        <td className="py-3 font-mono text-[11px]">{member.email}</td>
                        <td className="py-3">{member.role}</td>
                        <td className="py-3 font-mono font-semibold" dir="ltr">
                          ${member.balance.toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              member.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {member.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 text-end">
                          {member.isActive && (
                            <button
                              onClick={() => {
                                setTeamMembers((prev) =>
                                  prev.map((m) => (m.id === member.id ? { ...m, isActive: false } : m))
                                );
                              }}
                              className="rounded-md border border-red-300 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                            >
                              {t("members.btn_deactivate", locale)}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 8: SUPER ADMIN (Teams & Services)                                    */}
        {/* ========================================================================= */}
        {activeTab === "admin_teams" && currentUser.role === "SUPER_ADMIN" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t("admin.teams_title", locale)}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {isRTL ? "ایجاد تیم‌ها، تخصیص مدیران و نظارت بر ساختار سازمانی" : "Create teams, assign managers"}
                </p>
              </div>
              <button
                onClick={() => alert("Create team modal")}
                className="rounded-lg bg-[#3B49DF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2F3AB2]"
              >
                + {t("admin.btn_create_team", locale)}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">تیم پلتفرم و زیرساخت (Platform Core)</h4>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Active
                  </span>
                </div>
                <div className={`mt-2 text-xs ${textMuted}`}>
                  {isRTL ? "مدیر تیم:" : "Manager:"} نیما پارسا (nima.p@acme-corp.internal)
                </div>
                <div className={`mt-1 text-xs ${textMuted}`}>{isRTL ? "تعداد اعضا:" : "Members:"} ۵ نفر</div>
              </div>

              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm">تیم هوش مصنوعی و مدل‌ها (AI & Models)</h4>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Active
                  </span>
                </div>
                <div className={`mt-2 text-xs ${textMuted}`}>
                  {isRTL ? "مدیر تیم:" : "Manager:"} فرزاد رفیعی (farzad.r@acme-corp.internal)
                </div>
                <div className={`mt-1 text-xs ${textMuted}`}>{isRTL ? "تعداد اعضا:" : "Members:"} ۳ نفر</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "admin_services" && currentUser.role === "SUPER_ADMIN" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{t("admin.services_title", locale)}</h2>
                <p className={`text-xs ${textMuted}`}>
                  {isRTL ? "تعریف و نگهداری کاتالوگ مجاز ابزارها" : "Maintain authorized SaaS catalog"}
                </p>
              </div>
              <button
                onClick={() => alert("Add service modal")}
                className="rounded-lg bg-[#3B49DF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2F3AB2]"
              >
                + {t("admin.btn_create_service", locale)}
              </button>
            </div>

            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "نام ابزار" : "Name"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "دسته‌بندی" : "Category"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "قیمت پیش‌فرض ماهانه" : "Default Price"}</th>
                      <th className="pb-2 text-start font-semibold">{t("members.status_label", locale)}</th>
                      <th className="pb-2 text-end font-semibold">{t("members.actions_label", locale)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {MOCK_SERVICES.map((srv) => (
                      <tr key={srv.id}>
                        <td className="py-3 font-semibold">{srv.name}</td>
                        <td className="py-3">{srv.category}</td>
                        <td className="py-3 font-mono" dir="ltr">
                          ${srv.defaultPrice?.toFixed(2) || "N/A"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              srv.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {srv.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 text-end">
                          <button
                            onClick={() => alert(`Edit ${srv.name}`)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {isRTL ? "ویرایش" : "Edit"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 9: CTO REPORTS (Audit, Reconciliation Status & Financial Overview)  */}
        {/* ========================================================================= */}
        {activeTab === "cto_reports" && currentUser.role === "CTO" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">{t("reports.title", locale)}</h2>
              <p className={`text-xs ${textMuted}`}>
                {isRTL ? "نظارت ارشد، تطبیق دفترکل، تفکیک هزینه‌ها و ردیابی حسابرسی" : "Executive audit & reconciliation view"}
              </p>
            </div>

            {/* Reconciliation Status Banner */}
            <div className="rounded-2xl border border-emerald-400 bg-emerald-50/90 p-5 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    {t("reports.reconciliation_title", locale)}: RECONCILED (OK)
                  </h4>
                  <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    {t("reports.reconciled_clean", locale)}
                  </p>
                </div>
              </div>
            </div>

            {/* CTO Stats Matrix */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {isRTL ? "کل خریدهای دوره" : "Total Period Purchases"}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-[#3B49DF] dark:text-[#6366F1]" dir="ltr">
                  $1,420.00
                </div>
              </div>

              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {isRTL ? "سهم پرداخت شده شرکت" : "Company Funded"}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-emerald-600" dir="ltr">
                  $1,365.00
                </div>
              </div>

              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {isRTL ? "سهم پرداختی شخصی کارکنان" : "Personal Contributions"}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-amber-600" dir="ltr">
                  $55.00
                </div>
              </div>

              <div className={`rounded-2xl border ${cardBg} p-5 shadow-xs`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  {isRTL ? "مغایرت دفترکل (Discrepancy)" : "Ledger Discrepancy"}
                </span>
                <div className="mt-2 font-mono text-2xl font-bold text-slate-500" dir="ltr">
                  $0.00
                </div>
              </div>
            </div>

            {/* Audit Log (Last 50 Events) */}
            <div className={`rounded-2xl border ${cardBg} p-6 shadow-xs`}>
              <h3 className="text-sm font-bold mb-4">{t("reports.audit_title", locale)}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className={`border-b ${subBorder} text-[11px] ${textMuted}`}>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "زمان (UTC)" : "Timestamp"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "مجری (Actor)" : "Actor"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "عملیات (Action)" : "Action"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "موجودیت" : "Entity"}</th>
                      <th className="pb-2 text-start font-semibold">{isRTL ? "جزئیات رویداد" : "Details"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {INITIAL_AUDIT_EVENTS.map((evt) => (
                      <tr key={evt.id}>
                        <td className="py-3 font-mono text-[11px]" dir="ltr">
                          {evt.timestamp.replace("T", " ").replace("Z", "")}
                        </td>
                        <td className="py-3 font-semibold">
                          {evt.actorName}{" "}
                          <span className="text-[10px] text-slate-400">({evt.actorRole})</span>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {evt.action}
                        </td>
                        <td className="py-3 text-[11px]">{evt.entityType}</td>
                        <td className={`py-3 max-w-sm ${textMuted}`}>{evt.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
