const API_PROD_URL = "https://bmi-tracker-8deo.onrender.com";
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
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const statusDiv = document.getElementById("authStatus");

    // Choose route endpoint dynamically based on current UI mode state
    const endpoint = isLoginMode ? "/login" : "/register";
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            statusDiv.style.color = "green";
            statusDiv.innerText = isLoginMode ? "Login successful!" : "Registration successful! Switching to login...";
            
            if (isLoginMode) {
                // Save session token locally in the web browser memory context
                sessionStorage.setItem("current_user_id", data.user_id);
                
                // --- MODIFICATION 1: TRACE AND APPLY EXIT ANIMATION ---
                const authBox = document.getElementById("authContainer");
                authBox.classList.add("fade-out"); // Starts the sliding exit animation
                
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
            headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUserId  // <-- INSERT THIS
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            statusDiv.style.color = "green";
            statusDiv.innerText = `Saved! BMI: ${data.bmi} (${data.category})`;
            document.getElementById("healthForm").reset();
            fetchUserRecords();
        } else {
            statusDiv.style.color = "red";
            statusDiv.innerText = `Error: ${data.detail || "Submission failed"}`;
        }
    } catch (err) {
        statusDiv.style.color = "red";
        statusDiv.innerText = "Error: Cannot connect to backend server.";
    }
});

// Fetch historical table entries restricted strictly to logged-in profile ID
async function fetchUserRecords() {
    const currentUserId = sessionStorage.getItem("current_user_id");

    try {
        const response = await fetch(`${API_PROD_URL}/records`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                // Pass the custom header so the backend bouncer lets us in!
                "x-user-id": currentUserId 
            }
        });

        if (response.ok) {
            const records = await response.json();
            renderTable(records);
        } else {
            console.error("Failed to fetch records. Unauthorized.");
        }
    } catch (error) {
        console.error("Connection error:", error);
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
        const response = await fetch(`${API_BASE_URL}/records/${searchDate}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUserId
            }
        });        const data = await response.json();

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
function renderTable(records) {
    const tbody = document.getElementById("recordsTableBody");
    tbody.innerHTML = "";

    if (records.length === 0) {
        // SMART FIX: Put a helpful message and a button right inside the empty table!
        tbody.innerHTML = `
            <tr>
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

    // Your existing table row building loop remains exactly the same...
    records.forEach((record, index) => {
        let badgeClass = "badge-normal";
        if (record.category === "Underweight") badgeClass = "badge-underweight";
        if (record.category === "Overweight") badgeClass = "badge-overweight";
        if (record.category === "Obese") badgeClass = "badge-obese";

        const row = document.createElement("tr");

        row.classList.add("record-row");
        row.style.animationDelay = `${index * 0.08}s`;
        
        row.innerHTML = `
            <td>#${record.roll_no}</td>
            <td><strong>${record.name}</strong></td>
            <td><span class="badge ${badgeClass}">${record.bmi}</span></td>
            <td><span class="badge ${badgeClass}">${record.category}</span></td>
            <td>${record.date}</td>
        `;
        tbody.appendChild(row);
    });
}

