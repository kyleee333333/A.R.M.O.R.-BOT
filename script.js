// ==========================================
// A.R.M.O.R. BOT
// ESP32 FLOOD MONITORING SYSTEM
// ==========================================


// ==========================================
// DEFAULT SETTINGS
// ==========================================

const DEFAULTS = {

    maxHeight: 40,

    // These are kept for compatibility with
    // your existing settings UI.
    //
    // IMPORTANT:
    // They DO NOT determine SAFE/WARNING/CRITICAL.

    lowThreshold: 0,

    mediumThreshold: 40,

    highThreshold: 70,

    espIp: '',

    // Automatically use the same computer/server
    wsUrl: `ws://${location.host}`,

    apiUrl: `${location.origin}`,

    updateInterval: 1000,

    timeout: 5000

};


// ==========================================
// LOAD SETTINGS
// ==========================================

let settings =
    JSON.parse(
        localStorage.getItem('floodSettings') || 'null'
    ) || DEFAULTS;


// ==========================================
// LOAD HISTORY
// ==========================================

let history =
    JSON.parse(
        localStorage.getItem('floodHistory') || '[]'
    );


// ==========================================
// VARIABLES
// ==========================================

let latest = null;

let lastReceived = 0;

let socket = null;

let demo = false;

let demoTimer = null;


// ==========================================
// SHORTCUT
// ==========================================

const $ = id =>
    document.getElementById(id);


// ==========================================
// CLAMP VALUE
// ==========================================

const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));


// ==========================================
// SAVE SETTINGS
// ==========================================

function saveSettings() {

    localStorage.setItem(
        'floodSettings',
        JSON.stringify(settings)
    );

}


// ==========================================
// CALCULATE WATER LEVEL
// ==========================================
//
// Ultrasonic is ONLY used for displaying
// estimated water level.
//
// It DOES NOT determine status.
//

function calcLevel(distance) {

    if (
        typeof distance !== 'number' ||
        !Number.isFinite(distance) ||
        distance < 0
    ) {

        return null;

    }


    return clamp(

        (
            (settings.maxHeight - distance)
            /
            settings.maxHeight
        ) * 100,

        0,

        100

    );

}


// ==========================================
// DETERMINE STATUS
// ==========================================
//
// IMPORTANT:
//
// STATUS IS BASED ONLY ON THE 3 WATER SENSORS.
//
// LOW SENSOR    = SAFE
// MEDIUM SENSOR = WARNING
// HIGH SENSOR   = CRITICAL
//
// PRIORITY:
//
// HIGH > MEDIUM > LOW
//
// ULTRASONIC WATER LEVEL IS NOT USED.
// ==========================================

function deriveStatus(data) {

    // ======================================
    // HIGH SENSOR
    // ======================================

    if (
        data.highSensor === true
    ) {

        return 'CRITICAL';

    }


    // ======================================
    // MEDIUM SENSOR
    // ======================================

    if (
        data.mediumSensor === true
    ) {

        return 'WARNING';

    }


    // ======================================
    // LOW SENSOR
    // ======================================

    if (
        data.lowSensor === true
    ) {

        return 'SAFE';

    }


    // ======================================
    // NO SENSOR
    // ======================================

    return 'SAFE';

}


// ==========================================
// CLEAN DATA
// ==========================================

function safeData(raw) {

    if (
        !raw ||
        typeof raw !== 'object'
    ) {

        return null;

    }


    const data = {
        ...raw
    };


    // ======================================
    // LOW SENSOR
    // ======================================

    data.lowSensor =
        typeof data.lowSensor === 'boolean'
            ? data.lowSensor
            : null;


    // ======================================
    // MEDIUM SENSOR
    // ======================================

    data.mediumSensor =
        typeof data.mediumSensor === 'boolean'
            ? data.mediumSensor
            : null;


    // ======================================
    // HIGH SENSOR
    // ======================================

    data.highSensor =
        typeof data.highSensor === 'boolean'
            ? data.highSensor
            : null;


    // ======================================
    // DISTANCE
    // ======================================

    data.distance =

        typeof data.distance === 'number' &&

        Number.isFinite(data.distance) &&

        data.distance >= 0

            ? data.distance

            : null;


    // ======================================
    // WATER LEVEL
    // ======================================
    //
    // Ultrasonic information only.
    //
    // This does NOT determine status.
    // ======================================

    data.waterLevel =

        typeof data.waterLevel === 'number' &&

        Number.isFinite(data.waterLevel)

            ? clamp(
                data.waterLevel,
                0,
                100
            )

            : calcLevel(
                data.distance
            );


    // ======================================
    // STATUS
    // ======================================
    //
    // ALWAYS derive status from sensors.
    //
    // We intentionally DO NOT trust an old
    // ultrasonic-based status from the server.
    // ======================================

    data.status =
        deriveStatus(data);


    // ======================================
    // TIMESTAMP
    // ======================================

    data.timestamp =
        data.timestamp ||
        new Date().toISOString();


    return data;

}


// ==========================================
// CONNECTION STATUS
// ==========================================

function setConnection(online) {

    const dot = $('connectionDot');

    const text = $('connectionText');

    const system = $('systemConnection');


    if (online) {

        dot.className =
            'dot online';

        text.textContent =
            'ESP32 ONLINE';

        system.textContent =
            'Online';

    } else {

        dot.className =
            'dot offline';

        text.textContent =
            'ESP32 OFFLINE';

        system.textContent =
            'Offline';

    }

}


// ==========================================
// FORMAT TIME
// ==========================================

function fmtTime(timestamp) {

    const date =
        new Date(timestamp);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return '—';

    }


    return date.toLocaleTimeString();

}


// ==========================================
// UPDATE SENSOR
// ==========================================

function updateSensor(name, value) {

    const card =
        document.querySelector(
            `[data-sensor="${name}"]`
        );


    const element =
        $(name + 'Status');


    const active =
        value === true;


    if (!card || !element) {

        return;

    }


    card.classList.toggle(
        'active',
        active
    );


    element.textContent =

        value === null

            ? 'N/A'

            : active
                ? 'ACTIVE'
                : 'INACTIVE';

}


// ==========================================
// UPDATE USER INTERFACE
// ==========================================

function updateUI(data) {

    if (!data) {

        return;

    }


    // ======================================
    // RE-DERIVE STATUS
    // ======================================
    //
    // This guarantees the website uses
    // WATER SENSORS as the authority.
    //
    // Ultrasonic cannot override it.
    // ======================================

    data.status =
        deriveStatus(data);


    latest = data;

    lastReceived =
        Date.now();


    setConnection(true);


    $('lastData').textContent =
        'Last data received: ' +
        fmtTime(data.timestamp);


    // ======================================
    // WATER LEVEL
    // ======================================

    const level =
        data.waterLevel;


    $('waterLevel').textContent =

        level === null

            ? 'N/A'

            : Math.round(level) + '%';


    $('liveLevel').textContent =

        level === null

            ? 'N/A'

            : level.toFixed(1) + '%';


    $('waterDetailPercent').textContent =

        level === null

            ? 'N/A'

            : level.toFixed(1) + '%';


    // ======================================
    // GAUGE
    // ======================================

    $('gaugeFill').style.height =

        (
            level === null
                ? 0
                : level
        ) + '%';


    // ======================================
    // WATER BAR
    // ======================================

    $('waterBarFill').style.width =

        (
            level === null
                ? 0
                : level
        ) + '%';


    // ======================================
    // DISTANCE
    // ======================================

    const distanceText =

        data.distance === null

            ? 'N/A'

            : data.distance.toFixed(1) +
              ' cm';


    $('distance').textContent =
        distanceText;


    $('liveDistance').textContent =
        distanceText;


    $('waterDetailDistance').textContent =
        distanceText;


    // ======================================
    // MAX HEIGHT
    // ======================================

    $('maxHeightDisplay').textContent =
        settings.maxHeight + ' cm';


    $('waterDetailMax').textContent =
        settings.maxHeight + ' cm';


    // ======================================
    // STATUS
    // ======================================

    const status =
        data.status;


    $('statusTitle').textContent =

        status === 'CRITICAL'

            ? 'CRITICAL FLOOD LEVEL'

            : status;


    $('liveStatus').textContent =
        status;


    $('waterDetailStatus').textContent =
        status;


    // ======================================
    // STATUS DESCRIPTION
    // ======================================

    $('liveStatusSmall').textContent =

        status === 'SAFE'

            ? 'Normal condition'

            : status === 'WARNING'

                ? 'Water level is rising'

                : 'Immediate attention required';


    $('statusDescription').textContent =

        status === 'CRITICAL'

            ? 'The high water sensor has been activated. Immediate attention is required.'

            : status === 'WARNING'

                ? 'The medium water sensor has been activated. Monitor the situation closely.'

                : 'The low water sensor is active or no higher-level sensor is active. The system is currently safe.';


    // ======================================
    // STATUS CARD
    // ======================================

    $('statusCard').className =
        'status-card ' +
        status.toLowerCase();


    // ======================================
    // STATUS ICON
    // ======================================

    $('statusIcon').textContent =

        status === 'CRITICAL'

            ? '!'

            : status === 'WARNING'

                ? '⚠'

                : '✓';


    // ======================================
    // ALERT BANNER
    // ======================================

    $('alertTitle').textContent =

        status === 'CRITICAL'

            ? 'CRITICAL FLOOD ALERT'

            : status === 'WARNING'

                ? 'WATER LEVEL WARNING'

                : 'SYSTEM NORMAL';


    $('alertText').textContent =

        status === 'CRITICAL'

            ? 'High-level water sensor activated.'

            : status === 'WARNING'

                ? 'Medium-level water sensor activated.'

                : 'No active flood warning.';


    $('alertTime').textContent =
        fmtTime(data.timestamp);


    // ======================================
    // SENSOR STATES
    // ======================================

    updateSensor(
        'low',
        data.lowSensor
    );


    updateSensor(
        'medium',
        data.mediumSensor
    );


    updateSensor(
        'high',
        data.highSensor
    );


    // ======================================
    // LIVE SENSOR STATES
    // ======================================

    $('liveLow').textContent =

        data.lowSensor === null

            ? 'N/A'

            : data.lowSensor
                ? 'ACTIVE'
                : 'INACTIVE';


    $('liveMedium').textContent =

        data.mediumSensor === null

            ? 'N/A'

            : data.mediumSensor
                ? 'ACTIVE'
                : 'INACTIVE';


    $('liveHigh').textContent =

        data.highSensor === null

            ? 'N/A'

            : data.highSensor
                ? 'ACTIVE'
                : 'INACTIVE';


    // ======================================
    // TIMESTAMP
    // ======================================

    $('liveTimestamp').textContent =
        fmtTime(data.timestamp);


    // ======================================
    // WIFI
    // ======================================

    $('systemWifi').textContent =

        data.wifiConnected === false

            ? 'Disconnected'

            : 'Connected';


    // ======================================
    // SYSTEM STATUS
    // ======================================

    $('systemStatus').textContent =
        'Operational';


    // ======================================
    // CHART
    // ======================================

    addPoint(data);


    // ======================================
    // ALERT HISTORY
    // ======================================

    maybeAlert(data);


    renderAlerts();

}


// ==========================================
// ALERT HISTORY
// ==========================================

function maybeAlert(data) {

    // ======================================
    // SENSOR THAT CAUSED THE STATUS
    // ======================================

    const sensor =

        data.highSensor

            ? 'HIGH'

            : data.mediumSensor

                ? 'MEDIUM'

                : data.lowSensor

                    ? 'LOW'

                    : data.status;


    // ======================================
    // SAFE DOES NOT CREATE ALERT
    // ======================================

    if (
        !['WARNING', 'CRITICAL']
            .includes(data.status)
    ) {

        return;

    }


    const key =
        data.timestamp +
        '|' +
        data.status;


    if (
        history[0]?.key === key
    ) {

        return;

    }


    history.unshift({

        key: key,

        time: data.timestamp,

        sensor: sensor,

        waterLevel: data.waterLevel,

        distance: data.distance,

        status: data.status

    });


    history =
        history.slice(0, 500);


    localStorage.setItem(
        'floodHistory',
        JSON.stringify(history)
    );

}


// ==========================================
// ADD CHART POINT
// ==========================================

function addPoint(data) {

    const timestamp =
        new Date(
            data.timestamp
        ).getTime();


    if (
        !Number.isFinite(timestamp) ||
        data.waterLevel === null
    ) {

        return;

    }


    waterChart.data.labels.push(
        new Date(timestamp)
    );


    waterChart.data.datasets[0]
        .data
        .push(data.waterLevel);


    while (
        waterChart.data.labels.length > 500
    ) {

        waterChart.data.labels.shift();

        waterChart.data.datasets[0]
            .data
            .shift();

    }


    filterChart();

}


// ==========================================
// FILTER REAL-TIME CHART
// ==========================================

function filterChart() {

    const minutes =
        Number(
            $('rangeSelect').value
        );


    const cutoff =
        Date.now() -
        minutes * 60000;


    const pairs =
        waterChart.data.labels
            .map(
                (label, index) => ({

                    x: label,

                    y:
                        waterChart
                            .data
                            .datasets[0]
                            .data[index]

                })
            )
            .filter(
                point =>
                    new Date(point.x)
                        .getTime() >= cutoff
            );


    waterChart.data.labels =
        pairs.map(
            point => point.x
        );


    waterChart.data.datasets[0].data =
        pairs.map(
            point => point.y
        );


    waterChart.update('none');

}


// ==========================================
// CHART OPTIONS
// ==========================================

const chartOptions = {

    responsive: true,

    maintainAspectRatio: false,

    scales: {

        x: {

            type: 'category',

            ticks: {

                maxTicksLimit: 10

            }

        },

        y: {

            min: 0,

            max: 100,

            title: {

                display: true,

                text: 'Water Level (%)'

            }

        }

    },

    plugins: {

        legend: {

            display: false

        }

    }

};


// ==========================================
// REAL-TIME CHART
// ==========================================

let waterChart =
    new Chart(
        $('waterChart'),
        {

            type: 'line',

            data: {

                labels: [],

                datasets: [

                    {

                        data: [],

                        tension: 0.3,

                        borderWidth: 2,

                        pointRadius: 0,

                        fill: true

                    }

                ]

            },

            options: chartOptions

        }
    );


// ==========================================
// HISTORY CHART
// ==========================================

let historyChart =
    new Chart(
        $('historyChart'),
        {

            type: 'line',

            data: {

                labels:
                    history
                        .slice()
                        .reverse()
                        .map(
                            item =>
                                new Date(item.time)
                        ),

                datasets: [

                    {

                        label:
                            'Alert water level',

                        data:
                            history
                                .slice()
                                .reverse()
                                .map(
                                    item =>
                                        item.waterLevel
                                ),

                        tension: 0.3,

                        borderWidth: 2

                    }

                ]

            },

            options: {

                ...chartOptions,

                plugins: {

                    legend: {

                        display: true

                    }

                }

            }

        }
    );


// ==========================================
// RENDER ALERTS
// ==========================================

function renderAlerts() {

    const search =
        $('alertSearch')
            .value
            .toLowerCase();


    const filter =
        $('alertFilter')
            .value;


    const rows =
        history.filter(
            item =>

                (
                    filter === 'ALL' ||
                    item.status === filter
                )

                &&

                (

                    `${item.sensor} ${item.status}`
                        .toLowerCase()
                        .includes(search)

                    ||

                    fmtTime(item.time)
                        .toLowerCase()
                        .includes(search)

                )

        );


    $('alertTable').innerHTML =

        rows.map(

            item => `

                <tr>

                    <td>
                        ${fmtTime(item.time)}
                    </td>

                    <td>
                        ${item.sensor}
                    </td>

                    <td>
                        ${
                            item.waterLevel == null

                                ? 'N/A'

                                : Number(
                                    item.waterLevel
                                  ).toFixed(1)
                                  + '%'
                        }
                    </td>

                    <td>
                        ${
                            item.distance == null

                                ? 'N/A'

                                : Number(
                                    item.distance
                                  ).toFixed(1)
                                  + ' cm'
                        }
                    </td>

                    <td>
                        <b>
                            ${item.status}
                        </b>
                    </td>

                </tr>

            `

        ).join('')

        ||

        `
            <tr>
                <td colspan="5">
                    No alerts found.
                </td>
            </tr>
        `;


    // ======================================
    // UPDATE HISTORY GRAPH
    // ======================================

    historyChart.data.labels =
        history
            .slice()
            .reverse()
            .map(
                item =>
                    new Date(item.time)
            );


    historyChart.data.datasets[0].data =
        history
            .slice()
            .reverse()
            .map(
                item =>
                    item.waterLevel
            );


    historyChart.update();

}


// ==========================================
// CONNECT WEBSOCKET
// ==========================================

function connectWS() {

    if (socket) {

        try {

            socket.close();

        } catch (error) {}

    }


    try {

        console.log(
            'Connecting WebSocket:',
            settings.wsUrl
        );


        socket =
            new WebSocket(
                settings.wsUrl
            );


        // ==================================
        // CONNECTED
        // ==================================

        socket.onopen = () => {

            console.log(
                'WebSocket connected'
            );


            setConnection(true);


            $('settingsMessage').textContent =
                'WebSocket connected successfully.';

        };


        // ==================================
        // MESSAGE
        // ==================================

        socket.onmessage = event => {

            try {

                const data =
                    JSON.parse(
                        event.data
                    );


                console.log(
                    'ESP32 DATA:',
                    data
                );


                const cleaned =
                    safeData(data);


                if (cleaned) {

                    updateUI(cleaned);

                }

            } catch (error) {

                console.error(
                    'Invalid WebSocket data:',
                    error
                );

            }

        };


        // ==================================
        // CLOSED
        // ==================================

        socket.onclose = () => {

            console.log(
                'WebSocket disconnected'
            );


            setConnection(false);

        };


        // ==================================
        // ERROR
        // ==================================

        socket.onerror = error => {

            console.error(
                'WebSocket error:',
                error
            );


            setConnection(false);

        };

    } catch (error) {

        console.error(
            'WebSocket connection failed:',
            error
        );


        setConnection(false);

    }

}


// ==========================================
// TEST REST API
// ==========================================

async function testApi() {

    try {

        const response =
            await fetch(
                settings.apiUrl +
                '/api/health'
            );


        const data =
            await response.json();


        if (data.ok) {

            $('settingsMessage').textContent =
                `REST API is online. Connected websites: ${data.clients}`;

        } else {

            $('settingsMessage').textContent =
                'REST API returned an unexpected response.';

        }

    } catch (error) {

        console.error(
            'REST API error:',
            error
        );


        $('settingsMessage').textContent =
            'REST API test failed.';

    }

}


// ==========================================
// DEMO MODE
// ==========================================
//
// DEMO ALSO USES SENSOR STATES.
//
// LOW    = SAFE
// MEDIUM = WARNING
// HIGH   = CRITICAL
//
// The simulated ultrasonic percentage
// does NOT determine status.
// ==========================================

function startDemo() {

    demo =
        !demo;


    $('demoBtn').textContent =

        demo

            ? '■ Stop Demo'

            : '▶ Demo Mode';


    if (demo) {

        let t = 0;


        demoTimer =
            setInterval(

                () => {

                    t++;


                    // ==================================
                    // SIMULATE WATER LEVEL
                    // ==================================

                    const level =
                        clamp(

                            15 +

                            45 *
                            (
                                1 +
                                Math.sin(t / 8)
                            )
                            / 2 +

                            Math.random() * 4,

                            0,

                            100

                        );


                    const distance =

                        settings.maxHeight -

                        (
                            level / 100
                        ) *
                        settings.maxHeight;


                    // ==================================
                    // SIMULATE WATER SENSORS
                    // ==================================
                    //
                    // LOW = SAFE
                    // MEDIUM = WARNING
                    // HIGH = CRITICAL
                    //
                    // These are simulated ONLY for demo.
                    // ==================================

                    const lowSensor =
                        true;


                    const mediumSensor =
                        level >= 40;


                    const highSensor =
                        level >= 70;


                    // ==================================
                    // CREATE DATA
                    // ==================================

                    const data =
                        safeData({

                            lowSensor:
                                lowSensor,

                            mediumSensor:
                                mediumSensor,

                            highSensor:
                                highSensor,

                            distance:
                                distance,

                            waterLevel:
                                level,

                            timestamp:
                                new Date()
                                    .toISOString(),

                            wifiConnected:
                                true

                        });


                    // ==================================
                    // UPDATE UI
                    // ==================================

                    updateUI(data);

                },

                1000

            );

    } else {

        clearInterval(
            demoTimer
        );

        demoTimer = null;

    }

}


// ==========================================
// POPULATE SETTINGS
// ==========================================

function populateSettings() {

    $('maxHeight').value =
        settings.maxHeight;


    $('lowThreshold').value =
        settings.lowThreshold;


    $('mediumThreshold').value =
        settings.mediumThreshold;


    $('highThreshold').value =
        settings.highThreshold;


    $('espIp').value =
        settings.espIp;


    $('wsUrl').value =
        settings.wsUrl;


    $('apiUrl').value =
        settings.apiUrl;


    $('updateInterval').value =
        settings.updateInterval;


    $('timeout').value =
        settings.timeout;

}


// ==========================================
// NAVIGATION
// ==========================================

document
    .querySelectorAll('.nav-btn')
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll('.nav-btn')
                .forEach(
                    item =>
                        item.classList.remove(
                            'active'
                        )
                );


            button.classList.add(
                'active'
            );


            document
                .querySelectorAll('.page')
                .forEach(
                    page =>
                        page.classList.remove(
                            'active'
                        )
                );


            $('page-' + button.dataset.page)
                .classList.add(
                    'active'
                );


            $('sidebar')
                .classList.remove(
                    'open'
                );

        };

    });


// ==========================================
// MENU
// ==========================================

$('menuBtn').onclick = () => {

    $('sidebar')
        .classList.toggle(
            'open'
        );

};


// ==========================================
// DEMO BUTTON
// ==========================================

$('demoBtn').onclick =
    startDemo;


// ==========================================
// CHART RANGE
// ==========================================

$('rangeSelect').onchange =
    filterChart;


// ==========================================
// ALERT SEARCH
// ==========================================

$('alertSearch').oninput =
    renderAlerts;


// ==========================================
// ALERT FILTER
// ==========================================

$('alertFilter').onchange =
    renderAlerts;


// ==========================================
// CLEAR ALERT HISTORY
// ==========================================

$('clearBtn').onclick = () => {

    if (
        confirm(
            'Clear all alert history?'
        )
    ) {

        history = [];


        localStorage.setItem(
            'floodHistory',
            '[]'
        );


        renderAlerts();

    }

};


// ==========================================
// EXPORT CSV
// ==========================================

$('exportBtn').onclick = () => {

    const lines = [

        [
            'Time',
            'Sensor',
            'Water Level',
            'Distance',
            'Status'
        ],

        ...history.map(
            item => [

                item.time,

                item.sensor,

                item.waterLevel,

                item.distance,

                item.status

            ]
        )

    ];


    const csv =

        lines
            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(value ?? '')
                                    .replaceAll(
                                        '"',
                                        '""'
                                    )}"`
                        )
                        .join(',')
            )
            .join('\n');


    const blob =
        new Blob(
            [csv],
            {
                type:
                    'text/csv'
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            'a'
        );


    link.href =
        url;


    link.download =
        'flood-alert-history.csv';


    link.click();


    URL.revokeObjectURL(
        url
    );

};


// ==========================================
// SAVE SETTINGS
// ==========================================

$('saveSettings').onclick = () => {

    const newSettings = {

        maxHeight:
            Number(
                $('maxHeight').value
            ),

        lowThreshold:
            Number(
                $('lowThreshold').value
            ),

        mediumThreshold:
            Number(
                $('mediumThreshold').value
            ),

        highThreshold:
            Number(
                $('highThreshold').value
            ),

        espIp:
            $('espIp').value.trim(),

        wsUrl:
            $('wsUrl').value.trim(),

        apiUrl:
            $('apiUrl').value.trim(),

        updateInterval:
            Number(
                $('updateInterval').value
            ),

        timeout:
            Number(
                $('timeout').value
            )

    };


    // ======================================
    // VALIDATION
    // ======================================

    if (
        newSettings.maxHeight <= 0
    ) {

        $('settingsMessage').textContent =
            'Maximum height must be greater than 0.';

        return;

    }


    if (
        newSettings.mediumThreshold <
        newSettings.lowThreshold
    ) {

        $('settingsMessage').textContent =
            'Medium threshold cannot be lower than low threshold.';

        return;

    }


    if (
        newSettings.highThreshold <
        newSettings.mediumThreshold
    ) {

        $('settingsMessage').textContent =
            'High threshold cannot be lower than medium threshold.';

        return;

    }


    if (
        newSettings.updateInterval < 250
    ) {

        $('settingsMessage').textContent =
            'Update interval must be at least 250 ms.';

        return;

    }


    if (
        newSettings.timeout < 1000
    ) {

        $('settingsMessage').textContent =
            'Connection timeout must be at least 1000 ms.';

        return;

    }


    settings =
        newSettings;


    saveSettings();


    $('settingsMessage').textContent =
        'Settings saved successfully.';


    connectWS();


    if (latest) {

        updateUI(
            safeData(latest)
        );

    }

};


// ==========================================
// CONNECT BUTTON
// ==========================================

$('connectBtn').onclick =
    connectWS;


// ==========================================
// TEST API BUTTON
// ==========================================

$('testApi').onclick =
    testApi;


// ==========================================
// CLOCK
// ==========================================

setInterval(

    () => {

        $('clock').textContent =
            new Date()
                .toLocaleString();


        if (

            lastReceived &&

            Date.now() -
            lastReceived >
            settings.timeout &&

            !demo

        ) {

            setConnection(false);

        }

    },

    500

);


// ==========================================
// INITIALIZE
// ==========================================

populateSettings();

renderAlerts();


// ==========================================
// CONNECT TO NODE SERVER
// ==========================================

connectWS();


// ==========================================
// INITIAL TEST
// ==========================================

testApi();


// ==========================================
// CONSOLE MESSAGE
// ==========================================

console.log(
    '=========================================='
);

console.log(
    ' A.R.M.O.R. BOT FLOOD MONITORING SYSTEM'
);

console.log(
    '=========================================='
);

console.log(
    'STATUS LOGIC:'
);

console.log(
    'LOW SENSOR    = SAFE'
);

console.log(
    'MEDIUM SENSOR = WARNING'
);

console.log(
    'HIGH SENSOR   = CRITICAL'
);

console.log(
    'ULTRASONIC    = INFORMATION ONLY'
);

console.log(
    '=========================================='
);

console.log(
    'WebSocket:',
    settings.wsUrl
);

console.log(
    'REST API:',
    settings.apiUrl
);

console.log(
    '=========================================='
);