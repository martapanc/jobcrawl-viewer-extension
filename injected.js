// This script runs in the PAGE context (not the extension context)
// so it can intercept fetch() and XMLHttpRequest responses.

(function () {
  "use strict";

  // We don't filter by URL – we filter by response shape.
  // This way it works regardless of where the API lives.

  function isJobCrawlPayload(data) {
    return (
      data &&
      typeof data === "object" &&
      Array.isArray(data.jobs) &&
      data.jobs.length > 0 &&
      typeof data.totalCount === "number" &&
      data.jobs[0].apply_url !== undefined
    );
  }

  // Remotive: { result: { results: [{ hits: [...], nbHits, page, nbPages }] } }
  function isRemotivePayload(data) {
    try {
      const r = data.result.results[0];
      return Array.isArray(r.hits) && r.hits.length > 0 && typeof r.nbHits === "number";
    } catch {
      return false;
    }
  }

  function parseSalary(str) {
    if (!str) return {};
    const cur = str.match(/^([a-z]+)/i);
    const nums = str.replace(/,/g, "").match(/\d+/g);
    if (!nums) return {};
    return {
      salary_currency: cur ? cur[1].toUpperCase() : "USD",
      salary_min: parseInt(nums[0], 10) || null,
      salary_max: nums[1] ? parseInt(nums[1], 10) : null,
    };
  }

  function normalizeRemotive(data) {
    const r = data.result.results[0];
    const jobs = r.hits.map((h) => ({
      title: h.title,
      company: h.company_name,
      apply_url: h.url || h.remotive_com_url,
      is_remote: true,
      countries: h.locations || [],
      posted_at: h.discovered_on,
      ...parseSalary(h.salary),
    }));
    return {
      jobs,
      totalCount: r.nbHits,
      currentPage: (r.page ?? 0) + 1,
      totalPages: r.nbPages,
    };
  }

  function tryForward(text) {
    try {
      const data = JSON.parse(text);
      let payload = null;
      if (isJobCrawlPayload(data)) {
        payload = { ...data, source: "jobcrawl" };
        console.log("[JobCrawl Viewer] Intercepted JobCrawl payload:", payload.jobs.length, "jobs");
      } else if (isRemotivePayload(data)) {
        payload = { ...normalizeRemotive(data), source: "remotive" };
        console.log("[JobCrawl Viewer] Intercepted Remotive payload:", payload.jobs.length, "jobs");
      }
      if (payload) {
        window.postMessage({ type: "JOBCRAWL_DATA", payload }, "*");
      }
    } catch {
      // not JSON, ignore
    }
  }

  // ── Intercept fetch ──
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    // Clone so the original consumer can still read the body
    try {
      const clone = response.clone();
      clone.text().then((text) => tryForward(text)).catch(() => {});
    } catch {
      // some responses can't be cloned, that's fine
    }

    return response;
  };

  // ── Intercept XMLHttpRequest ──
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._jcvUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        tryForward(this.responseText);
      } catch {
        // ignore
      }
    });
    return origSend.apply(this, args);
  };

  console.log("[JobCrawl Viewer] Network interceptor active");
})();
