/* =====================================
   A.R.M.O.R. BOT
   CAMERA + MONITOR SYSTEM
===================================== */


let peer = null;

let localStream = null;

let currentMode = null;


/* =====================================
   CREATE PEER
===================================== */

function createPeer() {

    if (peer) {

        return;

    }


    peer = new Peer();


    peer.on("open", function(id) {

        console.log(
            "Peer ID:",
            id
        );


        document.getElementById(
            "cameraId"
        ).textContent = id;

    });


    peer.on("error", function(error) {

        console.error(
            "PeerJS error:",
            error
        );

        alert(
            "Connection error: " +
            error.type
        );

    });


    /*
       When another device calls
       the phone, answer with
       the phone camera.
    */

    peer.on("call", function(call) {

        console.log(
            "Incoming camera request."
        );


        if (!localStream) {

            console.log(
                "Camera is not active."
            );

            return;

        }


        call.answer(
            localStream
        );


        document.getElementById(
            "cameraConnectionStatus"
        ).textContent =
            "CONNECTED";


        document.getElementById(
            "cameraConnectionStatus"
        ).classList.add(
            "green"
        );

    });

}



/* =====================================
   CAMERA MODE
===================================== */

function enableCameraMode() {

    currentMode =
        "camera";


    createPeer();


    document.getElementById(
        "cameraControl"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "monitorControl"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "modeStatus"
    ).textContent =
        "📱 Phone Camera Mode Enabled";

}



/* =====================================
   MONITOR MODE
===================================== */

function enableMonitorMode() {

    currentMode =
        "monitor";


    createPeer();


    document.getElementById(
        "monitorControl"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "cameraControl"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "modeStatus"
    ).textContent =
        "💻 Laptop Monitor Mode Enabled";

}



/* =====================================
   START PHONE CAMERA
===================================== */

async function startPhoneCamera() {

    try {

        localStream =
            await navigator.mediaDevices
            .getUserMedia({

                video: {

                    facingMode: {
                        ideal:
                        "environment"
                    }

                },

                audio: false

            });


        document.getElementById(
            "localVideo"
        ).srcObject =
            localStream;


        document.getElementById(
            "cameraConnectionStatus"
        ).textContent =
            "CAMERA ACTIVE";


        document.getElementById(
            "cameraConnectionStatus"
        ).classList.add(
            "green"
        );


        document.getElementById(
            "startCameraButton"
        ).textContent =
            "✅ CAMERA ACTIVE";


        document.getElementById(
            "startCameraButton"
        ).disabled =
            true;


    }

    catch(error) {

        console.error(
            error
        );


        alert(
            "Unable to access camera.\n\n" +
            error.name +
            "\n\nPlease allow camera permission."
        );

    }

}



/* =====================================
   LAPTOP CONNECT TO PHONE
===================================== */

function connectToPhone() {

    const phoneId =
        document.getElementById(
            "phoneCameraId"
        ).value.trim();


    if (!phoneId) {

        alert(
            "Please enter the Phone Camera ID."
        );

        return;

    }


    if (!peer) {

        alert(
            "Monitor connection is not ready. Please select Monitor Mode again."
        );

        return;

    }


    document.getElementById(
        "monitorStatus"
    ).textContent =
        "CONNECTING...";


    /*
       IMPORTANT:

       The laptop does NOT need
       its own camera.

       It calls the phone.
    */

    const call =
        peer.call(
            phoneId,
            null
        );


    if (!call) {

        alert(
            "Could not create connection."
        );

        return;

    }


    call.on(
        "stream",
        function(remoteStream) {

            console.log(
                "Receiving phone camera."
            );


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
                "liveCameraStatus"
            ).textContent =
                "● LIVE";


            document.getElementById(
                "liveCameraStatus"
            ).classList.add(
                "green"
            );


            document.getElementById(
                "monitorStatus"
            ).textContent =
                "CONNECTED";

        }
    );


    call.on(
        "close",
        function() {

            document.getElementById(
                "liveCameraStatus"
            ).textContent =
                "DISCONNECTED";

        }
    );


    call.on(
        "error",
        function(error) {

            console.error(
                error
            );


            alert(
                "Camera connection failed."
            );

        }
    );

}



/* =====================================
   DEMO SENSOR DATA
===================================== */

let waterLevel =
    35;


function updateSensors() {

    waterLevel +=
        Math.floor(
            Math.random() * 7
        ) - 3;


    if (
        waterLevel < 10
    ) {

        waterLevel =
            10;

    }


    if (
        waterLevel > 100
    ) {

        waterLevel =
            100;

    }


    document.getElementById(
        "waterLevel"
    ).textContent =
        waterLevel;


    document.getElementById(
        "rainfall"
    ).textContent =
        Math.floor(
            Math.random() * 15
        );


    document.getElementById(
        "temperature"
    ).textContent =
        27 +
        Math.floor(
            Math.random() * 5
        );


    updateRisk();

}



/* =====================================
   FLOOD RISK
===================================== */

function updateRisk() {

    let risk;

    let percentage;


    if (
        waterLevel < 40
    ) {

        risk =
            "LOW";

        percentage =
            20;

    }

    else if (
        waterLevel < 60
    ) {

        risk =
            "MODERATE";

        percentage =
            45;

    }

    else if (
        waterLevel < 80
    ) {

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
        percentage +
        "%";


    document.getElementById(
        "riskBar"
    ).style.width =
        percentage +
        "%";


    const alert =
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


    alert.className =
        "alert";


    if (
        risk === "LOW"
    ) {

        alert.classList.add(
            "safe"
        );


        title.textContent =
            "SYSTEM NORMAL";


        text.textContent =
            "Water level is within the safe range.";

    }

    else if (
        risk === "MODERATE"
    ) {

        alert.classList.add(
            "warning"
        );


        title.textContent =
            "MODERATE WATER LEVEL";


        text.textContent =
            "Water level is increasing.";

    }

    else if (
        risk === "HIGH"
    ) {

        alert.classList.add(
            "warning"
        );


        title.textContent =
            "FLOOD WARNING";


        text.textContent =
            "High overflow risk detected.";

    }

    else {

        alert.classList.add(
            "danger"
        );


        title.textContent =
            "🚨 CRITICAL FLOOD ALERT";


        text.textContent =
            "Critical overflow risk detected.";

    }

}



/* =====================================
   START
===================================== */

setInterval(
    updateSensors,
    3000
);


updateRisk();