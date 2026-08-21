/* =========================================================
   Nutrition Support Calculator
   Supabase Authentication + Account Approval + Subscription

   SYSTEM:
   - No users.js
   - No device binding
   - Customer can create an account
   - New accounts are "pending"
   - Only "approved" accounts can access NSC.html
   - subscription_end controls expiry
   ========================================================= */

(function () {

    "use strict";


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


    /*
     * Make the client available globally.
     * This can also be used by NSC.html later.
     */

    window.NSC_SUPABASE =
        supabaseClient;


    /* =========================================================
       HELPER
       Display message
       ========================================================= */

    function showMessage(
        text,
        color
    ) {

        const message =
            document.getElementById(
                "message"
            );


        if (!message) {
            return;
        }


        message.textContent =
            text;


        message.style.color =
            color;

    }


    /* =========================================================
       HELPER
       Normalize Email
       ========================================================= */

    function normalizeEmail(email) {

        return (
            email || ""
        )
            .trim()
            .toLowerCase();

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
                "Supabase sign-out error:",
                error
            );

        }


        sessionStorage.removeItem(
            "user_authenticated"
        );


        sessionStorage.removeItem(
            "authenticated_email"
        );


        window.location.replace("/");

    }


    /* =========================================================
       GET USER PROFILE
       ========================================================= */

    async function getProfile(
        userId
    ) {

        const result =
            await supabaseClient
                .from("profiles")
                .select(
                    "id,email,status,subscription_end"
                )
                .eq(
                    "id",
                    userId
                )
                .maybeSingle();


        if (result.error) {

            throw result.error;

        }


        return result.data;

    }


    /* =========================================================
       CHECK ACCOUNT ACCESS
       ========================================================= */

    async function checkAccountAccess(
        user
    ) {

        if (
            !user ||
            !user.id
        ) {

            return {

                allowed: false,

                message:
                    "You are not signed in."

            };

        }


        /* -----------------------------------------------------
           Get profile
           ----------------------------------------------------- */

        const profile =
            await getProfile(
                user.id
            );


        if (!profile) {

            return {

                allowed: false,

                message:
                    "Your account profile is not available yet. Please contact the administrator."

            };

        }


        /* =====================================================
           ACCOUNT STATUS
           ===================================================== */


        /* -----------------------------------------------------
           PENDING
           ----------------------------------------------------- */

        if (
            profile.status ===
            "pending"
        ) {

            return {

                allowed: false,

                message:
                    "Your account has been created successfully, but it is still pending activation. Please contact us via WhatsApp to activate your subscription."

            };

        }


        /* -----------------------------------------------------
           SUSPENDED
           ----------------------------------------------------- */

        if (
            profile.status ===
            "suspended"
        ) {

            return {

                allowed: false,

                message:
                    "Your account is currently suspended. Please contact the administrator."

            };

        }


        /* -----------------------------------------------------
           APPROVED
           ----------------------------------------------------- */

        if (
            profile.status !==
            "approved"
        ) {

            return {

                allowed: false,

                message:
                    "Your account is not approved for access yet."

            };

        }


        /* =====================================================
           SUBSCRIPTION
           ===================================================== */


        /* -----------------------------------------------------
           No subscription date
           ----------------------------------------------------- */

        if (
            !profile.subscription_end
        ) {

            return {

                allowed: false,

                message:
                    "Your account is approved, but no subscription end date has been assigned yet."

            };

        }


        /* -----------------------------------------------------
           Parse expiration date
           ----------------------------------------------------- */

        const expireDate =
            new Date(
                profile.subscription_end +
                "T23:59:59"
            );


        if (
            Number.isNaN(
                expireDate.getTime()
            )
        ) {

            return {

                allowed: false,

                message:
                    "Your subscription end date is invalid. Please contact the administrator."

            };

        }


        /* -----------------------------------------------------
           Expired
           ----------------------------------------------------- */

        if (
            new Date() >
            expireDate
        ) {

            return {

                allowed: false,

                message:
                    "Your subscription has expired. Please contact the administrator for renewal."

            };

        }


        /* -----------------------------------------------------
           Everything OK
           ----------------------------------------------------- */

        return {

            allowed: true,

            profile:
                profile

        };

    }


    /* =========================================================
       LOGIN
       ========================================================= */

    async function login(
        email,
        password
    ) {

        const result =
            await supabaseClient
                .auth
                .signInWithPassword({

                    email:
                        email,

                    password:
                        password

                });


        /* -----------------------------------------------------
           Supabase error
           ----------------------------------------------------- */

        if (
            result.error
        ) {

            throw result.error;

        }


        const user =
            result.data &&
            result.data.user;


        if (!user) {

            throw new Error(
                "No authenticated user was returned."
            );

        }


        /* -----------------------------------------------------
           Check approval + subscription
           ----------------------------------------------------- */

        const access =
            await checkAccountAccess(
                user
            );


        if (
            !access.allowed
        ) {

            await supabaseClient
                .auth
                .signOut();


            throw new Error(
                access.message
            );

        }


        /* -----------------------------------------------------
           Compatibility session
           ----------------------------------------------------- */

        sessionStorage.setItem(
            "user_authenticated",
            "true"
        );


        sessionStorage.setItem(
            "authenticated_email",
            normalizeEmail(
                user.email
            )
        );


        return access;

    }


    /* =========================================================
       SIGN UP
       ========================================================= */

    async function signUp(
        email,
        password
    ) {

        const result =
            await supabaseClient
                .auth
                .signUp({

                    email:
                        email,

                    password:
                        password

                });


        if (
            result.error
        ) {

            throw result.error;

        }


        /*
         * Database trigger automatically creates:
         *
         * profiles.status = "pending"
         */

        return result.data;

    }


    /* =========================================================
       LOGIN / SIGNUP PAGE
       ========================================================= */

    function setupLoginPage() {

        const loginForm =
            document.getElementById(
                "login-form"
            );


        const signupForm =
            document.getElementById(
                "signup-form"
            );


        const toggleButton =
            document.getElementById(
                "toggle-auth"
            );


        const authTitle =
            document.getElementById(
                "auth-title"
            );


        const authSubtitle =
            document.getElementById(
                "auth-subtitle"
            );


        if (
            !loginForm ||
            !signupForm
        ) {

            return;

        }


        let signupMode =
            false;


        /* =====================================================
           CHANGE LOGIN / SIGNUP MODE
           ===================================================== */

        function setMode(
            isSignup
        ) {

            signupMode =
                isSignup;


            loginForm.style.display =
                isSignup
                    ? "none"
                    : "";


            signupForm.style.display =
                isSignup
                    ? ""
                    : "none";


            if (authTitle) {

                authTitle.textContent =
                    isSignup
                        ? "Create Your Account"
                        : "Subscriber Login";

            }


            if (authSubtitle) {

                authSubtitle.textContent =
                    isSignup
                        ? "Create an account, then contact us to activate your subscription."
                        : "Enter your email and password to access the calculator.";

            }


            if (toggleButton) {

                toggleButton.textContent =
                    isSignup
                        ? "Already have an account? LOGIN"
                        : "Create a new account";

            }


            showMessage(
                "",
                "#2563eb"
            );

        }


        /* =====================================================
           TOGGLE BUTTON
           ===================================================== */

        if (toggleButton) {

            toggleButton.addEventListener(
                "click",
                function () {

                    setMode(
                        !signupMode
                    );

                }
            );

        }


        /* =====================================================
           LOGIN SUBMIT
           ===================================================== */

        loginForm.addEventListener(
            "submit",
            async function (
                event
            ) {

                event.preventDefault();


                const email =
                    normalizeEmail(
                        document
                            .getElementById(
                                "email"
                            )
                            .value
                    );


                const password =
                    document
                        .getElementById(
                            "password"
                        )
                        .value;


                if (
                    !email ||
                    !password
                ) {

                    showMessage(
                        "Please enter your email and password.",
                        "#dc2626"
                    );

                    return;

                }


                showMessage(
                    "Signing in...",
                    "#2563eb"
                );


                try {

                    await login(
                        email,
                        password
                    );


                    showMessage(
                        "Login successful. Opening calculator...",
                        "#0F766E"
                    );


                    window.location.href =
                        "/protected/NSC.html";


                } catch (
                    error
                ) {

                    console.error(
                        "Supabase login error:",
                        error
                    );


                    showMessage(
                        error.message ||
                        "Unable to sign in.",
                        "#dc2626"
                    );

                }

            }
        );


        /* =====================================================
           SIGN UP SUBMIT
           ===================================================== */

        signupForm.addEventListener(
            "submit",
            async function (
                event
            ) {

                event.preventDefault();


                const email =
                    normalizeEmail(
                        document
                            .getElementById(
                                "signup-email"
                            )
                            .value
                    );


                const password =
                    document
                        .getElementById(
                            "signup-password"
                        )
                        .value;


                const confirmPassword =
                    document
                        .getElementById(
                            "signup-password-confirm"
                        )
                        .value;


                /* -------------------------------------------------
                   Password confirmation
                   ------------------------------------------------- */

                if (
                    password !==
                    confirmPassword
                ) {

                    showMessage(
                        "Passwords do not match.",
                        "#dc2626"
                    );

                    return;

                }


                /* -------------------------------------------------
                   Minimum password length
                   ------------------------------------------------- */

                if (
                    password.length < 6
                ) {

                    showMessage(
                        "Password must be at least 6 characters.",
                        "#dc2626"
                    );

                    return;

                }


                showMessage(
                    "Creating your account...",
                    "#2563eb"
                );


                try {

                    const data =
                        await signUp(
                            email,
                            password
                        );


                    /*
                     * Confirm Email is OFF.
                     *
                     * Supabase may return an active session.
                     *
                     * We immediately sign out because
                     * the new account is still PENDING.
                     */

                    if (
                        data &&
                        data.session
                    ) {

                        await supabaseClient
                            .auth
                            .signOut();

                    }


                    showMessage(
                        "Account created successfully. Please contact us via WhatsApp to activate your subscription.",
                        "#0F766E"
                    );


                    signupForm.reset();


                } catch (
                    error
                ) {

                    console.error(
                        "Supabase sign-up error:",
                        error
                    );


                    let text =
                        error.message ||
                        "Unable to create the account.";


                    if (
                        error.message &&
                        error.message
                            .toLowerCase()
                            .includes(
                                "already registered"
                            )
                    ) {

                        text =
                            "This email is already registered. Please use LOGIN.";

                    }


                    showMessage(
                        text,
                        "#dc2626"
                    );

                }

            }
        );

    }


    /* =========================================================
       PROTECT NSC APPLICATION
       ========================================================= */

    async function protectApplication() {

        const result =
            await supabaseClient
                .auth
                .getSession();


        if (
            result.error
        ) {

            console.error(
                "Session error:",
                result.error
            );


            await logout();

            return;

        }


        const session =
            result.data.session;


        /* -----------------------------------------------------
           No session
           ----------------------------------------------------- */

        if (!session) {

            await logout();

            return;

        }


        try {

            const access =
                await checkAccountAccess(
                    session.user
                );


            if (
                !access.allowed
            ) {

                alert(
                    access.message
                );


                await logout();

                return;

            }


            /* -------------------------------------------------
               Compatibility session
               ------------------------------------------------- */

            sessionStorage.setItem(
                "user_authenticated",
                "true"
            );


            sessionStorage.setItem(
                "authenticated_email",
                normalizeEmail(
                    session.user.email
                )
            );


        } catch (
            error
        ) {

            console.error(
                "Account access error:",
                error
            );


            alert(
                "Unable to verify your account. Please try again."
            );


            await logout();

            return;

        }


        /* =====================================================
           PERIODIC CHECK
           ===================================================== */

        setInterval(
            async function () {

                try {

                    const current =
                        await supabaseClient
                            .auth
                            .getSession();


                    const currentSession =
                        current.data &&
                        current.data.session;


                    if (
                        !currentSession
                    ) {

                        await logout();

                        return;

                    }


                    const access =
                        await checkAccountAccess(
                            currentSession.user
                        );


                    if (
                        !access.allowed
                    ) {

                        alert(
                            access.message
                        );


                        await logout();

                    }

                } catch (
                    error
                ) {

                    console.error(
                        "Periodic account check error:",
                        error
                    );

                }

            },
            60000
        );


        /* =====================================================
           CHECK WHEN RETURNING TO APP
           ===================================================== */

        document.addEventListener(
            "visibilitychange",
            async function () {

                if (
                    document.hidden
                ) {

                    return;

                }


                try {

                    const current =
                        await supabaseClient
                            .auth
                            .getSession();


                    const currentSession =
                        current.data &&
                        current.data.session;


                    if (
                        !currentSession
                    ) {

                        await logout();

                        return;

                    }


                    const access =
                        await checkAccountAccess(
                            currentSession.user
                        );


                    if (
                        !access.allowed
                    ) {

                        alert(
                            access.message
                        );


                        await logout();

                    }

                } catch (
                    error
                ) {

                    console.error(
                        "Visibility account check error:",
                        error
                    );

                }

            }
        );

    }


    /* =========================================================
       INITIALIZE
       ========================================================= */

    async function initialize() {

        /*
         * If login + signup forms exist,
         * this is the login page.
         */

        if (
            document.getElementById(
                "login-form"
            ) &&
            document.getElementById(
                "signup-form"
            )
        ) {

            setupLoginPage();

            return;

        }


        /*
         * Otherwise this is a protected page.
         */

        await protectApplication();

    }


    /* =========================================================
       START
       ========================================================= */

    initialize();

})();
