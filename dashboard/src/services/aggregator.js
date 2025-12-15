import { licensesService } from './licensesService.js';

// Single responsibility: Aggregate raw data into business metrics (UTC grouping)
export const aggregator = {
    async processAllocations(allocations) {
        const grouped = {};
        
        // 1. Group by UTC Date and LicenseId
        for (const item of allocations) {
            if (!item.completedAt) continue;

            const dateObj = new Date(item.completedAt);
            // Format YYYY-MM-DD in UTC
            const dateKey = dateObj.toISOString().split('T')[0];
            const licenseId = item.licenseId;
            const key = `${dateKey}|${licenseId}`;

            if (!grouped[key]) {
                grouped[key] = {
                    date: dateKey,
                    licenseId: licenseId,
                    count: 0,
                    sumMicros: 0,
                    allocations: [] // Keep raw refs if needed, or drop for memory
                };
            }

            grouped[key].count++;
            grouped[key].sumMicros += (item.amountMicros || 0);
        }

        // 2. Transform to Summary Objects
        const summaries = await Promise.all(Object.values(grouped).map(async (g) => {
            const totalAmount = g.sumMicros / 1_000_000;
            const licenseAlias = await licensesService.getLicenseAlias(g.licenseId);
            
            return {
                date: g.date,
                licenseId: g.licenseId,
                licenseAlias: licenseAlias,
                count: g.count,
                totalAmount: totalAmount,
                averageAmount: g.count > 0 ? totalAmount / g.count : 0
            };
        }));

        // 3. Calculate High-Level Totals
        const totalCount = summaries.reduce((sum, s) => sum + s.count, 0);
        const grandTotalAmount = summaries.reduce((sum, s) => sum + s.totalAmount, 0);

        // 4. Average Per Device
        const deviceGroups = {};
        summaries.forEach(s => {
            if (!deviceGroups[s.licenseAlias]) deviceGroups[s.licenseAlias] = { total: 0, count: 0 };
            deviceGroups[s.licenseAlias].total += s.totalAmount;
            deviceGroups[s.licenseAlias].count += 1; // Count of days/groups, or raw count? 
            // PowerShell script: ($_.Group | Measure-Object -Property TotalAmount -Average).Average
            // This implies average of the *daily totals* for that device.
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
            dayGroups[s.date].count += 1; // Number of devices that day
            dayGroups[s.date].recordCount += s.count;
        });

        const averagePerDay = Object.entries(dayGroups).map(([date, data]) => ({
            date: date,
            count: data.recordCount,
            totalAmount: data.total,
            averageAmount: data.count > 0 ? data.total / data.count : 0,
            averagePerReward: data.recordCount > 0 ? data.total / data.recordCount : 0
        })).sort((a, b) => a.date.localeCompare(b.date));

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
};
