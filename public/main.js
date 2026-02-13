const filtersForm = document.getElementById("filters");
const clearBtn = document.getElementById("clearBtn");
const rowsEl = document.getElementById("rows");
const broadcastForm = document.getElementById("broadcastForm");
const broadcastStatus = document.getElementById("broadcastStatus");
const connectionStatus = document.getElementById("connectionStatus");

let currentFilters = {};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getFiltersFromForm() {
  const formData = new FormData(filtersForm);
  const obj = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim()) obj[key] = value.trim();
  }
  return obj;
}

function queryStringFromFilters(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => params.set(key, String(value)));
  return params.toString();
}

async function fetchReservations() {
  const qs = queryStringFromFilters(currentFilters);
  const response = await fetch(`/api/reservations${qs ? `?${qs}` : ""}`);
  const body = await response.json();
  renderRows(body.data ?? []);
}

function renderRows(rows) {
  rowsEl.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(row.reservation_id)}</td>
      <td class="status-${escapeHtml(row.status)}">${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.property_id)}</td>
      <td>${escapeHtml(row.guest_id)}</td>
      <td>${escapeHtml((row.guest_first_name ?? "") + " " + (row.guest_last_name ?? ""))}</td>
      <td>${escapeHtml(row.check_in)}</td>
      <td>${escapeHtml(row.check_out)}</td>
      <td>${escapeHtml(row.num_guests)}</td>
      <td>${escapeHtml(row.total_amount)} ${escapeHtml(row.currency)}</td>
      <td>${escapeHtml(row.updated_at)}</td>
    </tr>
  `
    )
    .join("");
}

filtersForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  currentFilters = getFiltersFromForm();
  await fetchReservations();
});

clearBtn.addEventListener("click", async () => {
  filtersForm.reset();
  currentFilters = {};
  await fetchReservations();
});

broadcastForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.getElementById("broadcastMessage").value.trim();
  if (!message) return;

  const response = await fetch("/api/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, filters: currentFilters })
  });
  const result = await response.json();

  if (!response.ok) {
    broadcastStatus.textContent = `Broadcast failed: ${result.error ?? "unknown error"}`;
    return;
  }

  broadcastStatus.textContent = `Broadcast complete. Sent ${result.sent}/${result.attempted} (failed: ${result.failed}).`;
  console.log("Broadcast result:", result);
});

const source = new EventSource("/api/events");
source.addEventListener("ready", () => {
  connectionStatus.textContent = "SSE: connected";
});
source.addEventListener("reservation.updated", async () => {
  await fetchReservations();
});
source.onerror = () => {
  connectionStatus.textContent = "SSE: disconnected (auto retry)";
};

fetchReservations();
