// ── Inject the network interceptor into the page context (ASAP) ──
const script = document.createElement("script");
script.src = chrome.runtime.getURL("injected.js");
(document.documentElement || document.head).prepend(script);
script.onload = () => script.remove();

// ── Listen for intercepted data from the page context ──
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "JOBCRAWL_DATA") return;

  const payload = event.data.payload;
  if (!payload?.jobs?.length) return;

  renderPanel(payload);
});

const PANEL_WIDTH = 340;

// ── Panel rendering ──
function renderPanel(data) {
  // Remove existing panel if any
  document.getElementById("jcv-panel")?.remove();

  // Push page content to the left
  document.documentElement.style.marginRight = `${PANEL_WIDTH}px`;
  document.documentElement.style.transition = "margin-right 0.25s ease";

  const SOURCE_META = {
    remotive: { label: "🌍 Remotive Viewer" },
    jobcrawl: { label: "⚡ JobCrawl Viewer" },
  };
  const { label } = SOURCE_META[data.source] || SOURCE_META.jobcrawl;

  const panel = document.createElement("div");
  panel.id = "jcv-panel";
  panel.dataset.source = data.source || "jobcrawl";

  const header = document.createElement("div");
  header.className = "jcv-header";
  header.innerHTML = `
    <div class="jcv-header-top">
      <span class="jcv-logo">${label}</span>
      <button id="jcv-close" title="Close panel">✕</button>
    </div>
    <span class="jcv-count">${data.jobs.length} of ${data.totalCount} jobs – p.${data.currentPage}/${data.totalPages}</span>
  `;
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "jcv-body";

  for (const job of data.jobs) {
    const card = document.createElement("a");
    card.className = "jcv-card";
    card.href = job.apply_url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const salary = formatSalary(job);
    const posted = timeAgo(job.posted_at);
    const countries = (job.countries || []).join(", ");

    card.innerHTML = `
      <div class="jcv-card-top">
        <span class="jcv-title">${esc(job.title)}</span>
        <span class="jcv-company">${esc(job.company)}</span>
      </div>
      <div class="jcv-card-meta">
        ${job.is_remote ? '<span class="jcv-tag jcv-tag-remote">Remote</span>' : ""}
        ${salary ? `<span class="jcv-tag jcv-tag-salary">${salary}</span>` : ""}
        ${countries ? `<span class="jcv-tag">${esc(countries)}</span>` : ""}
        <span class="jcv-posted">${posted}</span>
      </div>
    `;
    body.appendChild(card);
  }

  panel.appendChild(body);
  document.body.appendChild(panel);

  // ── Scroll sync: page scroll ↔ panel scroll ──
  let syncing = false;

  function syncPanelToPage() {
    if (syncing) return;
    syncing = true;
    const pageRatio = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
    body.scrollTop = pageRatio * (body.scrollHeight - body.clientHeight);
    syncing = false;
  }

  function syncPageToPanel() {
    if (syncing) return;
    syncing = true;
    const panelRatio = body.scrollTop / (body.scrollHeight - body.clientHeight || 1);
    window.scrollTo(0, panelRatio * (document.documentElement.scrollHeight - window.innerHeight));
    syncing = false;
  }

  window.addEventListener("scroll", syncPanelToPage, { passive: true });
  body.addEventListener("scroll", syncPageToPanel, { passive: true });

  // ── Close ──
  document.getElementById("jcv-close").addEventListener("click", () => {
    window.removeEventListener("scroll", syncPanelToPage);
    body.removeEventListener("scroll", syncPageToPanel);
    panel.remove();
    document.documentElement.style.marginRight = "0";
  });
}

// ── Helpers ──
function formatSalary(job) {
  if (!job.salary_min && !job.salary_max) return null;
  const fmt = (n) => {
    if (n >= 1000) return `${Math.round(n / 1000)}k`;
    return String(n);
  };
  const cur = job.salary_currency || "USD";
  if (job.salary_min && job.salary_max) {
    return `${fmt(job.salary_min)}–${fmt(job.salary_max)} ${cur}`;
  }
  if (job.salary_min) return `${fmt(job.salary_min)}+ ${cur}`;
  return `up to ${fmt(job.salary_max)} ${cur}`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function esc(str) {
  if (!str) return "";
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}
