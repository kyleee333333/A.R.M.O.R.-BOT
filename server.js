const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json({ limit: '32kb' }));

// ==========================================
// SERVE WEBSITE
// ==========================================

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// ==========================================
// FLOOD MONITORING DATA
// ==========================================

let latest = null;

const clients = new Set();


// ==========================================
// CLEAN ESP32 DATA
// ==========================================

function clean(data) {

    if (!data || typeof data !== 'object') {
        return null;
    }

    const d = { ...data };

    // Distance
    if (
        typeof d.distance !== 'number' ||
        !Number.isFinite(d.distance) ||
        d.distance < 0
    ) {
        d.distance = null;
    }

    // Water level
    if (
        typeof d.waterLevel !== 'number' ||
        !Number.isFinite(d.waterLevel)
    ) {
        d.waterLevel = null;
    }

    // Sensors
    d.lowSensor =
        typeof d.lowSensor === 'boolean'
            ? d.lowSensor
            : false;

    d.mediumSensor =
        typeof d.mediumSensor === 'boolean'
            ? d.mediumSensor
            : false;

    d.highSensor =
        typeof d.highSensor === 'boolean'
            ? d.highSensor
            : false;

    // Status
    if (
        d.status !== 'SAFE' &&
        d.status !== 'WARNING' &&
        d.status !== 'CRITICAL'
    ) {

        if (d.highSensor) {
            d.status = 'CRITICAL';

        } else if (d.mediumSensor) {
            d.status = 'WARNING';

        } else {
            d.status = 'SAFE';
        }
    }

    // Timestamp
    d.timestamp =
        d.timestamp ||
        new Date().toISOString();

    return d;
}


// ==========================================
// SEND DATA TO ALL CONNECTED WEBSITES
// ==========================================

function broadcast(data) {

    const message = JSON.stringify(data);

    for (const ws of clients) {

        if (ws.readyState === WebSocket.OPEN) {

            ws.send(message);
        }
    }
}


// ==========================================
// SERVER STATUS
// ==========================================

app.get('/api/health', (req, res) => {

    res.json({

        ok: true,

        service: 'flood-monitoring-server',

        clients: clients.size,

        hasData: latest !== null

    });

});


// ==========================================
// GET LATEST ESP32 DATA
// ==========================================

app.get('/api/latest', (req, res) => {

    if (latest) {

        res.json(latest);

    } else {

        res.json({

            status: 'NO_DATA',

            lowSensor: false,

            mediumSensor: false,

            highSensor: false,

            distance: null,

            waterLevel: null

        });

    }

});


// ==========================================
// RECEIVE ESP32 TELEMETRY
// ==========================================

app.post('/api/telemetry', (req, res) => {

    console.log('');
    console.log('================================');
    console.log('ESP32 TELEMETRY RECEIVED');
    console.log('================================');

    const data = clean(req.body);

    if (!data) {

        console.log('Invalid telemetry');

        return res.status(400).json({

            ok: false,

            error: 'Invalid telemetry'

        });

    }

    // Save latest data
    latest = data;

    console.log(JSON.stringify(data, null, 2));

    // Send data to website
    broadcast(data);

    res.json({

        ok: true,

        receivedAt: new Date().toISOString()

    });

});


// ==========================================
// CREATE HTTP SERVER
// ==========================================

const server = http.createServer(app);


// ==========================================
// WEBSOCKET SERVER
// ==========================================

const wss = new WebSocket.Server({

    server

});


wss.on('connection', (ws) => {

    console.log('Website connected');

    clients.add(ws);


    // Immediately send latest data
    if (latest) {

        ws.send(JSON.stringify(latest));

    } else {

        ws.send(JSON.stringify({

            status: 'NO_DATA',

            lowSensor: false,

            mediumSensor: false,

            highSensor: false,

            distance: null,

            waterLevel: null

        }));

    }


    ws.on('close', () => {

        console.log('Website disconnected');

        clients.delete(ws);

    });


    ws.on('error', () => {

        clients.delete(ws);

    });

});


// ==========================================
// START SERVER
// ==========================================

server.listen(PORT, '0.0.0.0', () => {

    console.log('');
    console.log('==========================================');
    console.log(' FLOOD MONITORING SERVER');
    console.log('==========================================');

    console.log(`Server running on port ${PORT}`);

    console.log(`Website: http://localhost:${PORT}`);

    console.log(`Health:  http://localhost:${PORT}/api/health`);

    console.log(`Latest:  http://localhost:${PORT}/api/latest`);

    console.log('==========================================');
    console.log('');

});