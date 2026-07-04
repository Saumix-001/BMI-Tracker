const API_BASE_URL = "http://127.0.0.1:8000";
const API_PROD_URL = "https://bmi-tracker-8deo.onrender.com"; // For future deployment
let isLoginMode = true;

// On initial page load, check if user is already logged in
window.addEventListener("DOMContentLoaded", () => {
    const savedUserId = sessionStorage.getItem("current_user_id");
    if (savedUserId) {
        showDashboard();
    }
});

// Switch UI text between Login and Registration modes
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const authTitle = document.getElementById("authTitle");
    const mainAuthBtn = document.getElementById("mainAuthBtn");
    const toggleAuthBtn = document.getElementById("toggleAuthBtn");
    const authStatus = document.getElementById("authStatus");
    // Add this inside toggleAuthMode()
    const formContainer = document.getElementById("authForm");
    formContainer.classList.remove("mode-switch");
    // Trigger reflow to restart animation
    void formContainer.offsetWidth; 
    formContainer.classList.add("mode-switch");
    authStatus.innerText = "";
    
    if (isLoginMode) {
        authTitle.innerText = "Login to Health Tracker";
        mainAuthBtn.innerText = "Login";
        toggleAuthBtn.innerText = "Create an Account";
    } else {
        authTitle.innerText = "Register New Account";
        mainAuthBtn.innerText = "Sign Up";
        toggleAuthBtn.innerText = "Back to Login";
    }
}

// Handle Authentication Form Submit
document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // --- PART 2 MODIFICATIONS: Button Spinner Setup ---
    const mainAuthBtn = document.getElementById("mainAuthBtn");
    const originalBtnText = mainAuthBtn.innerText;
    mainAuthBtn.innerHTML = `<span class="spinner"></span> Processing...`;
    mainAuthBtn.disabled = true; // Prevent double-clicks while loading

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const statusDiv = document.getElementById("authStatus");

    // Choose route endpoint dynamically based on current UI mode state
    const endpoint = isLoginMode ? "/login" : "/register";
    
    try {
        const response = await fetch(`${API_PROD_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            statusDiv.style.color = "green";
            statusDiv.classList.add("success-pulse"); // --- PART 2 MODIFICATIONS: Success Glow ---
            statusDiv.innerText = isLoginMode ? "Login successful!" : "Registration successful! Switching to login...";
            
            if (isLoginMode) {
                // Save session token locally in the web browser memory context
                sessionStorage.setItem("current_user_id", data.user_id);
                
                // Starts the sliding exit animation
                const authBox = document.getElementById("authContainer");
                authBox.classList.add("fade-out"); 
                
                // Wait exactly 400ms for the animation to play before hiding the box completely
                setTimeout(showDashboard, 400); 
            } else {
                // Auto switch back to login mode profile view 
                setTimeout(() => {
                    toggleAuthMode();
                    document.getElementById("authPassword").value = "";
                }, 1500);
            }
        } else {
            statusDiv.style.color = "red";
            statusDiv.innerText = `Error: ${data.detail || "Authentication failed"}`;
        }
    } catch (err) {
        statusDiv.style.color = "red";
        statusDiv.innerText = "Error: Cannot connect to backend server.";
    } finally {
        // --- PART 2 MODIFICATIONS: Reset the button ---
        // This runs no matter what, returning the button to normal
        mainAuthBtn.innerHTML = originalBtnText;
        mainAuthBtn.disabled = false;
    }
});

// Hide Auth panels and display personal dashboard view
function showDashboard() {
    // --- MODIFICATION 2: RESET THE ANIMATION STATE ---
    const authBox = document.getElementById("authContainer");
    authBox.style.display = "none";
    authBox.classList.remove("fade-out"); // Removes class so it resets for future logouts
    
    document.getElementById("dashboardContainer").style.display = "block";
    fetchUserRecords();
}

// Log out user session completely
function handleLogout() {
    sessionStorage.removeItem("current_user_id");
    document.getElementById("dashboardContainer").style.display = "none";
    document.getElementById("authContainer").style.display = "block";
    document.getElementById("authForm").reset();
    document.getElementById("authStatus").innerText = "";
}

// Intercept BMI calculation form submit
document.getElementById("healthForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusDiv = document.getElementById("formStatus");
    const currentUserId = sessionStorage.getItem("current_user_id");

    const payload = {
        user_id: currentUserId, // Tag entry directly to current session owner
        roll_no: parseInt(document.getElementById("rollNo").value),
        name: document.getElementById("name").value.trim(),
        weight_kg: parseFloat(document.getElementById("weight").value),
        height_cm: parseFloat(document.getElementById("height").value)
    };

    try {
        const response = await fetch(`${API_PROD_URL}/records`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // --- NEW TOAST NOTIFICATION LOGIC GOES HERE ---
        if (response.ok) {
            showToast(`Saved! BMI: ${data.bmi} (${data.category})`, "success");
            document.getElementById("healthForm").reset();
            fetchUserRecords();
        } else {
            showToast(`Error: ${data.detail || "Submission failed"}`, "error");
        }
        
    } catch (err) {
        // Also update the server error to use the toast!
        showToast("Error: Cannot connect to backend server.", "error");
    }
});

// Fetch historical table entries restricted strictly to logged-in profile ID
async function fetchUserRecords() {
    const currentUserId = sessionStorage.getItem("current_user_id");
    try {
        const response = await fetch(`${API_PROD_URL}/records?user_id=${currentUserId}`);
        const records = await response.json();
        renderTable(records);
    } catch (err) {
        console.error("Failed to load records:", err);
    }
}

// Search through user records securely
// Upgraded function to query the API using the selected calendar date
async function searchRecordsByDate() {
    const searchDate = document.getElementById("searchDate").value; 
    const currentUserId = sessionStorage.getItem("current_user_id");
    const msgDiv = document.getElementById("searchMessage");
    
    // Clear out any previous warning text
    msgDiv.innerText = "";

    if (!searchDate) {
        msgDiv.innerText = "⚠️ Please pick a calendar date first!";
        return;
    }

    try {
        const response = await fetch(`${API_PROD_URL}/records/${searchDate}?user_id=${currentUserId}`);
        const data = await response.json();

        if (response.ok) {
            // If data is found, show it cleanly in the table matrix
            renderTable(data);
        } else {
            // KEY FIX: Instead of clearing the table with renderTable([]), 
            // we leave the old logs on screen and print a warning text.
            msgDiv.innerText = `❌ No logs found for ${searchDate}. Showing full history instead.`;
            
            // Proactively keep their history visible so it doesn't vanish
            fetchUserRecords(); 
        }
    } catch (err) {
        msgDiv.innerText = "🔌 Server link lost. Check your Uvicorn terminal.";
        console.error(err);
    }
}

function clearDateSearch() {
    // Reset the input calendar box to blank values
    document.getElementById("searchDate").value = ""; 
    
    // Wipe away any red error notification text strings
    document.getElementById("searchMessage").innerText = ""; 
    
    // Reload all entries instantly without making the user manually hit refresh
    fetchUserRecords(); 
}



// --- MODIFICATION 3: PREMIUM TABLE SYSTEM WITH DYNAMIC CHIPS ---
// --- MODIFICATION 3: PREMIUM TABLE SYSTEM WITH DYNAMIC CHIPS ---
function renderTable(records) {
    updatePremiumDashboard(records); updatePremiumDashboard(records); 

    const tbody = document.getElementById("recordsTableBody");
    const tbody = document.getElementById("recordsTableBody");
    tbody.innerHTML = "";

    if (records.length === 0) {
        // Added the 'empty-state' class here
        tbody.innerHTML = `
            <tr class="empty-state">
                <td colspan="5" style="text-align:center; padding: 40px;">
                    <div style="color: var(--text-muted); font-size: 16px; margin-bottom: 12px;">
                        🔍 No health records found for this specific date.
                    </div>
                    <button type="button" onclick="clearDateSearch()" style="width: auto; padding: 8px 20px; background-color: var(--secondary);">
                        View All History Records
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    // Loop through records and add dynamic animation delays
    records.forEach((record, index) => {
        let badgeClass = "badge-normal";
        if (record.category === "Underweight") badgeClass = "badge-underweight";
        if (record.category === "Overweight") badgeClass = "badge-overweight";
        if (record.category === "Obese") badgeClass = "badge-obese";

        // Calculate a cascading delay based on the row number (100ms apart)
        const rowDelay = index * 0.1;

        const row = document.createElement("tr");
        row.className = "table-row-enter";
        row.style.animationDelay = `${rowDelay}s`; // Applies the staggered timing
        
        row.innerHTML = `
            <td>#${record.roll_no}</td>
            <td><strong>${record.name}</strong></td>
            <td><span class="badge ${badgeClass} badge-pop" style="animation-delay: ${rowDelay + 0.2}s">${record.bmi}</span></td>
            <td><span class="badge ${badgeClass} badge-pop" style="animation-delay: ${rowDelay + 0.3}s">${record.category}</span></td>
            <td>${record.date}</td>
        `;
        tbody.appendChild(row);
    });
}
// --- PREMIUM FEATURE: TOAST NOTIFICATIONS ---
function showToast(message, type = "success") {
    const toastBox = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    
    // Assign the base toast class and the dynamic success/error class
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    
    toastBox.appendChild(toast);

    // Automatically remove the toast from the DOM after the CSS animation finishes (3.5 seconds)
    setTimeout(() => {
        toast.remove();
    }, 3500);
}
// --- PREMIUM FEATURE: DASHBOARD ANALYTICS ---
let bmiChartInstance = null;

function updatePremiumDashboard(records) {
    // 1. Update the Stat Cards
    document.getElementById("statTotal").innerText = records.length;
    
    if (records.length > 0) {
        // Calculate average BMI
        const totalBmi = records.reduce((sum, record) => sum + parseFloat(record.bmi), 0);
        document.getElementById("statAvgBmi").innerText = (totalBmi / records.length).toFixed(1);
        
        // Get the most recent status (assuming the last item in the array is the newest)
        const latestRecord = records[records.length - 1];
        document.getElementById("statStatus").innerText = latestRecord.category;
        
        // Color code the status text based on category
        const statusDiv = document.getElementById("statStatus");
        statusDiv.style.color = latestRecord.category === "Normal" ? "var(--success)" : 
                               (latestRecord.category === "Underweight" ? "var(--warning)" : "var(--danger)");
    } else {
        document.getElementById("statAvgBmi").innerText = "0.0";
        document.getElementById("statStatus").innerText = "-";
        document.getElementById("statStatus").style.color = "var(--text-main)";
    }

    // 2. Draw the Trend Chart
    const ctx = document.getElementById('bmiChart').getContext('2d');
    
    // If a chart already exists, destroy it before drawing a new one so they don't overlap
    if (bmiChartInstance) {
        bmiChartInstance.destroy();
    }

    // Extract dates and BMI numbers from the records for the chart axes
    const chartLabels = records.map(r => r.date);
    const chartData = records.map(r => r.bmi);

    bmiChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'BMI Trend',
                data: chartData,
                borderColor: '#00d2ff', // Cyan primary color
                backgroundColor: 'rgba(0, 210, 255, 0.1)', // Subtle glow under the line
                borderWidth: 3,
                tension: 0.4, // Smooths the curve of the line
                fill: true,
                pointBackgroundColor: '#1a1f2b',
                pointBorderColor: '#00d2ff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false } // Hide the legend for a cleaner look
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}