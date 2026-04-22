// This script runs in the PAGE context (not the extension context)
// so it can intercept fetch() and XMLHttpRequest responses.

(function () {
  "use strict";

  // We don't filter by URL – we filter by response shape.
  // This way it works regardless of whether the API lives on
  // jobcrawl.org, supabase.co, or anywhere else.

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

  function tryForward(text) {
    try {
      const data = JSON.parse(text);
      if (isJobCrawlPayload(data)) {
        console.log("[JobCrawl Viewer] Intercepted jobs payload:", data.jobs.length, "jobs");
        window.postMessage({ type: "JOBCRAWL_DATA", payload: data }, "*");
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
