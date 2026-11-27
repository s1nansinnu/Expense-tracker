/**
 * Expense Tracker — Vanilla JS Frontend
 * Handles all CRUD, summary, and filter interactions via fetch().
 */

(function () {
    "use strict";

    const API = "/api";

    // ── DOM refs ──────────────────────────────────────────────────────
    const form            = document.getElementById("expense-form");
    const formTitle       = document.getElementById("form-title");
    const editIdInput     = document.getElementById("edit-id");
    const titleInput      = document.getElementById("title");
    const amountInput     = document.getElementById("amount");
    const categorySelect  = document.getElementById("category");
    const dateInput       = document.getElementById("date");
    const noteInput       = document.getElementById("note");
    const submitBtn       = document.getElementById("submit-btn");
    const cancelBtn       = document.getElementById("cancel-btn");
    const formError       = document.getElementById("form-error");
    const formCollapseBtn = document.getElementById("form-collapse-btn");

    const summaryMonth    = document.getElementById("summary-month");
    const summaryContent  = document.getElementById("summary-content");

    const filterCategory  = document.getElementById("filter-category");
    const filterDateFrom  = document.getElementById("filter-date-from");
    const filterDateTo    = document.getElementById("filter-date-to");
    const filterSearch    = document.getElementById("filter-search");
    const clearFiltersBtn = document.getElementById("clear-filters-btn");

    const tableContent    = document.getElementById("table-content");
    const expenseCount    = document.getElementById("expense-count");

    const deleteModal     = document.getElementById("delete-modal");
    const deleteTitleSpan = document.getElementById("delete-title");
    const confirmDelBtn   = document.getElementById("confirm-delete-btn");
    const cancelDelBtn    = document.getElementById("cancel-delete-btn");

    let deleteTargetId = null;
    let debounceTimer  = null;

    // ── Helpers ───────────────────────────────────────────────────────

    /** Format a number as ₹ with Indian locale grouping */
    function formatINR(amount) {
        return "₹" + Number(amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    /** Today as YYYY-MM-DD */
    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    /** Current month as YYYY-MM */
    function currentMonthISO() {
        return todayISO().slice(0, 7);
    }

    /** Format YYYY-MM-DD to a readable string */
    function formatDate(iso) {
        const d = new Date(iso + "T00:00:00");
        return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }

    /** Category emoji map */
    const CAT_EMOJI = {
        food: "🍔", transport: "🚗", shopping: "🛒",
        bills: "📄", entertainment: "🎬", other: "📦",
    };

    /** Category colour CSS variable names */
    const CAT_COLORS = {
        food: "#f59e0b", transport: "#3b82f6", shopping: "#ec4899",
        bills: "#8b5cf6", entertainment: "#ef4444", other: "#6b7280",
    };

    /** Show inline error on the form */
    function showFormError(msg) {
        formError.textContent = msg;
        formError.style.display = "block";
    }

    function hideFormError() {
        formError.style.display = "none";
    }

    /** Extract a readable error from a 422 / 4xx API response */
    async function extractError(resp) {
        try {
            const body = await resp.json();
            if (body.detail) {
                if (typeof body.detail === "string") return body.detail;
                // Pydantic validation errors
                if (Array.isArray(body.detail)) {
                    return body.detail.map(e => {
                        const field = e.loc ? e.loc[e.loc.length - 1] : "field";
                        return `${field}: ${e.msg}`;
                    }).join("; ");
                }
            }
            return JSON.stringify(body);
        } catch {
            return `Error ${resp.status}`;
        }
    }

    // ── Initialise ────────────────────────────────────────────────────

    function init() {
        // Set date defaults and max
        dateInput.value = todayISO();
        dateInput.max = todayISO();
        filterDateFrom.max = todayISO();
        filterDateTo.max = todayISO();
        summaryMonth.value = currentMonthISO();

        // Event listeners
        form.addEventListener("submit", handleSubmit);
        cancelBtn.addEventListener("click", resetForm);
        formCollapseBtn.addEventListener("click", toggleForm);

        summaryMonth.addEventListener("change", loadSummary);

        filterCategory.addEventListener("change", loadExpenses);
        filterDateFrom.addEventListener("change", loadExpenses);
        filterDateTo.addEventListener("change", loadExpenses);
        filterSearch.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadExpenses, 300);
        });
        clearFiltersBtn.addEventListener("click", clearFilters);

        confirmDelBtn.addEventListener("click", confirmDelete);
        cancelDelBtn.addEventListener("click", () => { deleteModal.style.display = "none"; });

        // Initial data load
        loadExpenses();
        loadSummary();
    }

    // ── Form toggle ───────────────────────────────────────────────────

    function toggleForm() {
        const formEl = form;
        const isHidden = formEl.style.display === "none";
        formEl.style.display = isHidden ? "" : "none";
        formCollapseBtn.textContent = isHidden ? "▲" : "▼";
    }

    // ── CRUD: Create / Update ─────────────────────────────────────────

    async function handleSubmit(e) {
        e.preventDefault();
        hideFormError();

        const payload = {
            title: titleInput.value.trim(),
            amount: parseFloat(amountInput.value),
            category: categorySelect.value,
            date: dateInput.value,
            note: noteInput.value.trim(),
        };

        // Client-side quick checks
        if (!payload.title) { showFormError("Title is required."); return; }
        if (!payload.amount || payload.amount <= 0) { showFormError("Amount must be a positive number."); return; }
        if (!payload.category) { showFormError("Please select a category."); return; }
        if (!payload.date) { showFormError("Please select a date."); return; }
        if (payload.date > todayISO()) { showFormError("Date cannot be in the future."); return; }

        const editId = editIdInput.value;
        const url = editId ? `${API}/expenses/${editId}` : `${API}/expenses`;
        const method = editId ? "PUT" : "POST";

        try {
            const resp = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!resp.ok) {
                const msg = await extractError(resp);
                showFormError(msg);
                return;
            }

            resetForm();
            loadExpenses();
            loadSummary();
        } catch (err) {
            showFormError("Network error. Please try again.");
        }
    }

    function resetForm() {
        form.reset();
        editIdInput.value = "";
        dateInput.value = todayISO();
        formTitle.textContent = "➕ Add Expense";
        submitBtn.textContent = "Save Expense";
        cancelBtn.style.display = "none";
        hideFormError();
        // Make sure form is visible
        form.style.display = "";
        formCollapseBtn.textContent = "▲";
    }

    // ── CRUD: Read (list) ─────────────────────────────────────────────

    async function loadExpenses() {
        const params = new URLSearchParams();
        if (filterCategory.value) params.set("category", filterCategory.value);
        if (filterDateFrom.value) params.set("date_from", filterDateFrom.value);
        if (filterDateTo.value) params.set("date_to", filterDateTo.value);
        if (filterSearch.value.trim()) params.set("search", filterSearch.value.trim());

        // Client-side date range check
        if (filterDateFrom.value && filterDateTo.value && filterDateFrom.value > filterDateTo.value) {
            tableContent.innerHTML = `<p class="empty-state"><span class="empty-icon">⚠️</span>Start date must be before or equal to end date.</p>`;
            expenseCount.textContent = "";
            return;
        }

        try {
            const resp = await fetch(`${API}/expenses?${params}`);
            if (!resp.ok) {
                const msg = await extractError(resp);
                tableContent.innerHTML = `<p class="empty-state"><span class="empty-icon">⚠️</span>${escapeHtml(msg)}</p>`;
                expenseCount.textContent = "";
                return;
            }

            const expenses = await resp.json();
            renderTable(expenses);
        } catch {
            tableContent.innerHTML = `<p class="empty-state"><span class="empty-icon">⚠️</span>Failed to load expenses.</p>`;
        }
    }

    function renderTable(expenses) {
        if (expenses.length === 0) {
            const hasFilters = filterCategory.value || filterDateFrom.value || filterDateTo.value || filterSearch.value.trim();
            if (hasFilters) {
                tableContent.innerHTML = `<p class="empty-state"><span class="empty-icon">🔍</span>No expenses match your filters.</p>`;
            } else {
                tableContent.innerHTML = `<p class="empty-state"><span class="empty-icon">📭</span>No expenses yet. Add your first one above!</p>`;
            }
            expenseCount.textContent = "";
            return;
        }

        expenseCount.textContent = `${expenses.length} expense${expenses.length > 1 ? "s" : ""}`;

        const table = document.createElement("table");
        table.className = "expense-table";

        // Header
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Date", "Title", "Category", "Amount", "Note", "Actions"].forEach(text => {
            const th = document.createElement("th");
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement("tbody");
        expenses.forEach(exp => {
            const tr = document.createElement("tr");

            // Date
            const tdDate = document.createElement("td");
            tdDate.textContent = formatDate(exp.date);
            tr.appendChild(tdDate);

            // Title
            const tdTitle = document.createElement("td");
            tdTitle.textContent = exp.title;
            tdTitle.style.fontWeight = "600";
            tr.appendChild(tdTitle);

            // Category badge
            const tdCat = document.createElement("td");
            const badge = document.createElement("span");
            badge.className = `badge badge-${exp.category}`;
            badge.textContent = `${CAT_EMOJI[exp.category] || ""} ${exp.category}`;
            tdCat.appendChild(badge);
            tr.appendChild(tdCat);

            // Amount
            const tdAmt = document.createElement("td");
            tdAmt.textContent = formatINR(exp.amount);
            tdAmt.style.fontWeight = "600";
            tr.appendChild(tdAmt);

            // Note
            const tdNote = document.createElement("td");
            tdNote.className = "note-cell";
            tdNote.textContent = exp.note || "—";
            tdNote.title = exp.note || "";
            tr.appendChild(tdNote);

            // Actions
            const tdActions = document.createElement("td");
            tdActions.className = "action-btns";

            const editBtn = document.createElement("button");
            editBtn.className = "btn btn-secondary btn-sm";
            editBtn.textContent = "✏️ Edit";
            editBtn.addEventListener("click", () => startEdit(exp));
            tdActions.appendChild(editBtn);

            const delBtn = document.createElement("button");
            delBtn.className = "btn btn-danger btn-sm";
            delBtn.textContent = "🗑 Delete";
            delBtn.addEventListener("click", () => openDeleteModal(exp));
            tdActions.appendChild(delBtn);

            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        tableContent.innerHTML = "";
        tableContent.appendChild(table);
    }

    // ── CRUD: Edit ────────────────────────────────────────────────────

    function startEdit(exp) {
        editIdInput.value = exp.id;
        titleInput.value = exp.title;
        amountInput.value = exp.amount;
        categorySelect.value = exp.category;
        dateInput.value = exp.date;
        noteInput.value = exp.note || "";

        formTitle.textContent = "✏️ Edit Expense";
        submitBtn.textContent = "Update Expense";
        cancelBtn.style.display = "";
        hideFormError();

        // Show form and scroll to it
        form.style.display = "";
        formCollapseBtn.textContent = "▲";
        document.getElementById("form-section").scrollIntoView({ behavior: "smooth" });
    }

    // ── CRUD: Delete ──────────────────────────────────────────────────

    function openDeleteModal(exp) {
        deleteTargetId = exp.id;
        deleteTitleSpan.textContent = exp.title;
        deleteModal.style.display = "";
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        try {
            const resp = await fetch(`${API}/expenses/${deleteTargetId}`, { method: "DELETE" });
            if (!resp.ok) {
                const msg = await extractError(resp);
                alert("Delete failed: " + msg);
            }
        } catch {
            alert("Network error. Please try again.");
        }
        deleteModal.style.display = "none";
        deleteTargetId = null;
        loadExpenses();
        loadSummary();
    }

    // ── Summary ───────────────────────────────────────────────────────

    async function loadSummary() {
        const val = summaryMonth.value; // "YYYY-MM"
        if (!val) return;

        const [year, month] = val.split("-").map(Number);

        try {
            const resp = await fetch(`${API}/summary?year=${year}&month=${month}`);
            if (!resp.ok) {
                summaryContent.innerHTML = `<p class="empty-state">Could not load summary.</p>`;
                return;
            }
            const data = await resp.json();
            renderSummary(data);
        } catch {
            summaryContent.innerHTML = `<p class="empty-state">Failed to load summary.</p>`;
        }
    }

    function renderSummary(data) {
        if (data.count === 0) {
            summaryContent.innerHTML = `<p class="empty-state"><span class="empty-icon">📊</span>No expenses in this month.</p>`;
            return;
        }

        let html = `<div class="summary-grid">`;
        html += `<div class="summary-stat"><div class="stat-value">${formatINR(data.total)}</div><div class="stat-label">Total Spent</div></div>`;
        html += `<div class="summary-stat"><div class="stat-value">${data.count}</div><div class="stat-label">Expenses</div></div>`;
        html += `</div>`;

        if (data.categories.length > 0) {
            html += `<div class="category-breakdown"><h3>By Category</h3>`;
            data.categories.forEach(c => {
                const pct = data.total > 0 ? (c.total / data.total * 100) : 0;
                const color = CAT_COLORS[c.category] || CAT_COLORS.other;
                html += `<div class="cat-bar-row">`;
                html += `<span class="cat-bar-label">${CAT_EMOJI[c.category] || ""} ${c.category}</span>`;
                html += `<div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
                html += `<span class="cat-bar-amount">${formatINR(c.total)}</span>`;
                html += `</div>`;
            });
            html += `</div>`;
        }

        summaryContent.innerHTML = html;
    }

    // ── Filters ───────────────────────────────────────────────────────

    function clearFilters() {
        filterCategory.value = "";
        filterDateFrom.value = "";
        filterDateTo.value = "";
        filterSearch.value = "";
        loadExpenses();
    }

    // ── Util ──────────────────────────────────────────────────────────

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Boot ──────────────────────────────────────────────────────────
    init();
})();
