# Unity Rewards Dashboard

A lightweight, one-page web dashboard to visualize Unity rewards data using Node.js and Chart.js.

## Deployed at
[https://daniel1941.github.io/unity-rewards/dashboard/public](https://daniel1941.github.io/unity-rewards/dashboard/public/)

## Features
- **Live Data**: Fetches real-time allocation data from Supabase.
- **Visualizations**:
  - Daily Total Rewards (Line Chart)
  - Average Amount per License Alias (Bar Chart)
  - Single License Alias Performance (Line Chart)
- **Data Grid**: Detailed daily breakdown table with filtering capabilities.
- **Secure**: In-memory Bearer token storage (no client-side persistence).

## Prerequisites
- Node.js (v14+)
- npm

## Setup

1. **Install Dependencies**
   ```bash
   cd dashboard
   npm install
   ```

## Running the Dashboard

Start the server:
```bash
cd dashboard
npm start
```
Access the dashboard at: `http://localhost:3000`

## Usage
1. Open the dashboard in your browser.
2. Enter your Supabase Bearer Token when prompted.
3. View charts and filter data by License Alias.

## Project Structure
- `dashboard/public/`: Static web application (HTML/JS/CSS).
- `dashboard/src/`: (Legacy) Backend logic, now ported to client-side for static deployment.
- `licenses.json`: Configuration for device aliases.
