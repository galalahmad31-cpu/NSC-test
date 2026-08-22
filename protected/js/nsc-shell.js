/* =========================================================
   NSC NAVIGATION CLICK HANDLER
   FIXED VERSION
   ========================================================= */

function initNSCNavigation() {

    const nav = document.getElementById(
        'nsc-main-nav'
    );

    if (!nav) {
        console.error(
            'NSC: Main navigation not found.'
        );
        return;
    }

    /*
     * Prevent duplicate listeners if initialization
     * happens more than once.
     */
    if (
        nav.dataset.nscNavigationInitialized ===
        'true'
    ) {
        return;
    }

    nav.dataset.nscNavigationInitialized =
        'true';

    nav.addEventListener(
        'click',
        function (event) {

            const button =
                event.target.closest(
                    '.nsc-nav-item'
                );

            if (!button) return;

            event.preventDefault();
            event.stopPropagation();

            const page =
                button.getAttribute(
                    'data-page'
                );

            if (!page) {
                console.error(
                    'NSC: Navigation button has no data-page.'
                );
                return;
            }

            /*
             * Admin authorization is handled
             * inside nscNavigate().
             */

            if (
                typeof window.nscNavigate ===
                'function'
            ) {

                window.nscNavigate(page);

            } else {

                console.error(
                    'NSC: nscNavigate() is not available.'
                );

            }

        },
        false
    );

    /*
     * Keyboard support
     */
    nav.addEventListener(
        'keydown',
        function (event) {

            if (
                event.key !== 'Enter' &&
                event.key !== ' '
            ) {
                return;
            }

            const button =
                event.target.closest(
                    '.nsc-nav-item'
                );

            if (!button) return;

            event.preventDefault();

            const page =
                button.getAttribute(
                    'data-page'
                );

            if (
                page &&
                typeof window.nscNavigate ===
                'function'
            ) {

                window.nscNavigate(page);

            }

        },
        false
    );

    console.log(
        'NSC Navigation initialized.'
    );
}


/* =========================================================
   LIBRARY / ABOUT SUPPORT
   ========================================================= */

function nscNavigateStaticPage(page) {

    setLegacy('none');

    setActivePage(page);

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


/* =========================================================
   PATCH NAVIGATION
   ========================================================= */

const nscShellNavigate =
    window.nscNavigate;

if (
    typeof nscShellNavigate ===
    'function'
) {

    window.nscNavigate =
        async function (page) {

            /*
             * Library and About are static
             * shell pages.
             */

            if (
                page === 'library' ||
                page === 'about'
            ) {

                nscNavigateStaticPage(
                    page
                );

                return;
            }

            /*
             * All other pages continue
             * through the original navigation
             * function.
             */

            return nscShellNavigate(
                page
            );
        };
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

    /*
     * IMPORTANT:
     * Navigation MUST be initialized before
     * the user can interact with the shell.
     */

    try {

        initNSCNavigation();

    } catch (e) {

        console.error(
            'NSC navigation initialization failed:',
            e
        );

    }

    /*
     * Existing authentication/profile logic
     * remains unchanged.
     */

    try {

        await getProfile();

    } catch (e) {

        console.error(
            'NSC profile initialization failed:',
            e
        );

    }

    /*
     * Existing clinical engine observer.
     */

    try {

        observeLegacy();

    } catch (e) {

        console.error(
            'NSC legacy observer failed:',
            e
        );

    }

    /*
     * Start on Home.
     */

    setActivePage(
        'home'
    );

    /*
     * Load dashboard.
     */

    try {

        await nscLoadHome();

    } catch (e) {

        console.error(
            'NSC home loading failed:',
            e
        );

        nscToast(
            e.message ||
            'Unable to load dashboard.',
            'error'
        );

    }
}


/* =========================================================
   DOM READY
   ========================================================= */

if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        init,
        {
            once: true
        }
    );

} else {

    setTimeout(
        init,
        0
    );

}
