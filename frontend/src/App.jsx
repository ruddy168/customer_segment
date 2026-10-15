import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  UserRoundCheck,
  UserRoundX,
  X,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import axios from "axios";
import "./App.css";

const API = "/api";
const SEGMENT_COLORS = ["#f5c518", "#ffe566", "#c9a227", "#a16207", "#fde68a"];
const PAGE_SIZE_ALL = "ALL";
const PAGE_SIZE_OPTIONS = ["25", "50", "100", PAGE_SIZE_ALL];
const ALL_CUSTOMERS_LIMIT = 10000;
const SEGMENT_PAGE_SIZE = 10;
const RETENTION_PAGE_SIZE = 10;

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number)
    ? number.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "—";
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `£${number.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "—";
}

function getStatusClass(status) {
  return String(status ?? "").toLowerCase().replace(/\s+/g, "-");
}

function StatCard({ title, value, subtitle, icon: Icon, color = "purple" }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${color}`}><Icon size={19} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">{subtitle}</div>
    </article>
  );
}

function CustomerDetails({ customer, onClose }) {
  if (!customer) return null;
  const details = [
    ["Customer ID", customer.customer_id ?? "—"],
    ["Segment", customer.segment ?? "—"],
    ["Activity Status", customer.activity_status ?? "—"],
    ["Recency (days)", formatNumber(customer.recency)],
    ["Frequency", formatNumber(customer.frequency)],
    ["Monetary Value", formatCurrency(customer.monetary)],
  ];
  return (
    <section className="customer-details" aria-label="Customer details">
      <div className="customer-details-header">
        <div>
          <h3>Customer Profile</h3>
          <p>Customer ID: {customer.customer_id}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>
          <X size={14} /> Close
        </button>
      </div>
      <div className="customer-details-grid">
        {details.map(([label, value]) => (
          <div className="detail-card" key={label}>
            <span>{label}</span><strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ErrorBanner({ message, onRetry, disabled = false }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <AlertTriangle size={17} />
      <span className="error-text">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} disabled={disabled}>Retry</button>}
    </div>
  );
}

function RetentionCustomerTable({ title, description, customers, loading }) {
  return (
    <section className="panel retention-list-panel">
      <div className="panel-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        <span className="results-count">{formatNumber(customers.length)} shown</span>
      </div>
      <div className={`table-scroll ${loading ? "is-loading" : ""}`}>
        <table>
          <thead><tr><th>Customer ID</th><th>Segment</th><th>Recency</th><th>Frequency</th><th>Monetary</th></tr></thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.customer_id}>
                <td className="customer-id">{customer.customer_id}</td>
                <td>{customer.segment ?? "—"}</td>
                <td>{formatNumber(customer.recency)}</td>
                <td>{formatNumber(customer.frequency)}</td>
                <td>{formatCurrency(customer.monetary)}</td>
              </tr>
            ))}
            {loading && customers.length === 0 && <tr><td colSpan={5} className="empty-state">Loading customers…</td></tr>}
            {!loading && customers.length === 0 && <tr><td colSpan={5} className="empty-state">No customers to display.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function AiInsightsPage({ overview, segments }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateInsights = useCallback(async () => {
    if (!overview || !Array.isArray(segments) || segments.length === 0) {
      setError("Load dashboard and segment data before generating insights.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        overview: {
          total_customers: Number(overview.total_customers ?? 0),
          active_customers: Number(overview.active_customers ?? 0),
          at_risk_customers: Number(overview.at_risk_customers ?? 0),
          inactive_customers: Number(overview.inactive_customers ?? 0),
          total_revenue: Number(overview.total_revenue ?? overview.total_monetary ?? overview.total_sales ?? 0),
          total_orders: Number(overview.total_orders ?? overview.total_transactions ?? 0),
          average_order_value: Number(overview.average_order_value ?? overview.avg_order_value ?? 0),
        },
        segments: segments.map((item) => ({
          segment: String(item.segment ?? "Unknown").slice(0, 100),
          customer_count: Number(item.customer_count ?? 0),
          average_recency: Number(item.average_recency ?? item.avg_recency ?? 0),
          average_frequency: Number(item.average_frequency ?? item.avg_frequency ?? 0),
          average_monetary: Number(item.average_monetary ?? item.avg_monetary ?? 0),
        })),
      };

const response = await axios.post(
  `${API}/ai/retention-insights`,
  payload,
  { timeout: 60000 }
);

      setInsights(response.data);
    } catch (err) {
      if (statusCode === 503) setError("Gemini is not configured yet. Add GEMINI_API_KEY to the backend .env file and restart FastAPI.");
      else if (statusCode === 429) setError("Gemini free-tier rate limit reached. Wait a little and try again.");
      else if (statusCode === 502) setError("Gemini could not generate insights right now. Please retry in a moment.");
      else if (err?.code === "ECONNABORTED") setError("The request took too long. Please retry.");
      else if (!err.response) {
        setError("Could not reach the backend. Check that FastAPI is running and try again.");
      } else {
        setError("Could not generate AI insights. Please retry.");
      }
    } finally {
      setLoading(false);
    }
  }, [overview, segments]);

  const priorities = Array.isArray(insights?.priorities) ? insights.priorities : [];
  return (
    <div className="ai-insights-page">
      <section className="panel ai-hero">
        <div className="ai-hero-icon"><Sparkles size={24} /></div>
        <div className="ai-hero-copy">
          <span className="panel-tag">GEMINI-POWERED</span>
          <h2>Turn customer data into retention actions</h2>
          <p>Generate practical campaign ideas from your existing customer and RFM segment analytics.</p>
        </div>
        <button type="button" className="primary-button ai-generate-button" onClick={generateInsights} disabled={loading || !overview || !segments.length}>
          <Sparkles size={16} /> {loading ? "Generating insights…" : insights ? "Regenerate insights" : "Generate AI insights"}
        </button>
      </section>

      <div className="ai-privacy-note"><span className="status-dot" /> Only aggregated overview and segment metrics are sent to Gemini. Individual customer records are not sent.</div>
      {error && <ErrorBanner message={error} onRetry={generateInsights} disabled={loading} />}
      {loading && <div className="loading-panel"><RefreshCw size={18} className="spin-icon" /> Gemini is analyzing the aggregated metrics. This can take several seconds…</div>}

      {!insights && !loading && !error && <section className="panel ai-empty-state">
        <div className="ai-empty-icon"><Sparkles size={26} /></div>
        <h3>Your retention strategy starts here</h3>
        <p>Generate a concise executive summary and prioritized actions grounded in your current customer segments.</p>
      </section>}

      {insights && <>
        <section className="panel ai-summary-panel">
          <div className="panel-heading"><div><h2>Executive summary</h2><p>AI-generated interpretation of the current dataset</p></div><span className="panel-tag">INSIGHTS</span></div>
          <p className="ai-summary-text">{insights.executive_summary || "No summary was returned."}</p>
          {insights.key_observations?.length > 0 && <div className="ai-observations"><h3>Key observations</h3><ul>{insights.key_observations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>}
        </section>
        <div className="ai-priorities-heading"><div><h2>Recommended actions</h2><p>Prioritized experiments—not guaranteed outcomes.</p></div><span className="results-count">{priorities.length} priorities</span></div>
        <div className="ai-priorities-grid">
          {priorities.map((item, index) => <article className="panel ai-priority-card" key={`${item.title || "priority"}-${index}`}>
            <div className="ai-priority-top"><span className="ai-priority-number">{String(index + 1).padStart(2, "0")}</span><span className="panel-tag">{item.priority || "ACTION"}</span></div>
            <h3>{item.title || "Retention action"}</h3>
            {item.target_segment && <div className="ai-target-segment"><span>Target segment</span><strong>{item.target_segment}</strong></div>}
            <p>{item.rationale || "Use this as a testable retention hypothesis."}</p>
            {Array.isArray(item.actions) && item.actions.length > 0 && <><h4>Suggested steps</h4><ul>{item.actions.map((action, i) => <li key={`${i}-${action}`}>{action}</li>)}</ul></>}
            {item.success_metric && <div className="ai-success-metric"><span>Measure success with</span><strong>{item.success_metric}</strong></div>}
          </article>)}
        </div>
        {insights.caveats && <p className="ai-caveat"><strong>Interpretation note:</strong> {insights.caveats}</p>}
      </>}
    </div>
  );
}

export default function App() {
  const [overview, setOverview] = useState(null);
  const [segments, setSegments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [status, setStatus] = useState("All");
  const [pageSize, setPageSize] = useState("25");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [tableError, setTableError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [activePage, setActivePage] = useState("overview");
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentCustomers, setSegmentCustomers] = useState([]);
  const [segmentCustomersTotal, setSegmentCustomersTotal] = useState(0);
  const [segmentPage, setSegmentPage] = useState(1);
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [segmentError, setSegmentError] = useState("");
  const [selectedSegmentCustomer, setSelectedSegmentCustomer] = useState(null);
  const [atRiskCustomers, setAtRiskCustomers] = useState([]);
  const [inactiveCustomers, setInactiveCustomers] = useState([]);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionError, setRetentionError] = useState("");

  const customerRequestId = useRef(0);
  const segmentRequestId = useRef(0);
  const retentionRequestId = useRef(0);
  const dashboardRequestId = useRef(0);

  const customerLimit = useCallback(
    () => (pageSize === PAGE_SIZE_ALL ? ALL_CUSTOMERS_LIMIT : Number(pageSize)),
    [pageSize]
  );

  const loadDashboard = useCallback(async () => {
    const requestId = ++dashboardRequestId.current;
    setLoading(true);
    setError("");
    try {
      const [overviewResponse, segmentsResponse] = await Promise.all([
        axios.get(`${API}/analytics/overview`),
        axios.get(`${API}/analytics/segments`),
      ]);
      if (requestId !== dashboardRequestId.current) return;
      setOverview(overviewResponse.data ?? null);
      setSegments(Array.isArray(segmentsResponse.data?.segments) ? segmentsResponse.data.segments : []);
    } catch (err) {
      if (requestId !== dashboardRequestId.current) return;
      setError("Could not load dashboard data. Make sure FastAPI is running on port 8000.");
    } finally {
      if (requestId === dashboardRequestId.current) setLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    const requestId = ++customerRequestId.current;
    const query = search.trim();
    const limit = customerLimit();
    const offset = (currentPage - 1) * limit;

    if (query && !/^\d+$/.test(query)) {
      setSearchError("Enter a numeric customer ID.");
      setCustomers([]);
      setCustomersTotal(0);
      setTableError("");
      setTableLoading(false);
      return;
    }

    setSearchError("");
    setTableError("");
    setTableLoading(true);
    try {
      const params = { limit, offset };
      if (status !== "All") params.activity_status = status;
      if (query) params.search = query;
      const response = await axios.get(`${API}/customers`, { params });
      if (requestId !== customerRequestId.current) return;
      const data = response.data ?? {};
      const total = Math.max(0, Number(data.total) || 0);
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setCustomersTotal(total);
      const maxPage = Math.max(1, Math.ceil(total / limit));
      if (currentPage > maxPage) setCurrentPage(maxPage);
    } catch (err) {
      if (requestId !== customerRequestId.current) return;
      setCustomers([]);
      setCustomersTotal(0);
      setTableError("Could not load customers. Check the backend and retry.");
    } finally {
      if (requestId === customerRequestId.current) setTableLoading(false);
    }
  }, [customerLimit, currentPage, search, status]);

  const loadSegmentCustomers = useCallback(async (segment, page = 1) => {
    if (!segment) return;
    const requestId = ++segmentRequestId.current;
    const safePage = Math.max(1, Number(page) || 1);
    setSegmentLoading(true);
    setSegmentError("");
    try {
      const response = await axios.get(`${API}/customers`, {
        params: { segment, limit: SEGMENT_PAGE_SIZE, offset: (safePage - 1) * SEGMENT_PAGE_SIZE },
      });
      if (requestId !== segmentRequestId.current) return;
      const data = response.data ?? {};
      const total = Math.max(0, Number(data.total) || 0);
      const maxPage = Math.max(1, Math.ceil(total / SEGMENT_PAGE_SIZE));
      if (safePage > maxPage) {
        setSegmentPage(maxPage);
        // The newer request invalidates this response; the effect below fetches the corrected page.
        setSegmentCustomersTotal(total);
        return;
      }
      setSegmentCustomers(Array.isArray(data.customers) ? data.customers : []);
      setSegmentCustomersTotal(total);
      setSegmentPage(safePage);
    } catch (err) {
      if (requestId !== segmentRequestId.current) return;
      setSegmentCustomers([]);
      setSegmentCustomersTotal(0);
      setSegmentError("Could not load customers for this segment. Please retry.");
    } finally {
      if (requestId === segmentRequestId.current) setSegmentLoading(false);
    }
  }, []);

  const loadRetentionCustomers = useCallback(async () => {
    const requestId = ++retentionRequestId.current;
    setRetentionLoading(true);
    setRetentionError("");
    try {
      const [riskResponse, inactiveResponse] = await Promise.all([
        axios.get(`${API}/customers`, { params: { activity_status: "At Risk", limit: RETENTION_PAGE_SIZE, offset: 0 } }),
        axios.get(`${API}/customers`, { params: { activity_status: "Inactive", limit: RETENTION_PAGE_SIZE, offset: 0 } }),
      ]);
      if (requestId !== retentionRequestId.current) return;
      setAtRiskCustomers(Array.isArray(riskResponse.data?.customers) ? riskResponse.data.customers : []);
      setInactiveCustomers(Array.isArray(inactiveResponse.data?.customers) ? inactiveResponse.data.customers : []);
    } catch (err) {
      if (requestId !== retentionRequestId.current) return;
      setAtRiskCustomers([]);
      setInactiveCustomers([]);
      setRetentionError("Could not load retention lists. Check the backend and retry.");
    } finally {
      if (requestId === retentionRequestId.current) setRetentionLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadRetentionCustomers(); }, [loadRetentionCustomers]);
  useEffect(() => {
    if (selectedSegment) loadSegmentCustomers(selectedSegment, segmentPage);
  }, [selectedSegment, segmentPage, loadSegmentCustomers]);

  const refreshAll = useCallback(async () => {
    setSelectedCustomer(null);
    setSelectedSegmentCustomer(null);
    const jobs = [loadDashboard(), loadCustomers(), loadRetentionCustomers()];
    if (selectedSegment) jobs.push(loadSegmentCustomers(selectedSegment, segmentPage));
    await Promise.allSettled(jobs);
  }, [loadDashboard, loadCustomers, loadRetentionCustomers, loadSegmentCustomers, selectedSegment, segmentPage]);

  const totalCustomers = Number(overview?.total_customers ?? 0);
  const atRisk = Number(overview?.at_risk_customers ?? 0);
  const inactive = Number(overview?.inactive_customers ?? 0);
  const active = Number(overview?.active_customers ?? Math.max(0, totalCustomers - atRisk - inactive));
  const riskRate = totalCustomers ? ((atRisk + inactive) / totalCustomers) * 100 : 0;
  const pageLimit = customerLimit();
  const totalPages = Math.max(1, Math.ceil(customersTotal / pageLimit));
  const segmentTotalPages = Math.max(1, Math.ceil(segmentCustomersTotal / SEGMENT_PAGE_SIZE));
  const revenue = overview?.total_revenue ?? overview?.total_monetary ?? overview?.total_sales ?? 0;
  const totalOrders = overview?.total_orders ?? overview?.total_transactions ?? 0;
  const averageOrderValue = overview?.average_order_value ?? overview?.avg_order_value ?? 0;

  const chartSegments = useMemo(() => segments.map((item) => ({
    name: item.segment,
    value: Number(item.customer_count) || 0,
  })), [segments]);
  const largestSegment = useMemo(() => segments.reduce((largest, item) =>
    Number(item.customer_count) > Number(largest?.customer_count ?? -1) ? item : largest, null), [segments]);
  const segmentedCount = useMemo(() => segments.reduce((sum, item) => sum + (Number(item.customer_count) || 0), 0), [segments]);

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "segments", label: "Customer segments", icon: BarChart3 },
    { id: "retention", label: "Retention analytics", icon: Activity },
    { id: "ai-insights", label: "AI retention insights", icon: Sparkles },
  ];

  const selectSegment = (segment) => {
    setSelectedSegment(segment);
    setSelectedSegmentCustomer(null);
    setSegmentCustomers([]);
    setSegmentCustomersTotal(0);
    setSegmentPage(1);
    setSegmentError("");
    if (segment) loadSegmentCustomers(segment, 1);
  };

  const goToPage = (page) => setCurrentPage(Math.min(totalPages, Math.max(1, page)));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><BarChart3 size={24} /></div>
          <div><div className="brand-name">CustoIQ</div><div className="brand-caption">CUSTOMER INTELLIGENCE</div></div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`nav-item ${activePage === id ? "active" : ""}`} onClick={() => setActivePage(id)} aria-current={activePage === id ? "page" : undefined}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-status"><span className="status-dot" /><div><div className="system-title">API workspace</div><div className="system-subtitle">FastAPI connection</div></div></div>
          <div className="sidebar-footer">CUSTOIQ · CUSTOMER ANALYTICS</div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="breadcrumb">Workspace / {navItems.find((item) => item.id === activePage)?.label}</div>
            <h1>{activePage === "overview" ? "Customer Overview" : activePage === "segments" ? "Customer Segments" : activePage === "retention" ? "Retention Analytics" : "AI Retention Insights"}</h1>
            <p className="page-subtitle">{activePage === "overview" ? "Understand customer value, activity, and behavior." : activePage === "segments" ? "Explore RFM-based customer groups and their characteristics." : activePage === "retention" ? "Identify customers who may need targeted retention efforts." : "Use Gemini to turn aggregated customer analytics into practical retention experiments."}</p>
          </div>
          <button type="button" className="refresh-button" onClick={refreshAll} disabled={loading || tableLoading || retentionLoading}>
            <RefreshCw size={15} className={loading || tableLoading || retentionLoading ? "spin-icon" : ""} /> Refresh data
          </button>
        </header>

        <ErrorBanner message={error} onRetry={refreshAll} disabled={loading} />

        {activePage === "overview" && (
          loading && !overview ? <div className="loading-panel"><Activity size={18} /> Loading dashboard data…</div> : <>
            <section className="stats-grid">
              <StatCard title="Total Customers" value={formatNumber(totalCustomers)} subtitle="Unique customers analyzed" icon={Users} color="purple" />
              <StatCard title="Total Revenue" value={formatCurrency(revenue)} subtitle="Revenue across transactions" icon={CircleDollarSign} color="green" />
              <StatCard title="Total Orders" value={formatNumber(totalOrders)} subtitle="Recorded transactions" icon={BarChart3} color="blue" />
              <StatCard title="Average Order Value" value={formatCurrency(averageOrderValue)} subtitle="Average value per order" icon={Activity} color="orange" />
            </section>

            <section className="analytics-grid">
              <article className="panel">
                <div className="panel-heading"><div><h2>Customer Segmentation</h2><p>Distribution across RFM-based segments.</p></div><span className="panel-tag">RFM</span></div>
                {chartSegments.length ? <>
                  <div className="segment-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartSegments} dataKey="value" nameKey="name" innerRadius={72} outerRadius={104} paddingAngle={3} stroke="none">
                          {chartSegments.map((entry, index) => <Cell key={entry.name} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatNumber(value)} contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, color: "#f5f5f5" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="chart-center"><strong>{formatNumber(segmentedCount)}</strong><span>Customers</span></div>
                  </div>
                  <div className="segment-legend">
                    {chartSegments.map((item, index) => <div className="legend-row" key={item.name}><span className="legend-dot" style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }} /><span className="legend-name">{item.name}</span><span className="legend-value">{formatNumber(item.value)}</span></div>)}
                  </div>
                </> : <div className="empty-state">No segment data available.</div>}
              </article>

              <article className="panel">
                <div className="panel-heading"><div><h2>Retention Health</h2><p>Customer activity status at a glance.</p></div><span className="live-badge"><span className="status-dot" /> DATA</span></div>
                <div className="retention-score"><div><div className="retention-label">At-risk + inactive rate</div><div className="retention-number">{riskRate.toFixed(1)}%</div><span className="retention-caption">Share of customers needing attention</span></div><div className="retention-icon"><Activity size={24} /></div></div>
                <div className="activity-list">
                  {[
                    { label: "Active customers", value: active, dot: "active-dot", fill: "active-fill" },
                    { label: "At-risk customers", value: atRisk, dot: "risk-dot", fill: "risk-fill" },
                    { label: "Inactive customers", value: inactive, dot: "inactive-dot", fill: "inactive-fill" },
                  ].map((item) => <div className="activity-item" key={item.label}><div className="activity-row"><span className="activity-label"><span className={`activity-dot ${item.dot}`} />{item.label}</span><strong>{formatNumber(item.value)}</strong></div><div className="activity-track"><div className={`activity-fill ${item.fill}`} style={{ width: `${totalCustomers ? Math.min(100, (item.value / totalCustomers) * 100) : 0}%` }} /></div></div>)}
                </div>
                <div className="retention-note"><AlertTriangle size={15} /><span>Prioritize high-value at-risk customers when planning retention campaigns.</span></div>
              </article>
            </section>

            <section className="panel customers-panel">
              <div className="panel-heading customer-heading"><div><h2>Customer Explorer</h2><p>Search, filter, and open an individual customer profile.</p></div><span className="results-count">{formatNumber(customersTotal)} customers</span></div>
              <div className="table-controls">
                <label className="search-box"><Search size={16} /><input aria-label="Search customer ID" inputMode="numeric" value={search} placeholder="Search customer ID…" onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); setSelectedCustomer(null); }} /></label>
                <label className="select-box"><select aria-label="Filter by activity status" value={status} onChange={(event) => { setStatus(event.target.value); setCurrentPage(1); setSelectedCustomer(null); }}><option value="All">All statuses</option><option value="Active">Active</option><option value="At Risk">At Risk</option><option value="Inactive">Inactive</option></select><ChevronDown size={14} /></label>
                <label className="select-box page-size-box"><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(event.target.value); setCurrentPage(1); }}><option value="25">25 rows</option><option value="50">50 rows</option><option value="100">100 rows</option><option value={PAGE_SIZE_ALL}>All (up to 10,000)</option></select><ChevronDown size={14} /></label>
              </div>
              {searchError && <p className="field-error" role="alert">{searchError}</p>}
              <ErrorBanner message={tableError} onRetry={loadCustomers} disabled={tableLoading} />
              <div className={`table-scroll ${tableLoading ? "is-loading" : ""}`}>
                <table>
                  <thead><tr><th>Customer ID</th><th>Segment</th><th>Recency</th><th>Frequency</th><th>Monetary</th><th>Status</th></tr></thead>
                  <tbody>
                    {customers.map((customer) => <tr key={customer.customer_id} className="customer-row" tabIndex={0} aria-label={`View customer ${customer.customer_id}`} onClick={() => setSelectedCustomer(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCustomer(customer); } }}>
                      <td className="customer-id">{customer.customer_id}</td><td>{customer.segment ?? "—"}</td><td>{formatNumber(customer.recency)}</td><td>{formatNumber(customer.frequency)}</td><td>{formatCurrency(customer.monetary)}</td><td><span className={`status-pill ${getStatusClass(customer.activity_status)}`}>{customer.activity_status ?? "Unknown"}</span></td>
                    </tr>)}
                    {tableLoading && customers.length === 0 && <tr><td colSpan={6} className="empty-state">Loading customers…</td></tr>}
                    {!tableLoading && !tableError && !searchError && customers.length === 0 && <tr><td colSpan={6} className="empty-state">No matching customers found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="pagination"><span className="pagination-info">Page {currentPage} of {totalPages}</span><div className="pagination-controls"><button className="pagination-button" type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || tableLoading}>Previous</button><button className="pagination-button" type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages || tableLoading}>Next</button></div></div>
              <div className="table-footer">Showing {customers.length ? formatNumber((currentPage - 1) * pageLimit + 1) : "0"}–{formatNumber((currentPage - 1) * pageLimit + customers.length)} of {formatNumber(customersTotal)} customers</div>
              <CustomerDetails customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
            </section>
          </>
        )}

        {activePage === "segments" && (
          <div className="segments-page">
            <section className="stats-grid segment-stats-grid">
              <StatCard title="Total Segments" value={formatNumber(segments.length)} subtitle="Distinct customer groups" icon={BarChart3} color="purple" />
              <StatCard title="Customers Segmented" value={formatNumber(segmentedCount)} subtitle="Customers represented in segments" icon={Users} color="green" />
              <StatCard title="Largest Segment" value={largestSegment?.segment ?? "—"} subtitle={largestSegment ? `${formatNumber(largestSegment.customer_count)} customers` : "No segment data"} icon={UserRoundCheck} color="blue" />
              <StatCard title="Average Segment Size" value={formatNumber(segments.length ? segmentedCount / segments.length : 0)} subtitle="Customers per segment" icon={Activity} color="orange" />
            </section>
            <section className="analytics-grid segments-analytics-grid">
              <article className="panel segment-distribution-panel">
                <div className="panel-heading"><div><h2>Segment Distribution</h2><p>Select a segment to explore its customers.</p></div><span className="panel-tag">SELECTABLE</span></div>
                <div className="segment-bars">
                  {segments.map((segment, index) => {
                    const count = Number(segment.customer_count) || 0;
                    const width = segmentedCount ? (count / segmentedCount) * 100 : 0;
                    const selected = selectedSegment === segment.segment;
                    return <button type="button" key={segment.segment} className={`segment-bar-item ${selected ? "selected" : ""}`} onClick={() => selectSegment(segment.segment)} aria-pressed={selected}>
                      <span className="segment-bar-heading"><span>{segment.segment}</span><span>{formatNumber(count)} · {width.toFixed(1)}%</span></span>
                      <span className="segment-bar-track"><span className="segment-bar-fill" style={{ width: `${width}%`, background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }} /></span>
                    </button>;
                  })}
                  {!segments.length && <div className="empty-state">No segments available.</div>}
                </div>
              </article>
              <article className="panel segment-comparison-panel">
                <div className="panel-heading"><div><h2>RFM Comparison</h2><p>Average recency, frequency, and monetary value by segment.</p></div></div>
                <div className="table-scroll"><table><thead><tr><th>Segment</th><th>Avg. Recency</th><th>Avg. Frequency</th><th>Avg. Monetary</th></tr></thead><tbody>
                  {segments.map((segment) => <tr key={segment.segment}><td>{segment.segment}</td><td>{formatNumber(segment.avg_recency)}</td><td>{formatNumber(segment.avg_frequency)}</td><td>{formatCurrency(segment.avg_monetary)}</td></tr>)}
                  {!segments.length && <tr><td colSpan={4} className="empty-state">No segment metrics available.</td></tr>}
                </tbody></table></div>
              </article>
            </section>
            <section className="panel segment-customers-panel">
              <div className="panel-heading"><div><h2>{selectedSegment ? `${selectedSegment} Customers` : "Segment Customer Explorer"}</h2><p>{selectedSegment ? `${formatNumber(segmentCustomersTotal)} customers in this segment` : "Choose a segment above to inspect its customer records."}</p></div>{selectedSegment && <button type="button" className="secondary-button" onClick={() => { ++segmentRequestId.current; setSelectedSegment(null); setSelectedSegmentCustomer(null); setSegmentCustomers([]); setSegmentCustomersTotal(0); setSegmentPage(1); setSegmentError(""); setSegmentLoading(false); }}>Clear selection</button>}</div>
              {segmentError && <ErrorBanner message={segmentError} onRetry={() => loadSegmentCustomers(selectedSegment, segmentPage)} disabled={segmentLoading} />}
              <div className={`table-scroll ${segmentLoading ? "is-loading" : ""}`}><table><thead><tr><th>Customer ID</th><th>Recency</th><th>Frequency</th><th>Monetary</th><th>Status</th></tr></thead><tbody>
                {segmentCustomers.map((customer) => <tr key={customer.customer_id} className="customer-row" tabIndex={0} aria-label={`View customer ${customer.customer_id}`} onClick={() => setSelectedSegmentCustomer(customer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSegmentCustomer(customer); } }}><td className="customer-id">{customer.customer_id}</td><td>{formatNumber(customer.recency)}</td><td>{formatNumber(customer.frequency)}</td><td>{formatCurrency(customer.monetary)}</td><td><span className={`status-pill ${getStatusClass(customer.activity_status)}`}>{customer.activity_status ?? "Unknown"}</span></td></tr>)}
                {segmentLoading && segmentCustomers.length === 0 && <tr><td colSpan={5} className="empty-state">Loading customers…</td></tr>}
                {!segmentLoading && !segmentError && selectedSegment && segmentCustomers.length === 0 && <tr><td colSpan={5} className="empty-state">No customers found in this segment.</td></tr>}
                {!selectedSegment && <tr><td colSpan={5} className="empty-state">Select a segment to load customers.</td></tr>}
              </tbody></table></div>
              {selectedSegment && <div className="pagination"><span className="pagination-info">Page {segmentPage} of {segmentTotalPages}</span><div className="pagination-controls"><button type="button" className="pagination-button" onClick={() => setSegmentPage((page) => Math.max(1, page - 1))} disabled={segmentPage <= 1 || segmentLoading}>Previous</button><button type="button" className="pagination-button" onClick={() => setSegmentPage((page) => Math.min(segmentTotalPages, page + 1))} disabled={segmentPage >= segmentTotalPages || segmentLoading}>Next</button></div></div>}
              <CustomerDetails customer={selectedSegmentCustomer} onClose={() => setSelectedSegmentCustomer(null)} />
            </section>
          </div>
        )}

        {activePage === "retention" && (
          <div className="retention-page">
            <section className="stats-grid">
              <StatCard title="Total Customers" value={formatNumber(totalCustomers)} subtitle="Unique customers analyzed" icon={Users} color="purple" />
              <StatCard title="Active Customers" value={formatNumber(active)} subtitle="Currently active" icon={UserRoundCheck} color="green" />
              <StatCard title="At-Risk Customers" value={formatNumber(atRisk)} subtitle="Potential retention opportunities" icon={AlertTriangle} color="orange" />
              <StatCard title="Inactive Customers" value={formatNumber(inactive)} subtitle="Require re-engagement" icon={UserRoundX} color="blue" />
            </section>
            <section className="panel retention-summary-panel">
              <div className="panel-heading"><div><h2>Retention Health</h2><p>A snapshot of customer activity based on the current RFM classification.</p></div><span className="panel-tag">OVERVIEW</span></div>
              <div className="retention-score"><div><div className="retention-label">At-risk + inactive rate</div><div className="retention-number">{riskRate.toFixed(1)}%</div><span className="retention-caption">Share of all customers classified as at risk or inactive</span></div><div className="retention-icon"><Activity size={24} /></div></div>
              <div className="retention-note"><AlertTriangle size={16} /><span>Prioritize high-value customers within the at-risk group for personalized retention campaigns. These metrics describe the current dataset and do not guarantee campaign outcomes.</span></div>
            </section>
            <ErrorBanner message={retentionError} onRetry={loadRetentionCustomers} disabled={retentionLoading} />
            <div className="retention-lists">
              <RetentionCustomerTable title="At-Risk Customers" description="First 10 customers currently classified as at risk" customers={atRiskCustomers} loading={retentionLoading} />
              <RetentionCustomerTable title="Inactive Customers" description="First 10 customers currently classified as inactive" customers={inactiveCustomers} loading={retentionLoading} />
            </div>
            <div className="retention-refresh-row"><span>Showing up to 10 customers per category.</span><button type="button" className="secondary-button" onClick={loadRetentionCustomers} disabled={retentionLoading}><RefreshCw size={14} />{retentionLoading ? "Refreshing…" : "Refresh retention lists"}</button></div>
          </div>
        )}


        {activePage === "ai-insights" && <AiInsightsPage overview={overview} segments={segments} />}

        <footer className="page-footer"><span>Customer Intelligence &amp; Retention Platform</span><span><span className="status-dot" /> Connected to FastAPI · {API}</span></footer>
      </main>
    </div>
  );
}
