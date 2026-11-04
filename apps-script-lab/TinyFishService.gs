/**
 * CSK Business OS — TinyFish server-side integration.
 *
 * LAB ONLY. The TinyFish API key is read from Apps Script Script Properties:
 *   TINYFISH_API_KEY
 * It is never returned to the browser, logged, or written to Google Sheets.
 *
 * Public research only:
 * - Search: ranked public web results.
 * - Fetch: extracts public page content.
 * - Agent: async, read-only public browsing. No logins, form submissions,
 *   messages, purchases, account changes, or downloads are permitted.
 *
 * Do not copy this file into production until the production auth migration
 * and a separate TinyFish key have been reviewed.
 */

var CSK_TINYFISH_ENDPOINTS_ = {
  search: "https://api.search.tinyfish.ai",
  fetch: "https://api.fetch.tinyfish.ai",
  agent: "https://agent.tinyfish.ai"
};

function cskLabTinyFishRequest(request) {
  try {
    cskLabRequireDummySheet_();
    cskLabEnsurePrivateToken_();
    cskLabGuardRead_();

    if (!request || typeof request !== "object" || Array.isArray(request)) {
      throw cskTinyFishError_("INVALID_REQUEST", "Permintaan TinyFish tidak valid.");
    }
    var action = String(request.action || "").toLowerCase();
    if (["status", "configure", "test", "search", "fetch", "agent_start", "agent_status"].indexOf(action) === -1) {
      throw cskTinyFishError_("ACTION_NOT_ALLOWED", "Aksi TinyFish tidak diizinkan.");
    }

    if (action === "status") return cskTinyFishStatus_();
    if (action === "configure") return cskTinyFishConfigure_(request);
    if (action === "test") return cskTinyFishTestConnection_();
    if (action === "search") return cskTinyFishSearch_(request);
    if (action === "fetch") return cskTinyFishFetch_(request);
    if (action === "agent_start") return cskTinyFishAgentStart_(request);
    if (action === "agent_status") return cskTinyFishAgentStatus_(request);
    throw cskTinyFishError_("ACTION_NOT_ALLOWED", "Aksi TinyFish tidak diizinkan.");
  } catch (err) {
    return {
      status: "error",
      code: err && err.cskCode ? err.cskCode : "TINYFISH_REQUEST_FAILED",
      message: String(err && err.message ? err.message : err)
    };
  }
}

function cskTinyFishError_(code, message) {
  var err = new Error(message);
  err.cskCode = code;
  return err;
}

function cskTinyFishStatus_() {
  var key = PropertiesService.getScriptProperties().getProperty("TINYFISH_API_KEY") || "";
  return {
    status: "success",
    configured: key.trim().length >= 20,
    provider: "TinyFish",
    capabilities: ["search", "fetch", "read_only_agent"],
    keyExposure: "server_only",
    dataBoundary: "public_web_research_only"
  };
}

function cskTinyFishConfigure_(request) {
  var key = String(request.apiKey || "").trim();
  if (key.length < 20 || key.length > 512 || /[\\r\\n\\t ]/.test(key)) {
    throw cskTinyFishError_("INVALID_API_KEY", "API key tidak valid. Periksa kembali key dari dashboard TinyFish.");
  }
  // The key arrives only over the owner-only google.script.run channel.
  // Never log it, return it, or persist it in the browser or a Sheet.
  PropertiesService.getScriptProperties().setProperty("TINYFISH_API_KEY", key);
  return {
    status: "success",
    action: "configure",
    configured: true,
    keyStoredServerSide: true,
    message: "API key tersimpan di Script Properties server. Nilai key tidak dikembalikan."
  };
}

function cskTinyFishTestConnection_() {
  cskTinyFishRateLimit_("TINYFISH_LAST_TEST_MS", 1500);
  var url = CSK_TINYFISH_ENDPOINTS_.search +
    "?query=" + encodeURIComponent("CSK TinyFish connection test") +
    "&location=ID&language=id";
  var data = cskTinyFishHttp_(url, "get");
  return {
    status: "success",
    action: "test",
    configured: true,
    connectionOk: true,
    resultCount: Array.isArray(data.results) ? data.results.length : 0,
    message: "Koneksi TinyFish berhasil diverifikasi melalui Search API."
  };
}

function cskTinyFishRequireKey_() {
  var key = String(PropertiesService.getScriptProperties().getProperty("TINYFISH_API_KEY") || "").trim();
  if (key.length < 20) {
    throw cskTinyFishError_(
      "TINYFISH_NOT_CONFIGURED",
      "TinyFish belum dikonfigurasi. Tambahkan TINYFISH_API_KEY pada Apps Script > Project Settings > Script Properties."
    );
  }
  return key;
}

function cskTinyFishRateLimit_(propertyName, minimumIntervalMs) {
  var lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    throw cskTinyFishError_("TINYFISH_BUSY", "Permintaan TinyFish lain sedang diproses. Coba lagi sebentar.");
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var now = Date.now();
    var previous = Number(props.getProperty(propertyName) || 0);
    if (previous && now - previous < minimumIntervalMs) {
      throw cskTinyFishError_("TINYFISH_RATE_LIMIT", "Terlalu cepat. Tunggu sebentar sebelum mengirim permintaan berikutnya.");
    }
    props.setProperty(propertyName, String(now));
  } finally {
    lock.releaseLock();
  }
}

function cskTinyFishSafePublicUrl_(value) {
  var url = String(value || "").trim();
  if (!url || url.length > 2048 || /[\s\\]/.test(url)) {
    throw cskTinyFishError_("INVALID_URL", "URL kosong, terlalu panjang, atau mengandung karakter yang tidak diizinkan.");
  }
  var match = /^https?:\/\/([a-z0-9.-]+)(?:[/?#]|$)/i.exec(url);
  if (!match || /@/.test(url.split("/").slice(0, 3).join("/"))) {
    throw cskTinyFishError_("INVALID_URL", "Gunakan URL publik berawalan http:// atau https:// tanpa kredensial.");
  }
  var host = match[1].toLowerCase();
  if (host.indexOf(".") === -1 || host.indexOf("..") !== -1 ||
      host.charAt(0) === "." || host.charAt(host.length - 1) === "." ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) ||
      /^(localhost|metadata\.google\.internal)(\.|$)/.test(host) ||
      /\.(local|internal|localhost|test|invalid|example)$/.test(host)) {
    throw cskTinyFishError_("URL_NOT_PUBLIC", "URL lokal, alamat IP, atau domain khusus tidak diizinkan. Gunakan situs publik.");
  }
  return url;
}

function cskTinyFishHttp_(url, method, payload) {
  var key = cskTinyFishRequireKey_();
  var options = {
    method: method,
    headers: { "X-API-Key": key },
    muteHttpExceptions: true,
    followRedirects: true
  };
  if (payload) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  var body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (_) {
    body = { message: "Respons TinyFish bukan JSON yang valid." };
  }
  if (code < 200 || code >= 300) {
    var providerCode = body && body.error && body.error.code ? String(body.error.code) : "";
    var detail = providerCode ? " (" + providerCode + ")" : "";
    if (code === 401) detail = " (API key tidak valid atau belum aktif)";
    if (code === 402 || code === 403) detail = " (akses atau kredit akun perlu diperiksa)";
    if (code === 429) detail = " (batas permintaan tercapai)";
    throw cskTinyFishError_("TINYFISH_HTTP_" + code, "TinyFish mengembalikan HTTP " + code + detail + ".");
  }
  return body;
}

function cskTinyFishSearch_(request) {
  var query = String(request.query || "").trim();
  if (!query || query.length > 300) {
    throw cskTinyFishError_("INVALID_QUERY", "Kata kunci pencarian wajib diisi dan maksimal 300 karakter.");
  }
  var domainType = String(request.domainType || "web").toLowerCase();
  if (["web", "news"].indexOf(domainType) === -1) {
    throw cskTinyFishError_("INVALID_DOMAIN_TYPE", "Jenis pencarian hanya web atau news.");
  }
  cskTinyFishRateLimit_("TINYFISH_LAST_SEARCH_MS", 1500);
  var url = CSK_TINYFISH_ENDPOINTS_.search +
    "?query=" + encodeURIComponent(query) +
    "&location=ID&language=id&domain_type=" + encodeURIComponent(domainType);
  var data = cskTinyFishHttp_(url, "get");
  var results = Array.isArray(data.results) ? data.results.slice(0, 10) : [];
  return {
    status: "success",
    action: "search",
    query: query,
    totalResults: Number(data.total_results || results.length),
    results: results.map(function (item) {
      var safeUrl = "";
      try { safeUrl = cskTinyFishSafePublicUrl_(item.url); } catch (_) {}
      return {
        position: Number(item.position || 0),
        siteName: String(item.site_name || ""),
        title: String(item.title || "").slice(0, 300),
        snippet: String(item.snippet || "").slice(0, 1200),
        url: safeUrl
      };
    }).filter(function (item) { return !!item.url; })
  };
}

function cskTinyFishFetch_(request) {
  var url = cskTinyFishSafePublicUrl_(request.url);
  cskTinyFishRateLimit_("TINYFISH_LAST_FETCH_MS", 1500);
  var data = cskTinyFishHttp_(CSK_TINYFISH_ENDPOINTS_.fetch, "post", {
    urls: [url],
    format: "markdown",
    links: true,
    image_links: false,
    ttl: 0,
    per_url_timeout_ms: 45000,
    purpose: "Riset bisnis publik untuk Cahaya Selatan Kreasindo; ekstrak informasi faktual dan sumber."
  });
  var item = data.results && data.results[0] ? data.results[0] : null;
  if (!item) {
    var issue = data.errors && data.errors[0] ? String(data.errors[0].error || "Halaman tidak dapat diambil.") : "Halaman tidak menghasilkan konten.";
    throw cskTinyFishError_("TINYFISH_FETCH_EMPTY", issue.slice(0, 300));
  }
  return {
    status: "success",
    action: "fetch",
    url: String(item.final_url || item.url || url),
    title: String(item.title || "").slice(0, 300),
    description: String(item.description || "").slice(0, 500),
    text: String(item.text || "").slice(0, 16000),
    links: Array.isArray(item.links) ? item.links.slice(0, 30) : []
  };
}

function cskTinyFishValidateReadOnlyGoal_(goal) {
  var value = String(goal || "").trim();
  if (!value || value.length > 1500) {
    throw cskTinyFishError_("INVALID_GOAL", "Instruksi wajib diisi dan maksimal 1.500 karakter.");
  }
  var forbidden = /\b(login|log\s*in|sign\s*in|password|credential|checkout|purchase|buy|pay|payment|submit|send|message|delete|remove|edit|update|book|reserve|booking|register|upload|download|transfer|place\s+order|beli|bayar|pembayaran|kirim|hapus|ubah|sunting|pesan|pemesanan|transaksi|transfer|masuk\s+akun|buat\s+akun|unggah|unduh)\b/i;
  if (forbidden.test(value)) {
    throw cskTinyFishError_(
      "READ_ONLY_GOAL_REQUIRED",
      "Agent hanya boleh melakukan riset publik yang bersifat baca-saja. Instruksi login, transaksi, pengiriman, pengubahan, atau penghapusan diblokir."
    );
  }
  return value + "\n\nBATASAN WAJIB: lakukan riset baca-saja pada halaman publik. Jangan login, jangan meminta atau memasukkan kredensial, jangan mengirim atau mengisi formulir, jangan mengirim pesan/email, jangan membeli atau membayar, jangan membuat/mengubah/menghapus akun atau data, dan jangan mengunduh file. Jangan mengirimkan data pribadi. Berhenti jika situs meminta login atau tindakan yang mengubah data. Kembalikan ringkasan faktual, URL sumber, dan ketidakpastian.";
}

function cskTinyFishAgentStart_(request) {
  var url = cskTinyFishSafePublicUrl_(request.url);
  var goal = cskTinyFishValidateReadOnlyGoal_(request.goal);
  cskTinyFishRateLimit_("TINYFISH_LAST_AGENT_MS", 30000);
  var data = cskTinyFishHttp_(CSK_TINYFISH_ENDPOINTS_.agent + "/v1/automation/run-async", "post", {
    url: url,
    goal: goal,
    browser_profile: "lite",
    agent_config: { max_duration_seconds: 120 }
  });
  if (!data.run_id) {
    throw cskTinyFishError_("TINYFISH_RUN_ID_MISSING", "TinyFish tidak mengembalikan ID pekerjaan.");
  }
  return {
    status: "success",
    action: "agent_start",
    runId: String(data.run_id),
    message: "Riset dimulai. Periksa status untuk mengambil hasil."
  };
}

function cskTinyFishAgentStatus_(request) {
  var runId = String(request.runId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(runId)) {
    throw cskTinyFishError_("INVALID_RUN_ID", "ID pekerjaan TinyFish tidak valid.");
  }
  var data = cskTinyFishHttp_(CSK_TINYFISH_ENDPOINTS_.agent + "/v1/runs/" + encodeURIComponent(runId), "get");
  var result = data.result;
  if (result !== null && result !== undefined) {
    var serialized = JSON.stringify(result);
    if (serialized.length > 16000) result = serialized.slice(0, 16000) + "…";
  }
  var steps = Array.isArray(data.steps) ? data.steps.slice(-8).map(function (step) {
    return {
      purpose: String(step.purpose || step.action || step.type || "").slice(0, 300),
      status: String(step.status || "")
    };
  }) : [];
  return {
    status: "success",
    action: "agent_status",
    runId: String(data.run_id || runId),
    runStatus: String(data.status || "UNKNOWN"),
    result: result === undefined ? null : result,
    error: data.error ? {
      code: String(data.error.code || ""),
      message: String(data.error.message || "").slice(0, 500)
    } : null,
    steps: steps
  };
}
