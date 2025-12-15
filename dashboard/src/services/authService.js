// Single responsibility: Manage the bearer token in memory
let bearerToken = null;

export const authService = {
    setToken(token) {
        if (token === null) {
            bearerToken = null;
            return;
        }
        if (!token || typeof token !== 'string') {
            throw new Error('Invalid token format');
        }
        bearerToken = token.trim();
    },

    getToken() {
        return bearerToken;
    },

    isAuthenticated() {
        return !!bearerToken;
    },

    // Simple validation check (could be expanded to check JWT expiry if needed)
    getStatus() {
        return {
            authenticated: !!bearerToken,
            reason: bearerToken ? 'active' : 'missing'
        };
    }
};
