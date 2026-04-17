const state = {
  dashboard: null,
  records: [],
  students: [],
  share: null,
  filters: {
    search: "",
    type: ""
  }
};

const elements = {
  heroStats: document.querySelector("#hero-stats"),
  statsGrid: document.querySelector("#stats-grid"),
  credentialForm: document.querySelector("#credential-form"),
  verifyForm: document.querySelector("#verify-form"),
  verifyInput: document.querySelector("#verify-input"),
  verifyResult: document.querySelector("#verify-result"),
  registryList: document.querySelector("#registry-list"),
  studentsList: document.querySelector("#students-list"),
  ledgerList: document.querySelector("#ledger-list"),
  searchInput: document.querySelector("#search-input"),
  typeFilter: document.querySelector("#type-filter"),
  toast: document.querySelector("#toast"),
  shareSpotlight: document.querySelector("#shareSpotlight")
};

function formatDate(value) {
  if (!value) {
    return "Noma'lum";
  }

  return new Intl.DateTimeFormat("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function typeLabel(value) {
  return (
    {
      Diploma: "Diploma",
      Certificate: "Certificate",
      CourseResult: "Course Result"
    }[value] || value
  );
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "So'rov bajarilmadi");
  }

  return data;
}

function renderHeroStats() {
  const stats = state.dashboard?.stats;
  if (!stats) {
    return;
  }

  elements.heroStats.innerHTML = [
    { label: "Credentials", value: stats.totalCredentials },
    { label: "Students", value: stats.studentCount },
    { label: "Diplomas", value: stats.diplomas },
    { label: "Institutions", value: stats.institutions }
  ]
    .map(
      (item) => `
        <div class="hero-stat">
          <strong>${item.value}</strong>
          <span>${item.label}</span>
        </div>
      `
    )
    .join("");
}

function renderStats() {
  const stats = state.dashboard?.stats;
  if (!stats) {
    return;
  }

  const cards = [
    ["Yaratilgan credential", stats.totalCredentials],
    ["Faol credential", stats.activeCredentials],
    ["Diploma", stats.diplomas],
    ["Certificate", stats.certificates],
    ["Course result", stats.courseResults],
    ["Talabalar", stats.studentCount],
    ["Institutions", stats.institutions]
  ];

  elements.statsGrid.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="card stat-card">
          <strong>${value}</strong>
          <span>${label}</span>
        </article>
      `
    )
    .join("");
}

function renderVerifyResult(payload, isSuccess) {
  if (!payload) {
    elements.verifyResult.className = "verify-result empty-state";
    elements.verifyResult.textContent = "`recordId` kiriting va credential hash/ledger holatini tekshiring.";
    return;
  }

  const resultClass = isSuccess ? "success" : "fail";
  const { record, block, valid, proofStatus } = payload;
  elements.verifyResult.className = `verify-result ${resultClass}`;
  elements.verifyResult.innerHTML = `
    <div class="registry-top">
      <div>
        <p class="eyebrow">${valid ? "Verified" : "Verification failed"}</p>
        <h4>${record.title}</h4>
      </div>
      <span class="badge ${valid ? "" : "alt"}">${valid ? "Active ledger match" : "Mismatch / topilmadi"}</span>
    </div>
    <div class="meta-grid">
      <div><strong>Talaba</strong><p>${record.studentName}</p></div>
      <div><strong>Turi</strong><p>${typeLabel(record.type)}</p></div>
      <div><strong>Hash</strong><p class="mono">${record.credentialHash.slice(0, 18)}...</p></div>
      <div><strong>Block</strong><p>${block ? `#${block.index}` : "Yo'q"}</p></div>
    </div>
    <p>Proof status: <span class="mono">${proofStatus}</span></p>
  `;
}

function renderRegistry() {
  if (!state.records.length) {
    elements.registryList.innerHTML = '<div class="empty-state">Hozircha credential topilmadi.</div>';
    return;
  }

  elements.registryList.innerHTML = state.records
    .map(
      (record) => `
        <article class="registry-item">
          <div class="registry-top">
            <div>
              <p class="eyebrow">${record.institutionName}</p>
              <h4>${record.title}</h4>
            </div>
            <div class="registry-meta">
              <span class="badge">${typeLabel(record.type)}</span>
              <span class="badge alt">${record.status}</span>
            </div>
          </div>
          <p>${record.description || "Credential tavsifi kiritilmagan."}</p>
          <div class="meta-grid">
            <div><strong>Talaba</strong><p>${record.studentName}</p></div>
            <div><strong>Record ID</strong><p class="mono">${record.recordId}</p></div>
            <div><strong>Issued</strong><p>${formatDate(record.issuedAt)}</p></div>
            <div><strong>Share count</strong><p>${record.shareCount}</p></div>
          </div>
          <div class="item-actions">
            <button class="button secondary" data-action="verify" data-record="${record.recordId}">Verify</button>
            <button class="button primary" data-action="share" data-record="${record.recordId}">Share link yaratish</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderStudents() {
  if (!state.students.length) {
    elements.studentsList.innerHTML = '<div class="empty-state">Talabalar ro&apos;yxati bo&apos;sh.</div>';
    return;
  }

  elements.studentsList.innerHTML = state.students
    .map(
      ({ student, summary }) => `
        <article class="student-item">
          <div class="student-top">
            <div>
              <p class="eyebrow">${student.university}</p>
              <h4>${student.fullName}</h4>
            </div>
            <span class="badge">${summary.credentialCount} credential</span>
          </div>
          <p>${student.department} · ${student.email}</p>
          <div class="meta-grid">
            <div><strong>Diploma</strong><p>${summary.diplomaCount}</p></div>
            <div><strong>Certificate</strong><p>${summary.certificateCount}</p></div>
            <div><strong>Course result</strong><p>${summary.courseResultCount}</p></div>
            <div><strong>Share</strong><p>${summary.shareCount}</p></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderLedger() {
  const items = state.dashboard?.ledger || [];
  if (!items.length) {
    elements.ledgerList.innerHTML = '<div class="empty-state">Ledger bo&apos;sh.</div>';
    return;
  }

  elements.ledgerList.innerHTML = items
    .map(
      (block) => `
        <article class="ledger-item">
          <div class="ledger-top">
            <strong>Block #${block.index}</strong>
            <span class="badge alt">${formatDate(block.issuedAt)}</span>
          </div>
          <p><span class="mono">${block.recordId}</span> credential hash bilan biriktirilgan.</p>
          <p class="mono">${block.blockHash.slice(0, 24)}...</p>
        </article>
      `
    )
    .join("");
}

function renderShareSpotlight() {
  const data = state.share;
  if (!data) {
    elements.shareSpotlight.classList.add("hidden");
    elements.shareSpotlight.innerHTML = "";
    return;
  }

  const { share, record, student } = data;
  elements.shareSpotlight.classList.remove("hidden");
  elements.shareSpotlight.innerHTML = `
    <div class="share-layout">
      <div>
        <p class="eyebrow">Public share access</p>
        <h3>${record?.title || "Credential topilmadi"}</h3>
        <p>
          ${student?.fullName || "Talaba"} ma'lumoti <strong>${share.recipientName}</strong> uchun ochilgan.
          Bu havola orqali credential va ledger izini tekshirish mumkin.
        </p>
        <div class="pill-row">
          <span class="pill">${typeLabel(record?.type || "")}</span>
          <span class="pill">${record?.institutionName || "Institution"}</span>
          <span class="pill">${formatDate(share.createdAt)}</span>
        </div>
      </div>
      <div class="share-summary">
        <div class="share-top">
          <strong>Share token</strong>
          <span class="badge">${share.recipientType}</span>
        </div>
        <p class="mono">${share.shareToken}</p>
        <p>${share.note || "Maxsus izoh kiritilmagan."}</p>
        <p><strong>Talaba:</strong> ${student?.fullName || "Noma'lum"}</p>
        <p><strong>Wallet:</strong> <span class="mono">${student?.walletAddress || "-"}</span></p>
      </div>
    </div>
  `;
}

async function loadDashboard() {
  state.dashboard = await request("/api/dashboard");
  renderHeroStats();
  renderStats();
  renderLedger();
}

async function loadRecords() {
  const params = new URLSearchParams();
  if (state.filters.search) {
    params.set("search", state.filters.search);
  }
  if (state.filters.type) {
    params.set("type", state.filters.type);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await request(`/api/records${suffix}`);
  state.records = data.items;
  renderRegistry();
}

async function loadStudents() {
  const data = await request("/api/students");
  state.students = data.items;
  renderStudents();
}

async function loadShareFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("share");
  if (!token) {
    state.share = null;
    renderShareSpotlight();
    return;
  }

  try {
    state.share = await request(`/api/public/share/${token}`);
  } catch (error) {
    state.share = {
      share: {
        shareToken: token,
        recipientName: "Unknown",
        recipientType: "External",
        createdAt: new Date().toISOString(),
        note: error.message
      },
      record: null,
      student: null
    };
  }
  renderShareSpotlight();
}

async function refreshAll() {
  await Promise.all([loadDashboard(), loadRecords(), loadStudents(), loadShareFromUrl()]);
}

async function handleCredentialSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.credentialForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await request("/api/records", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    elements.credentialForm.reset();
    elements.verifyInput.value = data.record.recordId;
    showToast(`Credential yaratildi: ${data.record.recordId}`);
    await refreshAll();
    renderVerifyResult(
      {
        valid: true,
        proofStatus: "hash-match",
        record: data.record,
        block: data.record.block
      },
      true
    );
  } catch (error) {
    showToast(error.message);
  }
}

async function handleVerifySubmit(event) {
  event.preventDefault();
  const recordId = elements.verifyInput.value.trim();
  if (!recordId) {
    return;
  }

  try {
    const data = await request(`/api/verify/${recordId}`);
    renderVerifyResult(data, data.valid);
  } catch (error) {
    renderVerifyResult(null, false);
    showToast(error.message);
  }
}

async function createShare(recordId) {
  const recipientName = window.prompt("Kimga ulashilsin? Masalan: HR Manager");
  if (!recipientName) {
    return;
  }

  const recipientType = window.prompt("Recipient type kiriting: Employer yoki University", "Employer");
  if (!recipientType) {
    return;
  }

  try {
    const data = await request("/api/share", {
      method: "POST",
      body: JSON.stringify({
        recordId,
        recipientName,
        recipientType
      })
    });

    const url = data.share.publicUrl;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast("Share link nusxalandi");
    } else {
      showToast(url);
    }

    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

function wireRegistryActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const recordId = button.dataset.record;
  if (action === "verify") {
    elements.verifyInput.value = recordId;
    elements.verifyForm.requestSubmit();
  }
  if (action === "share") {
    createShare(recordId);
  }
}

function wireFilters() {
  elements.searchInput.addEventListener("input", async (event) => {
    state.filters.search = event.target.value.trim();
    await loadRecords();
  });

  elements.typeFilter.addEventListener("change", async (event) => {
    state.filters.type = event.target.value;
    await loadRecords();
  });
}

function bindEvents() {
  elements.credentialForm.addEventListener("submit", handleCredentialSubmit);
  elements.verifyForm.addEventListener("submit", handleVerifySubmit);
  elements.registryList.addEventListener("click", wireRegistryActions);
  wireFilters();
}

async function init() {
  bindEvents();
  try {
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

init();
