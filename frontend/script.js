// ============================================
// CareerTrack - Smart Job Search Dashboard
// ============================================

const API_URL = "http://127.0.0.1:8000/applications";
const AUTH_URL = "http://127.0.0.1:8000/auth";
const TOKEN_KEY = "careertrack_access_token";

const STATUSES = [
    "Applied",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected"
];

const CHART_COLORS = [
    "#3b82f6",
    "#f59e0b",
    "#8b5cf6",
    "#22c55e",
    "#ef4444"
];

// ============================================
// HTML Elements
// ============================================

const form = document.getElementById("application-form");

const companyInput = document.getElementById("company");
const roleInput = document.getElementById("role");
const statusInput = document.getElementById("status");
const dateInput = document.getElementById("application-date");
const notesInput = document.getElementById("notes");

const formMessage = document.getElementById("form-message");
const tableMessage = document.getElementById("table-message");
const tableBody = document.getElementById("applications-table");

const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("filter-status");
const refreshButton = document.getElementById("refresh-btn");

const authView = document.getElementById("auth-view");
const dashboardView = document.getElementById("dashboard-view");
const dashboardFooter = document.getElementById("dashboard-footer");
const dashboardHeader = document.querySelector(".header");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginMessage = document.getElementById("login-message");

const registerName = document.getElementById("register-name");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");
const registerMessage = document.getElementById("register-message");

const showLoginButton = document.getElementById("show-login");
const showRegisterButton = document.getElementById("show-register");
const logoutButton = document.getElementById("logout-btn");
const userGreeting = document.getElementById("user-greeting");


// Analytics elements
const insightsContainer = document.getElementById("smart-insights");

// Store application data
let allApplications = [];

// Chart references
let statusDoughnutChart = null;
let statusBarChart = null;
let timelineChart = null;


// ============================================
// Date Helpers
// ============================================

function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// Parse YYYY-MM-DD as a local calendar date.
function parseApplicationDate(dateString) {
    if (!dateString) {
        return null;
    }

    const match = String(dateString).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


// Set today's date in the application form.
if (dateInput) {
    dateInput.value = getLocalDate();
}


// ============================================
// Message Helpers
// ============================================

function showFormMessage(message, isError = false) {
    formMessage.textContent = message;

    formMessage.style.color = isError
        ? "#dc2626"
        : "#16a34a";
}


function showTableMessage(message, isError = false) {
    tableMessage.textContent = message;

    tableMessage.style.color = isError
        ? "#dc2626"
        : "#16a34a";
}


// ============================================
// API Response Helper
// ============================================

async function readResponse(response) {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { detail: text };
    }
}



// ============================================
// Authentication And Protected API Requests
// ============================================

function setAuthMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.style.color = isError ? "#dc2626" : "#16a34a";
}

function showAuthMode(mode = "login") {
    const loginMode = mode === "login";

    if (loginForm) loginForm.hidden = !loginMode;
    if (registerForm) registerForm.hidden = loginMode;

    if (showLoginButton) {
        showLoginButton.classList.toggle("active", loginMode);
        showLoginButton.setAttribute("aria-selected", String(loginMode));
    }

    if (showRegisterButton) {
        showRegisterButton.classList.toggle("active", !loginMode);
        showRegisterButton.setAttribute("aria-selected", String(!loginMode));
    }

    if (loginMessage) loginMessage.textContent = "";
    if (registerMessage) registerMessage.textContent = "";

    if (loginMode && loginEmail) {
        loginEmail.focus();
    } else if (!loginMode && registerName) {
        registerName.focus();
    }
}

function showAuthenticationScreen(mode = "login") {
    if (authView) authView.hidden = false;
    if (dashboardView) dashboardView.hidden = true;
    if (dashboardFooter) dashboardFooter.hidden = true;
    if (dashboardHeader) dashboardHeader.hidden = true;

    allApplications = [];

    if (tableBody) tableBody.innerHTML = "";
    if (insightsContainer) insightsContainer.innerHTML = "";

    showAuthMode(mode);
}

function showDashboard(user) {
    if (authView) authView.hidden = true;
    if (dashboardView) dashboardView.hidden = false;
    if (dashboardFooter) dashboardFooter.hidden = false;
    if (dashboardHeader) dashboardHeader.hidden = false;

    if (userGreeting) {
        userGreeting.textContent = `Welcome, ${user.name || user.email}!`;
    }
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = new Headers(options.headers || {});

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await window.fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401 && token) {
        localStorage.removeItem(TOKEN_KEY);
        showAuthenticationScreen("login");
        setAuthMessage(
            loginMessage,
            "Your session has expired. Please log in again.",
            true
        );
    }

    return response;
}

async function initializeApp() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        showAuthenticationScreen("login");
        return;
    }

    try {
        const response = await apiFetch(`${AUTH_URL}/me`);
        const result = await readResponse(response);

        if (!response.ok) {
            localStorage.removeItem(TOKEN_KEY);
            showAuthenticationScreen("login");

            setAuthMessage(
                loginMessage,
                result.detail || "Please log in to continue.",
                true
            );
            return;
        }

        showDashboard(result);
        await loadApplications();

    } catch (error) {
        console.error("Session verification failed:", error);
        localStorage.removeItem(TOKEN_KEY);
        showAuthenticationScreen("login");

        setAuthMessage(
            loginMessage,
            "Could not connect to the server. Check that the backend is running.",
            true
        );
    }
}


// ============================================
// Login
// ============================================

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            setAuthMessage(
                loginMessage,
                "Please enter your email and password.",
                true
            );
            return;
        }

        const submitButton = loginForm.querySelector('button[type="submit"]');

        if (submitButton) submitButton.disabled = true;
        setAuthMessage(loginMessage, "Logging in...");

        try {
            const response = await window.fetch(`${AUTH_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.detail || "Login failed. Check your credentials."
                );
            }

            if (!result.access_token) {
                throw new Error("The server did not return an access token.");
            }

            localStorage.setItem(TOKEN_KEY, result.access_token);

            showDashboard(result.user || { email });
            await loadApplications();

        } catch (error) {
            console.error("Login failed:", error);
            setAuthMessage(loginMessage, error.message, true);

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}


// ============================================
// Registration
// ============================================

if (registerForm) {
    registerForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const name = registerName.value.trim();
        const email = registerEmail.value.trim();
        const password = registerPassword.value;

        if (!name || !email || !password) {
            setAuthMessage(
                registerMessage,
                "Please fill in all registration fields.",
                true
            );
            return;
        }

        if (password.length < 8) {
            setAuthMessage(
                registerMessage,
                "Use a password with at least 8 characters.",
                true
            );
            return;
        }

        const submitButton = registerForm.querySelector('button[type="submit"]');

        if (submitButton) submitButton.disabled = true;
        setAuthMessage(registerMessage, "Creating your account...");

        try {
            const response = await window.fetch(`${AUTH_URL}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, password })
            });

            const result = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    result.detail || "Registration failed."
                );
            }

            registerForm.reset();

            if (loginEmail) {
                loginEmail.value = email;
            }

            showAuthMode("login");

            setAuthMessage(
                loginMessage,
                "Account created successfully! Please log in."
            );

        } catch (error) {
            console.error("Registration failed:", error);
            setAuthMessage(registerMessage, error.message, true);

        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}


// ============================================
// Authentication Screen Controls
// ============================================

if (showLoginButton) {
    showLoginButton.addEventListener("click", function() {
        showAuthMode("login");
    });
}

if (showRegisterButton) {
    showRegisterButton.addEventListener("click", function() {
        showAuthMode("register");
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", function() {
        localStorage.removeItem(TOKEN_KEY);
        allApplications = [];

        if (form) form.reset();
        if (dateInput) dateInput.value = getLocalDate();

        showAuthenticationScreen("login");
        setAuthMessage(loginMessage, "You have logged out successfully.");
    });
}


// ============================================
// Safe HTML Table Cells
// ============================================

function createCell(value) {
    const cell = document.createElement("td");

    cell.textContent = value ?? "";

    return cell;
}


// ============================================
// Application Status Counts
// ============================================

function getStatusCounts(applications) {
    const counts = {};

    STATUSES.forEach(status => {
        counts[status] = 0;
    });

    applications.forEach(app => {
        if (Object.prototype.hasOwnProperty.call(counts, app.status)) {
            counts[app.status]++;
        }
    });

    return counts;
}


// ============================================
// Dashboard Statistics
// ============================================

function updateDashboard(applications) {
    const total = applications.length;

    const counts = getStatusCounts(applications);

    document.getElementById("total-count").textContent = total;

    document.getElementById("applied-count").textContent =
        counts.Applied;

    document.getElementById("interview-count").textContent =
        counts.Interview;

    document.getElementById("selected-count").textContent =
        counts.Selected;
}


// ============================================
// Advanced Analytics
// ============================================

function updateAdvancedAnalytics(applications) {
    const total = applications.length;
    const counts = getStatusCounts(applications);

    // Interview, selection, and rejection rates.
    //
    // These metrics use current statuses, not status history.
    // An application marked Selected is not automatically
    // counted as an Interview application.

    const interviewRate = total > 0
        ? (counts.Interview / total) * 100
        : 0;

    const selectionRate = total > 0
        ? (counts.Selected / total) * 100
        : 0;

    const rejectionRate = total > 0
        ? (counts.Rejected / total) * 100
        : 0;

    document.getElementById("interview-rate").textContent =
        `${interviewRate.toFixed(1)}%`;

    document.getElementById("selection-rate").textContent =
        `${selectionRate.toFixed(1)}%`;

    document.getElementById("rejection-rate").textContent =
        `${rejectionRate.toFixed(1)}%`;


    // Count applications submitted during the current month.

    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyApplications = applications.filter(app => {
        const date = parseApplicationDate(app.application_date);

        return date !== null &&
            date.getFullYear() === currentYear &&
            date.getMonth() === currentMonth;
    }).length;

    document.getElementById("monthly-applications").textContent =
        monthlyApplications;
}


// ============================================
// Existing Status Charts
// ============================================

function updateCharts(applications) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js could not be loaded.");
        return;
    }

    const doughnutCanvas = document.getElementById(
        "status-doughnut-chart"
    );

    const barCanvas = document.getElementById(
        "status-bar-chart"
    );

    const counts = getStatusCounts(applications);

    const chartData = STATUSES.map(status => counts[status]);

    // Doughnut chart

    if (doughnutCanvas) {
        if (statusDoughnutChart) {
            statusDoughnutChart.destroy();
        }

        statusDoughnutChart = new Chart(doughnutCanvas, {
            type: "doughnut",

            data: {
                labels: STATUSES,

                datasets: [{
                    label: "Applications",
                    data: chartData,
                    backgroundColor: CHART_COLORS,
                    borderColor: "#ffffff",
                    borderWidth: 2
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        position: "bottom"
                    },

                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }


    // Bar chart

    if (barCanvas) {
        if (statusBarChart) {
            statusBarChart.destroy();
        }

        statusBarChart = new Chart(barCanvas, {
            type: "bar",

            data: {
                labels: STATUSES,

                datasets: [{
                    label: "Number of Applications",
                    data: chartData,
                    backgroundColor: CHART_COLORS,
                    borderRadius: 6
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                scales: {
                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        },

                        title: {
                            display: true,
                            text: "Number of Applications"
                        }
                    },

                    x: {
                        title: {
                            display: true,
                            text: "Application Status"
                        }
                    }
                },

                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}


// ============================================
// Application Timeline Chart
// ============================================

function updateTimelineChart(applications) {
    const canvas = document.getElementById(
        "application-timeline-chart"
    );

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    // Display the current month and previous five months.

    const now = new Date();

    const months = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1
        );

        months.push({
            year: date.getFullYear(),
            month: date.getMonth(),
            label: date.toLocaleDateString("en-US", {
                month: "short",
                year: "numeric"
            }),
            count: 0
        });
    }


    // Count applications using their application dates.

    applications.forEach(app => {
        const date = parseApplicationDate(app.application_date);

        if (!date) {
            return;
        }

        const matchingMonth = months.find(item =>
            item.year === date.getFullYear() &&
            item.month === date.getMonth()
        );

        if (matchingMonth) {
            matchingMonth.count++;
        }
    });


    // Replace the previous timeline chart.

    if (timelineChart) {
        timelineChart.destroy();
    }

    timelineChart = new Chart(canvas, {
        type: "line",

        data: {
            labels: months.map(item => item.label),

            datasets: [{
                label: "Applications Submitted",
                data: months.map(item => item.count),

                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.12)",

                fill: true,
                tension: 0.3,

                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        precision: 0
                    },

                    title: {
                        display: true,
                        text: "Number of Applications"
                    }
                },

                x: {
                    title: {
                        display: true,
                        text: "Application Month"
                    }
                }
            },

            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                }
            }
        }
    });
}


// ============================================
// Smart Insights
// ============================================

function updateSmartInsights(applications) {
    if (!insightsContainer) {
        return;
    }

    insightsContainer.innerHTML = "";

    const total = applications.length;

    const counts = getStatusCounts(applications);

    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyApplications = applications.filter(app => {
        const date = parseApplicationDate(app.application_date);

        return date !== null &&
            date.getFullYear() === currentYear &&
            date.getMonth() === currentMonth;
    }).length;


    // Applications awaiting a decision or next step.
    // We classify Applied and Assessment as pending.
    const pendingCount =
        counts.Applied + counts.Assessment;


    // Find the most common status.

    let mostCommonStatus = "No applications";
    let highestCount = 0;

    STATUSES.forEach(status => {
        if (counts[status] > highestCount) {
            highestCount = counts[status];
            mostCommonStatus = status;
        }
    });


    // Calculate the selection rate.

    const selectionRate = total > 0
        ? ((counts.Selected / total) * 100).toFixed(1)
        : "0.0";


    // Create insight cards safely.

    const insights = [
        {
            title: "Monthly Activity",
            message: total === 0
                ? "Add your first job application to start tracking your progress."
                : `You submitted ${monthlyApplications} application(s) during ${now.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric"
                })}.`
        },

        {
            title: "Applications Awaiting Updates",
            message: `${pendingCount} application(s) are currently marked Applied or Assessment. Consider checking for updates.`
        },

        {
            title: "Most Common Status",
            message: total === 0
                ? "Your most common status will appear after you add applications."
                : `${mostCommonStatus} is your most common status, with ${highestCount} application(s).`
        },

        {
            title: "Selection Progress",
            message: total === 0
                ? "Your selection rate will be calculated after you add applications."
                : `${counts.Selected} application(s) are marked Selected. Your current selection rate is ${selectionRate}%.`
        },

        {
            title: "Interview Opportunities",
            message: `${counts.Interview} application(s) are currently marked Interview.`
        },

        {
            title: "Rejected Applications",
            message: `${counts.Rejected} application(s) are currently marked Rejected.`
        }
    ];


    insights.forEach(insight => {
        const card = document.createElement("div");

        card.className = "insight-card";

        const heading = document.createElement("h3");
        heading.textContent = insight.title;

        const paragraph = document.createElement("p");
        paragraph.textContent = insight.message;

        card.appendChild(heading);
        card.appendChild(paragraph);

        insightsContainer.appendChild(card);
    });
}


// ============================================
// Update All Analytics
// ============================================

function refreshAnalytics(applications) {
    updateDashboard(applications);

    updateAdvancedAnalytics(applications);

    updateCharts(applications);

    updateTimelineChart(applications);

    updateSmartInsights(applications);
}


// ============================================
// Load Applications From Backend
// ============================================

async function loadApplications() {
    showTableMessage("Loading applications...");

    try {
        const response = await apiFetch(API_URL);

        const result = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                result.detail ||
                `Failed to load applications. HTTP ${response.status}`
            );
        }

        if (!Array.isArray(result)) {
            throw new Error(
                "The backend did not return an application list."
            );
        }

        allApplications = result;

        // Refresh all dashboard statistics, charts, and insights.
        refreshAnalytics(allApplications);

        // Preserve the current search and filter.
        filterApplications();

        if (allApplications.length === 0) {
            showTableMessage(
                "No applications found. Add your first application!"
            );
        } else {
            showTableMessage(
                `${allApplications.length} application(s) loaded successfully.`
            );
        }

    } catch (error) {
        console.error("Error loading applications:", error);

        showTableMessage(
            "Could not load applications. Make sure the FastAPI backend is running.",
            true
        );
    }
}


// ============================================
// Display Applications In Table
// ============================================

function displayApplications(applications) {
    tableBody.innerHTML = "";

    if (applications.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent = "No matching applications found.";
        cell.style.textAlign = "center";

        row.appendChild(cell);
        tableBody.appendChild(row);

        return;
    }

    applications.forEach((app, index) => {
        const row = document.createElement("tr");

        // Display row number starting from 1
        // Keep app.id for database operations
        row.appendChild(createCell(index + 1));

        // Company
        row.appendChild(createCell(app.company));

        // Role
        row.appendChild(createCell(app.role));

        // Status badge
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.textContent = app.status;
        badge.className = "status-badge";

        statusCell.appendChild(badge);
        row.appendChild(statusCell);

        // Application date
        row.appendChild(
            createCell(app.application_date || "")
        );

        // Notes
        row.appendChild(
            createCell(app.notes || "")
        );

        // Update status dropdown
        const updateCell = document.createElement("td");
        const statusSelect = document.createElement("select");

        STATUSES.forEach(status => {
            const option = document.createElement("option");

            option.value = status;
            option.textContent = status;
            option.selected = app.status === status;

            statusSelect.appendChild(option);
        });

        statusSelect.addEventListener("change", async function() {
            await updateApplicationStatus(
                app.id,
                statusSelect.value
            );
        });

        updateCell.appendChild(statusSelect);
        row.appendChild(updateCell);

        // Actions
        const actionsCell = document.createElement("td");

        // Edit details button
        const editButton = document.createElement("button");

        editButton.textContent = "Edit Details";
        editButton.type = "button";
        editButton.className = "edit-btn";

        editButton.addEventListener("click", function() {
            editApplicationDetails(app);
        });

        actionsCell.appendChild(editButton);

        // Delete button
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", function() {
            deleteApplication(app.id, app.company);
        });

        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });
}

// ============================================
// Search And Filter Applications
// ============================================

function filterApplications() {
    const searchTerm = searchInput.value
        .trim()
        .toLowerCase();

    const selectedStatus = statusFilter.value;

    const filteredApplications = allApplications.filter(app => {
        const company = String(app.company || "").toLowerCase();
        const role = String(app.role || "").toLowerCase();
        const notes = String(app.notes || "").toLowerCase();
        const status = String(app.status || "").toLowerCase();

        const matchesSearch =
            company.includes(searchTerm) ||
            role.includes(searchTerm) ||
            notes.includes(searchTerm) ||
            status.includes(searchTerm);

        const matchesStatus =
            selectedStatus === "All" ||
            selectedStatus === "" ||
            app.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    displayApplications(filteredApplications);
}


// ============================================
// Add New Application
// ============================================

form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const company = companyInput.value.trim();
    const role = roleInput.value.trim();
    const status = statusInput.value;
    const applicationDate = dateInput.value;
    const notes = notesInput.value.trim();

    if (!company || !role || !applicationDate) {
        showFormMessage(
            "Please enter the company, job role, and application date.",
            true
        );

        return;
    }

    const applicationData = {
        company: company,
        role: role,
        status: status,
        application_date: applicationDate,
        notes: notes
    };

    try {
        const response = await apiFetch(API_URL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(applicationData)
        });

        const result = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                result.detail ||
                "Could not add the application."
            );
        }

        showFormMessage("Application added successfully!");

        form.reset();

        dateInput.value = getLocalDate();

        // Reload data and automatically recalculate analytics.
        await loadApplications();

    } catch (error) {
        console.error("Error adding application:", error);

        showFormMessage(error.message, true);
    }
});


// ============================================
// Update Application Status
// ============================================

async function updateApplicationStatus(id, newStatus) {
    try {
        const response = await apiFetch(`${API_URL}/${id}`, {
            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                status: newStatus
            })
        });

        const result = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                result.detail ||
                "Could not update application status."
            );
        }

        await loadApplications();

        showTableMessage(
            "Application status updated successfully."
        );

    } catch (error) {
        console.error("Error updating status:", error);

        showTableMessage(error.message, true);

        await loadApplications();
    }
}


// ============================================
// Edit Application Date And Notes
// ============================================

async function editApplicationDetails(app) {
    const newDate = prompt(
        "Enter application date (YYYY-MM-DD):",
        app.application_date || getLocalDate()
    );

    if (newDate === null) {
        return;
    }

    const trimmedDate = newDate.trim();
    const parsedDate = parseApplicationDate(trimmedDate);

    if (!parsedDate) {
        alert(
            "Please enter a valid date in YYYY-MM-DD format."
        );

        return;
    }

    const newNotes = prompt(
        "Enter application notes:",
        app.notes || ""
    );

    if (newNotes === null) {
        return;
    }

    try {
        const response = await apiFetch(
            `${API_URL}/${app.id}/details`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    application_date: trimmedDate,
                    notes: newNotes.trim()
                })
            }
        );

        const result = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                result.detail ||
                "Could not update application details."
            );
        }

        await loadApplications();

        showTableMessage(
            "Application details updated successfully."
        );

    } catch (error) {
        console.error(
            "Error updating application details:",
            error
        );

        showTableMessage(error.message, true);
    }
}


// ============================================
// Delete Application
// ============================================

async function deleteApplication(id, company) {
    const confirmed = confirm(
        `Are you sure you want to delete the application for ${company}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await apiFetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        const result = await readResponse(response);

        if (!response.ok) {
            throw new Error(
                result.detail ||
                "Could not delete application."
            );
        }

        await loadApplications();

        showTableMessage("Application deleted successfully.");

    } catch (error) {
        console.error("Error deleting application:", error);

        showTableMessage(error.message, true);
    }
}


// ============================================
// Search, Filter, And Refresh Events
// ============================================

searchInput.addEventListener("input", filterApplications);

statusFilter.addEventListener("change", filterApplications);

refreshButton.addEventListener("click", loadApplications);


// ============================================
// Initial Page Load
// ============================================

initializeApp();
