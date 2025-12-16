// Configuration
const SUPABASE_URL = "https://vtllpagtmncbkywsqccd.supabase.co/rest/v1/rpc/rewards_get_allocations";
const API_KEY = "sb_publishable_yKqi0fu5vV6G4ryUIMJuzw_NCoFEl1c";

// State
let charts = {};
let currentData = null;
let expandedCardContext = null;
let tableSortState = { key: 'date', direction: 'desc' };

const tableComparators = {
    date: (a, b) => a.date.localeCompare(b.date),
    license: (a, b) => a.licenseAlias.localeCompare(b.licenseAlias),
    count: (a, b) => a.count - b.count,
    totalAmount: (a, b) => a.totalAmount - b.totalAmount,
    averageAmount: (a, b) => a.averageAmount - b.averageAmount
};

const tableDefaultDirections = {
    date: 'desc',
    license: 'asc',
    count: 'desc',
    totalAmount: 'desc',
    averageAmount: 'desc'
};

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
const cardOverlay = document.getElementById('card-overlay');
const cardOverlayBody = document.getElementById('card-overlay-body');
const cardOverlayClose = document.getElementById('card-overlay-close');

// Init
document.addEventListener('DOMContentLoaded', () => {
    initializeCardExpansion();
    initializeTableSorting();
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

function initializeCardExpansion() {
    const expandableCards = document.querySelectorAll('[data-expandable="true"]');
    expandableCards.forEach(card => {
        const expandBtn = card.querySelector('.card-expand-btn');
        if (!expandBtn) return;
        expandBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            openCardOverlay(card, expandBtn);
        });
    });

    if (cardOverlayClose) {
        cardOverlayClose.addEventListener('click', closeCardOverlay);
    }

    if (cardOverlay) {
        cardOverlay.addEventListener('click', (event) => {
            if (event.target === cardOverlay) {
                closeCardOverlay();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCardOverlay();
        }
    });
}

function initializeTableSorting() {
    const sortButtons = document.querySelectorAll('.sort-button[data-sort-key]');
    sortButtons.forEach(button => {
        button.addEventListener('click', () => {
            const key = button.dataset.sortKey;
            if (!key) return;

            if (tableSortState.key === key) {
                tableSortState.direction = tableSortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                tableSortState.key = key;
                tableSortState.direction = tableDefaultDirections[key] || 'asc';
            }

            if (currentData?.summaries) {
                renderTable(currentData.summaries);
            } else {
                updateSortIndicators();
            }
        });
    });

    updateSortIndicators();
}

function updateSortIndicators() {
    const sortButtons = document.querySelectorAll('.sort-button[data-sort-key]');
    sortButtons.forEach(button => {
        const key = button.dataset.sortKey;
        button.classList.remove('sort-asc', 'sort-desc', 'is-active');
        if (key === tableSortState.key) {
            button.classList.add(`sort-${tableSortState.direction}`, 'is-active');
        }
    });
}

function openCardOverlay(card, trigger) {
    if (!cardOverlay || !cardOverlayBody) return;

    if (expandedCardContext?.card === card) {
        closeCardOverlay();
        return;
    }

    closeCardOverlay();

    expandedCardContext = {
        card,
        parent: card.parentNode,
        nextSibling: card.nextElementSibling,
        trigger
    };

    card.classList.add('is-expanded');
    cardOverlayBody.appendChild(card);
    cardOverlay.classList.add('visible');
    cardOverlay.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 50);
}

function closeCardOverlay() {
    if (cardOverlay) {
        cardOverlay.classList.remove('visible');
        cardOverlay.setAttribute('aria-hidden', 'true');
    }

    if (!expandedCardContext) return;

    const { card, parent, nextSibling, trigger } = expandedCardContext;
    card.classList.remove('is-expanded');

    if (parent) {
        if (nextSibling && nextSibling.parentNode === parent) {
            parent.insertBefore(card, nextSibling);
        } else {
            parent.appendChild(card);
        }
    }

    expandedCardContext = null;

    if (trigger) {
        trigger.focus();
    }

    window.dispatchEvent(new Event('resize'));
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
    renderDistributionChart(data.averages.perDevice);

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

function renderDistributionChart(perDeviceData) {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (charts.distribution) charts.distribution.destroy();
    if (!perDeviceData || perDeviceData.length === 0) return;

    const totals = perDeviceData
        .map(device => (typeof device.totalAmount === 'number' ? device.totalAmount : Number(device.totalAmount) || 0))
        .filter(value => !Number.isNaN(value));

    if (totals.length === 0) return;

    const mean = totals.reduce((sum, value) => sum + value, 0) / totals.length;
    const variance = totals.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / totals.length;
    const stdDev = variance > 0 ? Math.sqrt(variance) : 1;

    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const spanStart = Math.min(mean - (3 * stdDev), min);
    const spanEnd = Math.max(mean + (3 * stdDev), max);
    const pointCount = 80;
    const range = spanEnd - spanStart;
    const step = range === 0 ? 1 : range / Math.max(pointCount - 1, 1);

    const sqrtTwoPi = Math.sqrt(2 * Math.PI);
    const totalSum = totals.reduce((sum, value) => sum + value, 0);

    const curvePoints = [];
    for (let idx = 0; idx < pointCount; idx++) {
        const x = spanStart + (step * idx);
        const z = (x - mean) / stdDev;
        const pdf = Math.exp(-0.5 * z * z) / (stdDev * sqrtTwoPi);
        curvePoints.push({ x: Number.isFinite(x) ? x : 0, y: pdf * totalSum });
    }

    const scatterPoints = totals.map(value => ({ x: value, y: 0 }));

    charts.distribution = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Normal Distribution Curve',
                    data: curvePoints,
                    parsing: false,
                    borderColor: '#4a90e2',
                    backgroundColor: 'rgba(74, 144, 226, 0.1)',
                    tension: 0.25,
                    fill: true,
                    pointRadius: 0
                },
                {
                    type: 'scatter',
                    label: 'Device Totals',
                    data: scatterPoints,
                    parsing: false,
                    borderColor: '#ff9f43',
                    backgroundColor: '#ff9f43',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Total Rewards per License' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Density (scaled)' }
                }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const xVal = context.parsed.x;
                            const yVal = context.parsed.y;
                            if (context.dataset.type === 'scatter') {
                                return `Device Total: ${xVal.toFixed(2)}`;
                            }
                            return `Curve: ${yVal.toFixed(2)} at ${xVal.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}


function renderTable(summaries) {
    const tbody = document.querySelector('#daily-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(summaries) || summaries.length === 0) {
        updateSortIndicators();
        return;
    }

    const filterValue = tableDeviceFilter.value;
    const filteredSummaries = filterValue === 'all' 
        ? summaries 
        : summaries.filter(s => s.licenseAlias === filterValue);

    const comparator = tableComparators[tableSortState.key];
    const sortedSummaries = comparator
        ? [...filteredSummaries].sort((a, b) => {
            const result = comparator(a, b);
            return tableSortState.direction === 'asc' ? result : -result;
        })
        : filteredSummaries;

    sortedSummaries.forEach(row => {
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

    updateSortIndicators();
}
