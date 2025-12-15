import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Single responsibility: Load and map license data
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Adjust path to point to the root licenses.json (parent of dashboard folder)
const LICENSES_PATH = path.resolve(__dirname, '../../../licenses.json');

let licensesCache = null;

export const licensesService = {
    async loadLicenses() {
        try {
            const data = await fs.readFile(LICENSES_PATH, 'utf-8');
            licensesCache = JSON.parse(data);
            return licensesCache;
        } catch (error) {
            console.error('Failed to load licenses.json:', error.message);
            return [];
        }
    },

    async getLicenseAlias(licenseId) {
        if (!licensesCache) {
            await this.loadLicenses();
        }
        
        const match = licensesCache.find(l => l.licenseId === licenseId);
        if (match) {
            return match.deviceName; // Keeping JSON property name 'deviceName' but returning as alias
        }
        
        // Fallback: last 4 chars of licenseId
        return licenseId && licenseId.length > 4 
            ? `...${licenseId.substring(licenseId.length - 4)}` 
            : 'Unknown';
    }
};
