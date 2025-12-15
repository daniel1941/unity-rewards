import express from 'express';
import { authService } from '../services/authService.js';
import { supabaseClient } from '../services/supabaseClient.js';
import { aggregator } from '../services/aggregator.js';

const router = express.Router();

// Auth Routes
router.post('/auth/token', (req, res) => {
    try {
        const { token } = req.body;
        authService.setToken(token);
        res.json({ ok: true, message: 'Token updated successfully' });
    } catch (error) {
        res.status(400).json({ ok: false, message: error.message });
    }
});

router.get('/auth/status', (req, res) => {
    res.json(authService.getStatus());
});

// Data Routes
router.get('/allocations/live', async (req, res) => {
    try {
        if (!authService.isAuthenticated()) {
            return res.status(401).json({ ok: false, message: 'Authentication required' });
        }

        const rawData = await supabaseClient.getAllocations();
        const processed = await aggregator.processAllocations(rawData);

        res.json({
            ok: true,
            data: processed
        });
    } catch (error) {
        const status = error.message.includes('Supabase Error 401') || error.message.includes('Unauthorized') ? 401 : 500;
        
        // If 401, clear the token on server side as it's invalid/expired
        if (status === 401) {
            authService.setToken(null);
        }

        res.status(status).json({ ok: false, message: error.message });
    }
});

export default router;
