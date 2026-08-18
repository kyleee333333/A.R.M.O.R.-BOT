/*
========================================
A.R.M.O.R. BOT DASHBOARD
========================================
*/


let peer;

let waterLevel = 35;


/*
========================================
CREATE LAPTOP PEER
========================================
*/

peer = new Peer();


peer.on(
    "open",
    function(id) {

        console.log(
            "Laptop Peer ID:",
            id
        );

    }
);


/*
========================================
CONNECT TO PHONE CAMERA
========================================
*/

function connectCamera() {

    const phoneId =
        document.getElementById(
            "phoneId"
        ).value.trim();


    if (!phoneId) {

        alert(
            "Please enter the Phone Camera ID."
        );

        return;

    }


    /*
    We don't need our own camera.
    We simply call the phone.
    */

    navigator.mediaDevices
        .getUserMedia({
            video: false,
            audio: false
        })
        .catch(() => null);


    /*
    PeerJS requires a media stream.

    Create an empty media stream.
    */

    const emptyStream =
        new MediaStream();


    const call =
        peer.call(
            phoneId,
            emptyStream
        );


    if (!call) {

        alert(
            "Unable to connect to phone."
        );

        return;

    }


    call.on(
        "stream",
        function(remoteStream) {

            const video =
                document.getElementById(
                    "remoteVideo"
                );


            video.srcObject =
                remoteStream;


            video.style.display =
                "block";


            document.getElementById(
                "cameraPlaceholder"
            ).style.display =
                "none";


            document.getElementById(
                "cameraStatus"
            ).textContent =
                "● CAMERA CONNECTED";


            document.getElementById(
                "cameraStatus"
            ).classList.add(
                "green"
            );


            addLog(
                "Phone camera connected successfully."
            );

        }
    );


    call.on(
        "close",
        function() {

            cameraDisconnected();

        }
    );


    call.on(
        "error",
        function(error) {

            console.error(error);

            alert(
                "Camera connection failed."
            );

        }
    );

}


/*
========================================
CAMERA DISCONNECTED
========================================
*/

function cameraDisconnected() {

    document.getElementById(
        "remoteVideo"
    ).style.display =
        "none";


    document.getElementById(
        "cameraPlaceholder"
    ).style.display =
        "flex";


    document.getElementById(
        "cameraStatus"
    ).textContent =
        "CAMERA DISCONNECTED";

}


/*
========================================
WATER LEVEL
========================================
*/

function updateWaterLevel(level) {

    waterLevel = level;


    document.getElementById(
        "waterLevel"
    ).textContent =
        level;


    document.getElementById(
        "waterDisplay"
    ).textContent =
        level;


    /*
    Maximum level = 100 cm
    */

    const percentage =
        Math.min(
            level,
            100
        );


    document.getElementById(
        "water"
    ).style.height =
        percentage + "%";


    updateRisk(level);

}


/*
========================================
FLOOD RISK
========================================
*/

function updateRisk(level) {

    let risk;

    let percentage;


    if (level < 40) {

        risk =
            "LOW";

        percentage =
            20;

    }

    else if (level < 60) {

        risk =
            "MODERATE";

        percentage =
            45;

    }

    else if (level < 80) {

        risk =
            "HIGH";

        percentage =
            70;

    }

    else {

        risk =
            "CRITICAL";

        percentage =
            95;

    }


    document.getElementById(
        "risk"
    ).textContent =
        risk;


    document.getElementById(
        "riskPercent"
    ).textContent =
        percentage + "%";


    document.getElementById(
        "riskBar"
    ).style.width =
        percentage + "%";


    updateAlert(risk);

}


/*
========================================
ALERT
========================================
*/

function updateAlert(risk) {

    const box =
        document.getElementById(
            "alertBox"
        );

    const title =
        document.getElementById(
            "alertTitle"
        );

    const text =
        document.getElementById(
            "alertText"
        );


    box.className =
        "alert";


    if (risk === "LOW") {

        box.classList.add(
            "safe"
        );


        title.textContent =
            "SYSTEM NORMAL";


        text.textContent =
            "Water level is within the safe range.";

    }


    else if (risk === "MODERATE") {

        box.classList.add(
            "warning"
        );


        title.textContent =
            "MODERATE WATER LEVEL";


        text.textContent =
            "Water level is increasing. Continue monitoring.";

    }


    else if (risk === "HIGH") {

        box.classList.add(
            "warning"
        );


        title.textContent =
            "FLOOD WARNING";


        text.textContent =
            "Water level has reached the high-risk threshold.";

    }


    else {

        box.classList.add(
            "danger"
        );


        title.textContent =
            "🚨 CRITICAL FLOOD ALERT";


        text.textContent =
            "Critical overflow risk detected.";

    }

}


/*
========================================
SYSTEM LOG
========================================
*/

function addLog(message) {

    const logs =
        document.getElementById(
            "logs"
        );


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "log";


    item.innerHTML =
        "🟢 <span>" +
        message +
        "</span>";


    logs.prepend(
        item
    );


    if (logs.children.length > 5) {

        logs.removeChild(
            logs.lastChild
        );

    }

}


/*
========================================
DEMO SENSOR DATA
========================================

This is only for testing the website.

Later this can be replaced with
Arduino/ESP32 data.
*/

function simulateSensors() {

    let change =
        Math.floor(
            Math.random() * 7
        ) - 3;


    let level =
        waterLevel + change;


    if (level < 10)
        level = 10;


    if (level > 100)
        level = 100;


    updateWaterLevel(
        level
    );


    /*
    Rainfall
    */

    document.getElementById(
        "rainfall"
    ).textContent =
        Math.floor(
            Math.random() * 15
        );


    /*
    Temperature
    */

    document.getElementById(
        "temperature"
    ).textContent =
        Math.floor(
            Math.random() * 5
        ) + 27;

}


/*
========================================
START DEMO
========================================
*/

updateWaterLevel(
    35
);


/*
Update every 3 seconds
*/

setInterval(
    simulateSensors,
    3000
);