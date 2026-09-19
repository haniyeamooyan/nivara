export default function ReportsLoading() {
  return (
    <main className="app-shell" aria-busy="true" aria-label="در حال بارگذاری گزارش‌ها">
      <div className="report-loading-header"><span /><span /><span /></div>
      <div className="page-content">
        <div className="report-loading-heading"><span /><span /></div>
        <div className="report-loading-filters">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</div>
        <div className="report-loading-metrics">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
        <div className="report-loading-panel" />
        <span className="sr-only" role="status">گزارش شرکت در حال بارگذاری است.</span>
      </div>
    </main>
  );
}
