"use strict";

/* =========================================================
   PROFILE PAGE
   Supabase Authentication + User Profile + Subscription
   + Renewal Requests

   IMPORTANT:
   - Uses the same Supabase project as NSC
   - Does NOT modify NSC
   - User can only read/update their own profile
   - User can only create/read their own renewal requests
   ========================================================= */


/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
    "https://gbnjvtlkltmcmjrmewos.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_OYddt412ZGjfDrxCTacgsA_7JH2SzZI";


/* =========================================================
   CREATE SUPABASE CLIENT
   ========================================================= */

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;


/* =========================================================
   SHORT DOM HELPER
   ========================================================= */

function $(id) {

    return document.getElementById(id);

}


/* =========================================================
   SHOW PAGE MESSAGE
   ========================================================= */

function showMessage(
    text,
    type = "ok"
) {

    const element =
        $("pageMessage");


    if (!element) {
        return;
    }


    element.textContent =
        text;


    element.className =
        `message ${type}`;

}


/* =========================================================
   CLEAR PAGE MESSAGE
   ========================================================= */

function clearMessage() {

    const element =
        $("pageMessage");


    if (!element) {
        return;
    }


    element.className =
        "message hidden";


    element.textContent =
        "";

}


/* =========================================================
   SAFE TEXT
   ========================================================= */

function safeText(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }


    return String(value);

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(value) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


/* =========================================================
   FORMAT MONEY
   ========================================================= */

function formatMoney(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "—";

    }


    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {

        return `${value} EGP`;

    }


    return (
        number.toLocaleString() +
        " EGP"
    );

}


/* =========================================================
   NORMALIZE STATUS
   ========================================================= */

function normalizeStatus(
    status
) {

    return String(
        status || "unknown"
    )
        .trim()
        .toLowerCase();

}


/* =========================================================
   REQUIRE ACTIVE SESSION
   ========================================================= */

async function requireSession() {

    const result =
        await supabaseClient
            .auth
            .getSession();


    if (result.error) {

        throw result.error;

    }


    const session =
        result.data &&
        result.data.session;


    /* -----------------------------------------------------
       No session
       ----------------------------------------------------- */

    if (!session) {

        const target =
            encodeURIComponent(
                window.location.pathname +
                window.location.search
            );


        window.location.href =
            `/?redirect=${target}`;


        return false;

    }


    currentUser =
        session.user;


    return true;

}


/* =========================================================
   LOAD USER PROFILE
   ========================================================= */

async function loadProfile() {

    const result =
        await supabaseClient
            .from("profiles")
            .select("*")
            .eq(
                "id",
                currentUser.id
            )
            .maybeSingle();


    if (result.error) {

        throw result.error;

    }


    /*
     * Some versions of the database may use
     * profiles.id = auth.users.id.
     *
     * The existing NSC system uses that structure.
     */

    if (!result.data) {

        throw new Error(
            "Your profile was not found."
        );

    }


    currentProfile =
        result.data;


    /* =====================================================
       PERSONAL INFORMATION
       ===================================================== */

    const fullName =
        result.data.full_name ||
        result.data.name ||
        "";


    const specialty =
        result.data.specialty ||
        "";


    $("fullName").value =
        fullName;


    $("email").value =
        currentUser.email ||
        result.data.email ||
        "";


    $("specialty").value =
        specialty;


    /* =====================================================
       SUBSCRIPTION INFORMATION
       ===================================================== */

    const status =
        normalizeStatus(
            result.data.status ||
            result.data.subscription_status
        );


    const displayStatus =
        result.data.status ||
        result.data.subscription_status;


    $("subStatus").textContent =
        safeText(
            displayStatus
        );


    $("statusBadge").textContent =
        safeText(
            displayStatus
        );


    if (
        [
            "approved",
            "pending",
            "expired",
            "suspended"
        ].includes(status)
    ) {

        $("statusBadge").className =
            `badge ${status}`;

    } else {

        $("statusBadge").className =
            "badge unknown";

    }


    /* -----------------------------------------------------
       Duration
       ----------------------------------------------------- */

    $("subDuration").textContent =
        result.data.subscription_duration_months
            ? `${result.data.subscription_duration_months} month(s)`
            : "—";


    /* -----------------------------------------------------
       Price
       ----------------------------------------------------- */

    $("subPrice").textContent =
        formatMoney(
            result.data.subscription_price ??
            result.data.price
        );


    /* -----------------------------------------------------
       Start Date
       ----------------------------------------------------- */

    $("subStart").textContent =
        formatDate(
            result.data.subscription_start
        );


    /* -----------------------------------------------------
       End Date
       ----------------------------------------------------- */

    $("subEnd").textContent =
        formatDate(
            result.data.subscription_end
        );


    /* -----------------------------------------------------
       Payment Status
       ----------------------------------------------------- */

    $("subPayment").textContent =
        safeText(
            result.data.payment_status
        );


    /* =====================================================
       EXTRA CLIENT-SIDE EXPIRY CHECK
       ===================================================== */

    if (
        result.data.subscription_end
    ) {

        const endDate =
            new Date(
                result.data.subscription_end +
                "T23:59:59"
            );


        if (
            !Number.isNaN(
                endDate.getTime()
            ) &&
            new Date() > endDate
        ) {

            $("subStatus").textContent =
                "Expired";


            $("statusBadge").textContent =
                "Expired";


            $("statusBadge").className =
                "badge expired";

        }

    }

}


/* =========================================================
   SAVE PROFILE
   ========================================================= */

async function saveProfile(
    event
) {

    event.preventDefault();


    clearMessage();


    const fullName =
        $("fullName")
            .value
            .trim();


    const specialty =
        $("specialty")
            .value
            .trim();


    /* -----------------------------------------------------
       Validation
       ----------------------------------------------------- */

    if (!fullName) {

        showMessage(
            "Please enter your full name.",
            "err"
        );


        return;

    }


    /* =====================================================
       UPDATE ONLY EDITABLE PROFILE FIELDS
       ===================================================== */

    const result =
        await supabaseClient
            .from("profiles")
            .update({

                full_name:
                    fullName,

                specialty:
                    specialty

            })
            .eq(
                "id",
                currentUser.id
            );


    if (result.error) {

        console.error(
            "Profile update error:",
            result.error
        );


        showMessage(
            result.error.message ||
            "Unable to save your profile.",
            "err"
        );


        return;

    }


    /* -----------------------------------------------------
       Update local state
       ----------------------------------------------------- */

    currentProfile = {

        ...currentProfile,

        full_name:
            fullName,

        specialty:
            specialty

    };


    showMessage(
        "Profile updated successfully.",
        "ok"
    );

}


/* =========================================================
   CHANGE PASSWORD
   ========================================================= */

async function changePassword(
    event
) {

    event.preventDefault();


    clearMessage();


    const password =
        $("newPassword")
            .value;


    const confirmPassword =
        $("confirmPassword")
            .value;


    /* -----------------------------------------------------
       Password length
       ----------------------------------------------------- */

    if (
        password.length < 6
    ) {

        showMessage(
            "Password must be at least 6 characters.",
            "err"
        );


        return;

    }


    /* -----------------------------------------------------
       Password confirmation
       ----------------------------------------------------- */

    if (
        password !==
        confirmPassword
    ) {

        showMessage(
            "Passwords do not match.",
            "err"
        );


        return;

    }


    /* =====================================================
       UPDATE SUPABASE AUTH PASSWORD
       ===================================================== */

    const result =
        await supabaseClient
            .auth
            .updateUser({

                password:
                    password

            });


    if (result.error) {

        console.error(
            "Password update error:",
            result.error
        );


        showMessage(
            result.error.message ||
            "Unable to change your password.",
            "err"
        );


        return;

    }


    /* -----------------------------------------------------
       Clear password fields
       ----------------------------------------------------- */

    $("passwordForm")
        .reset();


    showMessage(
        "Password changed successfully.",
        "ok"
    );

}


/* =========================================================
   LOAD RENEWAL REQUESTS
   ========================================================= */

async function loadRenewalRequests() {

    const container =
        $("requestsList");


    if (!container) {
        return;
    }


    const result =
        await supabaseClient
            .from("subscription_requests")
            .select(
                "id,request_type,message,status,created_at"
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (result.error) {

        console.error(
            "Renewal requests error:",
            result.error
        );


        container.innerHTML =
            `
            <div class="empty">
                Unable to load renewal requests.
            </div>
            `;


        return;

    }


    const requests =
        result.data || [];


    /* -----------------------------------------------------
       No requests
       ----------------------------------------------------- */

    if (
        requests.length === 0
    ) {

        container.innerHTML =
            `
            <div class="empty">
                No renewal requests yet.
            </div>
            `;


        return;

    }


    /* =====================================================
       DISPLAY REQUESTS
       ===================================================== */

    container.innerHTML =
        requests
            .map(
                function (request) {

                    const status =
                        normalizeStatus(
                            request.status
                        );


                    const message =
                        request.message
                            ? " · " +
                              safeText(
                                  request.message
                              )
                            : "";


                    return `
                        <div class="request-row">

                            <div class="request-main">

                                <strong>
                                    Subscription Renewal
                                </strong>

                                <span>
                                    ${formatDate(
                                        request.created_at
                                    )}
                                    ${message}
                                </span>

                            </div>

                            <span
                                class="request-status ${status}"
                            >
                                ${safeText(
                                    request.status
                                )}
                            </span>

                        </div>
                    `;

                }
            )
            .join("");


    /* =====================================================
       PREVENT DUPLICATE PENDING REQUESTS
       ===================================================== */

    const hasPendingRequest =
        requests.some(
            function (request) {

                return (
                    request.status ===
                    "pending"
                );

            }
        );


    const renewButton =
        $("renewBtn");


    if (renewButton) {

        renewButton.disabled =
            hasPendingRequest;


        renewButton.style.opacity =
            hasPendingRequest
                ? ".55"
                : "1";

    }


    const renewalState =
        $("renewalState");


    if (
        hasPendingRequest &&
        renewalState
    ) {

        renewalState.textContent =
            "You already have a pending renewal request.";


        renewalState.className =
            "renewal-state warn";

    }

}


/* =========================================================
   OPEN RENEWAL MODAL
   ========================================================= */

function openRenewModal() {

    $("renewMessage").value =
        "";


    $("renewModal")
        .classList
        .remove(
            "hidden"
        );

}


/* =========================================================
   CLOSE RENEWAL MODAL
   ========================================================= */

function closeRenewModal() {

    $("renewModal")
        .classList
        .add(
            "hidden"
        );

}


/* =========================================================
   SEND RENEWAL REQUEST
   ========================================================= */

async function sendRenewal() {

    const button =
        $("sendRenewBtn");


    button.disabled =
        true;


    button.textContent =
        "Sending...";


    const message =
        $("renewMessage")
            .value
            .trim();


    /* =====================================================
       INSERT REQUEST
       ===================================================== */

    const result =
        await supabaseClient
            .from("subscription_requests")
            .insert({

                user_id:
                    currentUser.id,

                request_type:
                    "renewal",

                message:
                    message || null,

                status:
                    "pending"

            });


    button.disabled =
        false;


    button.textContent =
        "Send Request";


    /* -----------------------------------------------------
       Error
       ----------------------------------------------------- */

    if (result.error) {

        console.error(
            "Renewal request error:",
            result.error
        );


        showMessage(
            result.error.message ||
            "Unable to send renewal request.",
            "err"
        );


        return;

    }


    /* -----------------------------------------------------
       Close modal
       ----------------------------------------------------- */

    closeRenewModal();


    /* -----------------------------------------------------
       Success message
       ----------------------------------------------------- */

    const state =
        $("renewalState");


    if (state) {

        state.textContent =
            "Renewal request submitted successfully.";


        state.className =
            "renewal-state ok";

    }


    /* -----------------------------------------------------
       Reload request list
       ----------------------------------------------------- */

    await loadRenewalRequests();

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    try {

        await supabaseClient
            .auth
            .signOut();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    }


    window.location.href =
        "/";

}


/* =========================================================
   INITIALIZE PAGE
   ========================================================= */

async function initializeProfilePage() {

    try {

        /* -------------------------------------------------
           Verify authentication
           ------------------------------------------------- */

        const authenticated =
            await requireSession();


        if (!authenticated) {

            return;

        }


        /* -------------------------------------------------
           Load profile
           ------------------------------------------------- */

        await loadProfile();


        /* -------------------------------------------------
           Load renewal requests
           ------------------------------------------------- */

        await loadRenewalRequests();

    } catch (error) {

        console.error(
            "Profile initialization error:",
            error
        );


        showMessage(
            error.message ||
            "Unable to load your profile.",
            "err"
        );

    }

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

document
    .getElementById(
        "profileForm"
    )
    ?.addEventListener(
        "submit",
        saveProfile
    );


document
    .getElementById(
        "passwordForm"
    )
    ?.addEventListener(
        "submit",
        changePassword
    );


document
    .getElementById(
        "renewBtn"
    )
    ?.addEventListener(
        "click",
        openRenewModal
    );


document
    .getElementById(
        "closeRenewModal"
    )
    ?.addEventListener(
        "click",
        closeRenewModal
    );


document
    .getElementById(
        "cancelRenewBtn"
    )
    ?.addEventListener(
        "click",
        closeRenewModal
    );


document
    .getElementById(
        "sendRenewBtn"
    )
    ?.addEventListener(
        "click",
        sendRenewal
    );


document
    .getElementById(
        "logoutBtn"
    )
    ?.addEventListener(
        "click",
        logout
    );


/* ---------------------------------------------------------
   Close modal when clicking backdrop
   --------------------------------------------------------- */

document
    .getElementById(
        "renewModal"
    )
    ?.addEventListener(
        "click",
        function (event) {

            if (
                event.target &&
                event.target.dataset &&
                event.target.dataset.close
            ) {

                closeRenewModal();

            }

        }
    );


/* =========================================================
   START
   ========================================================= */

initializeProfilePage();
