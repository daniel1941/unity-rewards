// Configuration
const SUPABASE_URL = "https://vtllpagtmncbkywsqccd.supabase.co/rest/v1/rpc/rewards_get_allocations";
const API_KEY = "sb_publishable_yKqi0fu5vV6G4ryUIMJuzw_NCoFEl1c";

// State
let charts = {};
let currentData = null;

// DOM Elements
const authStatus = document.getElementById('auth-status');
const authSection = document.getElementById('auth-section');
const dashboardContent = document.getElementById('dashboard-content');
const tokenForm = document.getElementById('token-form');
const tokenInput = document.getElementById('token-input');
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const deviceSelect = document.getElementById('device-select');
const tableDeviceFilter = document.getElementById('table-device-filter');

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// Event Listeners
deviceSelect.addEventListener('change', () => {
    if (currentData) {
        renderSingleDeviceChart(deviceSelect.value, currentData.summaries);
    }
});

tableDeviceFilter.addEventListener('change', () => {
    if (currentData) {
        renderTable(currentData.summaries);
    }
});

tokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = tokenInput.value;
    if (!token) return;

    // Save to Session Storage (cleared when tab closes)
    sessionStorage.setItem('unity_rewards_token', token);
    tokenInput.value = '';
    checkAuth();
});

refreshBtn.addEventListener('click', loadData);
logoutBtn.addEventListener('click', logout);

// Functions
function checkAuth() {
    const token = sessionStorage.getItem('unity_rewards_token');
    
    if (token) {
        authStatus.textContent = 'Authenticated';
        authStatus.className = 'status-badge active';
        authSection.style.display = 'none';
        dashboardContent.style.display = 'block';
        loadData();
    } else {
        authStatus.textContent = 'Token Missing';
        authStatus.className = 'status-badge missing';
        authSection.style.display = 'block';
        dashboardContent.style.display = 'none';
    }
}

function logout() {
    if (confirm('Are you sure you want to logout? This will clear your session token.')) {
        sessionStorage.clear();
        currentData = null;
        checkAuth();
    }
}

async function loadData() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Loading...';
    
    try {
        const token = sessionStorage.getItem('unity_rewards_token');
        if (!token) {
            checkAuth();
            return;
        }

        // Fetch Data
        const allocationsRes = await fetch(SUPABASE_URL, {
            method: 'POST',
            headers: {
                "apikey": API_KEY,
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ skip: null, take: null })
        });

        if (allocationsRes.status === 401) {
            sessionStorage.removeItem('unity_rewards_token');
            checkAuth();
            throw new Error('Session expired. Please log in again.');
        }

        if (!allocationsRes.ok) {
            const err = await allocationsRes.json();
            throw new Error(err.message || 'Failed to fetch data');
        }

        const rawData = await allocationsRes.json();
        console.log('Raw API Data:', allocationsRes);
        // DEBUG: Analyze raw data dates
        const dates = rawData.map(i => i.completedAt);
        const uniqueDates = [...new Set(dates)];
        const uniqueDays = [...new Set(dates.map(d => d ? d.split('T')[0] : 'null'))];
        
        console.log('API Response Analysis:', {
            totalRecords: rawData.length,
            uniqueTimestampsCount: uniqueDates.length,
            uniqueDays: uniqueDays,
            firstTimestamp: dates[0],
            lastTimestamp: dates[dates.length - 1],
            sampleRecord: rawData[0]
        });

        const processed = processAllocations(rawData);
        
        currentData = processed;
        renderDashboard(processed);
        document.getElementById('last-updated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error(err);
        alert('Failed to load data: ' + err.message);
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Data';
    }
}

function processAllocations(allocations) {
    const grouped = {};
    
    // 1. Group by UTC Date and LicenseId
    for (const item of allocations) {
        if (!item.completedAt) continue;

        const dateObj = new Date(item.completedAt);
        const dateKey = dateObj.toISOString().split('T')[0];
        const licenseId = item.licenseId;
        const key = `${dateKey}|${licenseId}`;

        if (!grouped[key]) {
            grouped[key] = {
                date: dateKey,
                licenseId: licenseId,
                count: 0,
                sumMicros: 0
            };
        }

        grouped[key].count++;
        grouped[key].sumMicros += (item.amountMicros || 0);
    }

    // 2. Transform to Summary Objects
    const summaries = Object.values(grouped).map(g => {
        const totalAmount = g.sumMicros / 1_000_000;
        // Use shortened licenseId as alias
        const licenseAlias = g.licenseId && g.licenseId.length > 4 
            ? `...${g.licenseId.substring(g.licenseId.length - 4)}` 
            : (g.licenseId || 'Unknown');
        
        return {
            date: g.date,
            licenseId: g.licenseId,
            licenseAlias: licenseAlias,
            count: g.count,
            totalAmount: totalAmount,
            averageAmount: g.count > 0 ? totalAmount / g.count : 0
        };
    });

    // 3. Calculate High-Level Totals
    const totalCount = summaries.reduce((sum, s) => sum + s.count, 0);
    const grandTotalAmount = summaries.reduce((sum, s) => sum + s.totalAmount, 0);

    // 4. Average Per Device
    const deviceGroups = {};
    summaries.forEach(s => {
        if (!deviceGroups[s.licenseAlias]) deviceGroups[s.licenseAlias] = { total: 0, count: 0 };
        deviceGroups[s.licenseAlias].total += s.totalAmount;
        deviceGroups[s.licenseAlias].count += 1; 
    });

    const averagePerDevice = Object.entries(deviceGroups).map(([name, data]) => ({
        licenseAlias: name,
        averageAmount: data.count > 0 ? data.total / data.count : 0,
        totalAmount: data.total
    }));

    // 5. Average Per Day
    const dayGroups = {};
    summaries.forEach(s => {
        if (!dayGroups[s.date]) dayGroups[s.date] = { total: 0, count: 0, recordCount: 0 };
        dayGroups[s.date].total += s.totalAmount;
        dayGroups[s.date].count += 1;
        dayGroups[s.date].recordCount += s.count;
    });

    const averagePerDay = Object.entries(dayGroups).map(([date, data]) => ({
        date: date,
        count: data.recordCount,
        totalAmount: data.total,
        averageAmount: data.count > 0 ? data.total / data.count : 0,
        averagePerReward: data.recordCount > 0 ? data.total / data.recordCount : 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    console.log('Processed Data:', {
        summariesCount: summaries.length,
        perDeviceCount: averagePerDevice.length,
        perDayCount: averagePerDay.length,
        firstDay: averagePerDay[0],
        lastDay: averagePerDay[averagePerDay.length - 1]
    });

    return {
        summaries: summaries.sort((a, b) => b.date.localeCompare(a.date) || a.licenseAlias.localeCompare(b.licenseAlias)),
        totals: {
            count: totalCount,
            totalAmount: grandTotalAmount
        },
        averages: {
            perDevice: averagePerDevice.sort((a, b) => b.averageAmount - a.averageAmount),
            perDay: averagePerDay
        },
        meta: {
            generatedAtUtc: new Date().toISOString()
        }
    };
}

function renderDashboard(data) {
    // Metrics
    document.getElementById('metric-total-amount').textContent = data.totals.totalAmount.toFixed(2);
    document.getElementById('metric-total-count').textContent = data.totals.count;

    // Charts
    renderDailyChart(data.averages.perDay);
    renderDeviceChart(data.averages.perDevice);

    // Populate Dropdown
    const currentSelection = deviceSelect.value;
    deviceSelect.innerHTML = '<option value="">Select License ID</option>';
    
    // Populate Table Filter
    const currentTableFilter = tableDeviceFilter.value;
    tableDeviceFilter.innerHTML = '<option value="all">All License IDs</option>';

    // Sort devices alphabetically
    const devices = data.averages.perDevice.map(d => d.licenseAlias).sort((a, b) => a.localeCompare(b));
    
    devices.forEach(dev => {
        // Chart dropdown
        const option = document.createElement('option');
        option.value = dev;
        option.textContent = dev;
        deviceSelect.appendChild(option);

        // Table filter dropdown
        const filterOption = document.createElement('option');
        filterOption.value = dev;
        filterOption.textContent = dev;
        tableDeviceFilter.appendChild(filterOption);
    });

    // Restore selection or select first
    if (currentSelection && devices.includes(currentSelection)) {
        deviceSelect.value = currentSelection;
    } else if (devices.length > 0) {
        deviceSelect.value = devices[0];
    }

    // Restore table filter
    if (currentTableFilter && (devices.includes(currentTableFilter) || currentTableFilter === 'all')) {
        tableDeviceFilter.value = currentTableFilter;
    }
    
    // Render initial single device chart
    renderSingleDeviceChart(deviceSelect.value, data.summaries);

    // Table
    renderTable(data.summaries);
}

function renderSingleDeviceChart(licenseAlias, summaries) {
    const ctx = document.getElementById('singleDeviceChart').getContext('2d');
    
    if (charts.singleDevice) charts.singleDevice.destroy();

    if (!licenseAlias) return;

    // Filter data for the selected device and sort by date
    const deviceData = summaries
        .filter(s => s.licenseAlias === licenseAlias)
        .sort((a, b) => a.date.localeCompare(b.date));

    // Use bar chart if only one data point to ensure visibility
    const chartType = deviceData.length === 1 ? 'bar' : 'line';
    const bgColor = deviceData.length === 1 ? '#ff9f43' : 'rgba(255, 159, 67, 0.1)';

    charts.singleDevice = new Chart(ctx, {
        type: chartType,
        data: {
            labels: deviceData.map(d => d.date),
            datasets: [{
                label: `Total Amount (${licenseAlias})`,
                data: deviceData.map(d => d.totalAmount),
                borderColor: '#ff9f43',
                backgroundColor: bgColor,
                tension: 0.1,
                fill: deviceData.length > 1,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderDailyChart(perDayData) {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    
    if (charts.daily) charts.daily.destroy();

    // Use bar chart if only one data point to ensure visibility
    const chartType = perDayData.length === 1 ? 'bar' : 'line';
    const bgColor = perDayData.length === 1 ? '#4a90e2' : 'rgba(74, 144, 226, 0.1)';

    charts.daily = new Chart(ctx, {
        type: chartType,
        data: {
            labels: perDayData.map(d => d.date),
            datasets: [{
                label: 'Total Amount',
                data: perDayData.map(d => d.totalAmount),
                borderColor: '#4a90e2',
                backgroundColor: bgColor,
                tension: 0.1,
                fill: perDayData.length > 1,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderDeviceChart(perDeviceData) {
    const ctx = document.getElementById('deviceChart').getContext('2d');
    
    if (charts.device) charts.device.destroy();

    charts.device = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: perDeviceData.map(d => d.licenseAlias),
            datasets: [{
                label: 'Average Amount',
                data: perDeviceData.map(d => d.averageAmount),
                backgroundColor: '#66bb6a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTable(summaries) {
    const tbody = document.querySelector('#daily-table tbody');
    tbody.innerHTML = '';

    const filterValue = tableDeviceFilter.value;
    const filteredSummaries = filterValue === 'all' 
        ? summaries 
        : summaries.filter(s => s.licenseAlias === filterValue);

    filteredSummaries.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.date}</td>
            <td>${row.licenseAlias}</td>
            <td>${row.count}</td>
            <td>${row.totalAmount.toFixed(6)}</td>
            <td>${row.averageAmount.toFixed(6)}</td>
        `;
        tbody.appendChild(tr);
    });
}
