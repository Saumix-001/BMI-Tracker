const API_PROD_URL = "https://bmi-tracker-8deo.onrender.com"; // <-- Changed to actual production backend URL
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
        const response = await fetch(`${API_PROD_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
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
        user_id: currentUserId,
        roll_no: parseInt(document.getElementById("rollNo").value),
        name: document.getElementById("name").value.trim(),

        // --- ADD THESE TWO NEW LINES ---
        age: parseInt(document.getElementById("age").value),
        gender: document.getElementById("gender").value,
        // -------------------------------

        weight_kg: parseFloat(document.getElementById("weight").value),
        height_cm: parseFloat(document.getElementById("height").value)
    };

    try {
        const response = await fetch(`${API_PROD_URL}/records`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUserId
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const resultBox = document.getElementById("instantResultBox");

        if (response.ok) {
            // 1. Clear the form and update background data
            document.getElementById("healthForm").reset();
            fetchUserRecords();

            // 2. Grab the BMI and Category
            const returnedBmi = parseFloat(data.bmi);

            // 3. Determine the color badge
            let badgeColor = "#10b981"; // Default Green
            let statusText = data.category || "Healthy Range";

            if (returnedBmi < 18.5) {
                badgeColor = "#f59e0b"; // Orange for underweight
            } else if (returnedBmi >= 25 && returnedBmi < 30) {
                badgeColor = "#f97316"; // Dark orange for overweight
            } else if (returnedBmi >= 30) {
                badgeColor = "#ef4444"; // Red for obese
            }

            // 4. Inject the stunning visual result into the right side!
            // 4. Inject the stunning visual result into the right side!
            // 4. Inject the stunning visual result into the right side!
            resultBox.innerHTML = `
            <h3 style="color: #1e293b; margin-bottom: 5px;">Your Results</h3>
            <div style="font-size: 48px; font-weight: 900; color: #2563eb; margin: 10px 0;">${returnedBmi}</div>
            <span style="background-color: ${badgeColor}; color: white; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                ${statusText}
            </span>
            <p style="color: #64748b; margin-top: 20px; font-size: 14px;">Record saved to your history!</p>
            
            <div style="display: flex; justify-content: center; margin-top: 20px;">
                <button onclick="switchTab('records')" style="background-color: #eff6ff; color: #2563eb; padding: 10px 24px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; font-size: 14px;">View Records</button>
            </div>
        `;
        } else {
            // Show server errors directly in the new result box
            resultBox.innerHTML = `<p style="color: #ef4444; font-weight: bold;">Error: ${data.detail || "Submission failed"}</p>`;
        }
    } catch (err) {
        // Show connection errors directly in the new result box
        const resultBox = document.getElementById("instantResultBox");
        if (resultBox) {
            resultBox.innerHTML = `<p style="color: #ef4444; font-weight: bold;">Error: Cannot connect to backend server.</p>`;
        }
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

            // 🚨 ADD THIS LINE TO SPY ON THE FIRST RECORD:
            console.log("Spying on Backend Data:", records[0]);

            renderTable(records);
            renderChart(records);
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
        const response = await fetch(`${API_PROD_URL}/records/${searchDate}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUserId
            }
        });
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
// --- UPGRADED: PREMIUM CARD RENDERER ---
// --- UPGRADED: PREMIUM CARD RENDERER ---
function renderTable(records) {
    const grid = document.getElementById("recordsGrid");
    grid.innerHTML = ""; // Clear the old cards

    // If they searched a date with no records, tell them!
    if (records.length === 0) {
        grid.innerHTML = "<p style='color: #6b7280; font-style: italic;'>No health records found for this date.</p>";
        return;
    }

    // Loop through their history and build the new smart cards
    // We add 'index' here to calculate the staggered delay!
    records.forEach((record, index) => {
        let statusText = "";
        let badgeColor = "";

        if (record.bmi < 18.5) {
            statusText = "Underweight";
            badgeColor = "#f59e0b";
        } else if (record.bmi >= 18.5 && record.bmi <= 24.9) {
            statusText = "Healthy Range";
            badgeColor = "#10b981";
        } else if (record.bmi >= 25 && record.bmi <= 29.9) {
            statusText = "Overweight";
            badgeColor = "#f97316";
        } else {
            statusText = "Needs Attention";
            badgeColor = "#ef4444";
        }

        const card = document.createElement("div");


        // 1. Initial State: Invisible and pushed down 20 pixels
        card.style.cssText = `
            background: white; 
            padding: 15px; 
            border-radius: 8px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
            margin-bottom: 12px; 
            border-left: 5px solid ${badgeColor};
            opacity: 0; 
            transform: translateY(20px); 
            transition: all 0.4s ease-out;
        `;

        // Fix for the undefined weight bug!
        const displayWeight = record.weight_kg !== undefined ? record.weight_kg : "N/A";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
                <strong style="color: #1f2937;">📅 ${record.date}</strong>
                <span style="background-color: ${badgeColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                    ${statusText}
                </span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #4b5563;">
                <span><strong>BMI:</strong> ${record.bmi}</span>
                <span><strong>Weight:</strong> ${displayWeight} kg</span>
            </div>
        `;

        grid.appendChild(card);

        // 2. The Magic Trick: Force the animation to trigger AFTER the card is on the page
        // We multiply the index by 100 milliseconds to create that beautiful cascading effect
        setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, index * 100);
    });
}
// --- NEW TAB SWITCHING LOGIC ---
// --- UPGRADED TAB SWITCHING LOGIC ---
// --- CRASH-PROOF TAB SWITCHING LOGIC ---
function switchTab(tabId) {
    // 1. Create lists of all possible rooms and buttons
    const allRooms = ["view-dash", "view-calc", "view-records", "view-trends", "view-profile"];
    const allTabs = ["tab-dash", "tab-calc", "tab-records", "tab-trends", "tab-profile"];

    // 2. Safely hide all rooms (only if they exist!)
    allRooms.forEach(roomId => {
        const roomElement = document.getElementById(roomId);
        if (roomElement) {
            roomElement.style.display = "none";
        }
    });

    // 3. Safely turn off all buttons (only if they exist!)
    allTabs.forEach(btnId => {
        const btnElement = document.getElementById(btnId);
        if (btnElement) {
            btnElement.classList.remove("active");
        }
    });

    // 4. Turn on the specific room and button the user clicked
    const selectedRoom = document.getElementById("view-" + tabId);
    const selectedTab = document.getElementById("tab-" + tabId);

    if (selectedRoom) selectedRoom.style.display = "block";
    if (selectedTab) selectedTab.classList.add("active");

    // 5. If they open Records or Trends, pull fresh data!
    // 5. If they open Records or Trends, pull fresh data!
    if (tabId === 'records' || tabId === 'trends') {
        if (typeof fetchUserRecords === "function") {
            // We modify this to ensure the chart renders AFTER the data is ready
            fetchUserRecords().then(data => {
                if (tabId === 'trends') {
                    renderChart(data); // Pass the data directly!
                }
            });
        }
    }
}
// Variable to keep track of the chart so we can update it without glitches
let myBmiChart = null;

function renderChart(records) {
    const ctx = document.getElementById('bmiChart').getContext('2d');
    
    // Sort and extract data
    const sortedRecords = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = sortedRecords.map(r => r.date);
    const bmis = sortedRecords.map(r => r.bmi);

    // Destroy existing chart
    if (window.myBmiChart instanceof Chart) {
        window.myBmiChart.destroy();
    }

    // Step 1: Wait for tab to be fully visible
    setTimeout(() => {
        
        // Step 2: Build the chart with an EMPTY data array
        window.myBmiChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Your BMI',
                    data: [], // <--- START EMPTY!
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    borderWidth: 3,
                    pointBackgroundColor: '#00759A',
                    pointRadius: 5,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                // Simple, powerful animation setting
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuint'
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        suggestedMin: 15,
                        suggestedMax: 35
                    }
                }
            }
        });

        // Step 3: Inject the real data right after it builds, forcing the animation
        setTimeout(() => {
            window.myBmiChart.data.datasets[0].data = bmis;
            window.myBmiChart.update();
        }, 50); // Just a tiny 50ms delay is enough

    }, 100); 
}
async function exportJSON() {
    const currentUserId = sessionStorage.getItem("current_user_id");

    try {
        // We use your actual API_PROD_URL and your security headers!
        const response = await fetch(`${API_PROD_URL}/records`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUserId
            }
        });

        const data = await response.json();

        // Format and create the file
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], {
            type: "application/json"
        });

        // Trigger the download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "My_HealthTrack_History.json";

        document.body.appendChild(a);
        a.click();

        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export data.");
    }
}
// This is just a sample script. Paste your real code (javascript or HTML) here.

if ('this_is' == /an_example/) {
    of_beautifier();
} else {
    var a = b ? (c % d) : e[f];
}