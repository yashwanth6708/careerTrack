const API_URL = "http://127.0.0.1:8000/applications";

const form = document.getElementById("application-form");
const tableBody = document.getElementById("applications-table");
const message = document.getElementById("message");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");

const statuses = [
    "Applied",
    "Assessment",
    "Interview",
    "Selected",
    "Rejected"
];

let allApplications = [];

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#b91c1c" : "#15803d";
}

async function loadApplications() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Could not load applications.");
        }

        allApplications = await response.json();

        updateDashboard(allApplications);
        filterApplications();

    } catch (error) {
        tableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent =
            "Unable to connect. Check whether the FastAPI server is running.";

        row.appendChild(cell);
        tableBody.appendChild(row);

        showMessage(error.message, true);
    }
}

function updateDashboard(applications) {
    document.getElementById("total-count").textContent =
        applications.length;

    document.getElementById("applied-count").textContent =
        applications.filter(app => app.status === "Applied").length;

    document.getElementById("interview-count").textContent =
        applications.filter(app => app.status === "Interview").length;

    document.getElementById("selected-count").textContent =
        applications.filter(app => app.status === "Selected").length;
}

function filterApplications() {
    const searchText = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;

    const filtered = allApplications.filter(app => {
        const matchesSearch =
            app.company.toLowerCase().includes(searchText) ||
            app.role.toLowerCase().includes(searchText);

        const matchesStatus =
            selectedStatus === "All" ||
            app.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    renderApplications(filtered);
}

function renderApplications(applications) {
    tableBody.replaceChildren();

    if (applications.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = "No matching applications found.";

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    applications.forEach(app => {
        const row = document.createElement("tr");

        function addCell(value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
            return cell;
        }

        addCell(app.id);
        addCell(app.company);
        addCell(app.role);

        const statusCell = addCell("");
        const badge = document.createElement("span");

        badge.className = "status-badge";
        badge.textContent = app.status;
        statusCell.appendChild(badge);

        const updateCell = addCell("");
        const select = document.createElement("select");

        select.className = "small-select";
        select.setAttribute(
            "aria-label",
            `Update status for ${app.company}`
        );

        statuses.forEach(status => {
            const option = document.createElement("option");

            option.value = status;
            option.textContent = status;
            option.selected = status === app.status;

            select.appendChild(option);
        });

        const updateButton = document.createElement("button");

        updateButton.className = "secondary-button";
        updateButton.textContent = "Save";

        updateButton.addEventListener("click", () => {
            updateStatus(app.id, select.value);
        });

        updateCell.append(
            select,
            document.createTextNode(" "),
            updateButton
        );

        const actionCell = addCell("");
        const deleteButton = document.createElement("button");

        deleteButton.className = "danger-button";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteApplication(app.id, app.company);
        });

        actionCell.appendChild(deleteButton);
        tableBody.appendChild(row);
    });
}

// Add a new application
form.addEventListener("submit", async event => {
    event.preventDefault();

    const company = document.getElementById("company").value.trim();
    const role = document.getElementById("role").value.trim();
    const status = document.getElementById("status").value;

    if (!company || !role) {
        showMessage("Please enter both company and role.", true);
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ company, role, status })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Could not add application."
            );
        }

        form.reset();
        showMessage("Application added successfully!");

        await loadApplications();

    } catch (error) {
        showMessage(error.message, true);
    }
});

// Update application status
async function updateStatus(id, status) {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Could not update status."
            );
        }

        showMessage("Application status updated!");

        await loadApplications();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// Delete an application
async function deleteApplication(id, company) {
    const confirmed = window.confirm(
        `Are you sure you want to delete the application for ${company}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Could not delete application."
            );
        }

        showMessage("Application deleted successfully!");

        await loadApplications();

    } catch (error) {
        showMessage(error.message, true);
    }
}

// Search and status filtering
searchInput.addEventListener("input", filterApplications);
statusFilter.addEventListener("change", filterApplications);

// Refresh applications
document.getElementById("refresh-button").addEventListener(
    "click",
    loadApplications
);

// Load applications when the page opens
loadApplications();
