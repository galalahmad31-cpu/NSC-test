/* =========================================================
   NSC APP SHELL V2
   Navigation / Dashboard / Patients / Notifications /
   Finances / Settings / Admin
   The original clinical engine remains untouched.
   ========================================================= */

(function () {
    'use strict';

    const state = {
        page: 'home',
        patientFilter: 'all',
        financeFilter: 'all',
        patients: [],
        visits: [],
        profile: null,
        user: null,
        financeRows: [],
        admin: false
    };

    const $ = id => document.getElementById(id);

    const esc = v =>
        String(v ?? '').replace(/[&<>'"]/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#039;',
            '"': '&quot;'
        }[m]));

    const today = () =>
        new Date().toISOString().slice(0, 10);

    const dateObj = d => {
        const x = new Date((d || '') + 'T00:00:00');
        return isNaN(x) ? null : x;
    };

    const daysBetween = (a, b) =>
        Math.round(
            (dateObj(b) - dateObj(a)) / 86400000
        );

    function db() {
        if (!window.NSC_SUPABASE) {
            throw new Error(
                'Supabase client is not available.'
            );
        }

        return window.NSC_SUPABASE;
    }

    async function user() {
        if (state.user) return state.user;

        const { data, error } =
            await db().auth.getUser();

        if (error) throw error;

        if (!data?.user) {
            throw new Error(
                'No authenticated user found.'
            );
        }

        state.user = data.user;

        return state.user;
    }

    async function getProfile() {

        const u = await user();

        const { data, error } =
            await db()
                .from('profiles')
                .select('*')
                .eq('id', u.id)
                .maybeSingle();

        if (error) throw error;

        state.profile = data || {};

        state.admin =
            String(state.profile.role || '')
                .toLowerCase() === 'admin';

        $('nsc-admin-nav')
            ?.classList
            .toggle('hidden', !state.admin);

        return state.profile;
    }

    function setLegacy(mode) {

        document.body.classList.remove(
            'nsc-legacy-visible',
            'nsc-detail-active',
            'nsc-visit-active'
        );

        if (mode === 'detail') {

            document.body.classList.add(
                'nsc-legacy-visible',
                'nsc-detail-active'
            );

        }

        if (mode === 'visit') {

            document.body.classList.add(
                'nsc-legacy-visible',
                'nsc-visit-active'
            );

        }
    }

    function setActivePage(page) {

        state.page = page;

        document
            .querySelectorAll('.nsc-nav-item')
            .forEach(btn => {

                btn.classList.toggle(
                    'active',
                    btn.dataset.page === page
                );

            });

        document
            .querySelectorAll('.nsc-page')
            .forEach(pageElement => {

                pageElement.classList.toggle(
                    'active',
                    pageElement.id ===
                    'nsc-page-' + page
                );

            });

        document
            .querySelector('.nsc-nav-item.active')
            ?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
    }

    window.nscNavigate = async function (page) {

        if (page === 'admin' && !state.admin) {

            alert('Admin access only.');

            return;
        }

        setLegacy('none');

        setActivePage(page);

        try {

            if (page === 'home') {
                await nscLoadHome();
            }

            if (page === 'patients') {

                await nscLoadPatients();

                nscShowPatientDirectory();
            }

            if (page === 'notifications') {
                await nscLoadNotifications();
            }

            if (page === 'finances') {
                await nscLoadFinances();
            }

            if (page === 'settings') {
                await nscLoadSettings();
            }

            if (page === 'admin') {
                await nscLoadAdmin();
            }

            if (page === 'quickcalc') {
                nscShowQuickCalc();
            }

        } catch (e) {

            console.error(e);

            nscToast(
                e.message ||
                'Unable to load this page.',
                'error'
            );
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    function nscShowPatientDirectory() {

        setLegacy('none');

        $('nsc-page-patients')
            ?.classList
            .add('active');
    }

    function nscHidePagesForLegacy(mode) {

        document
            .querySelectorAll('.nsc-page')
            .forEach(p =>
                p.classList.remove('active')
            );

        setLegacy(mode);
    }

    function nscShowQuickCalc() {

        setLegacy('none');

        const host =
            $('nsc-quickcalc-host');

        const ref =
            $('section-ref');

        if (ref && host) {

            host.appendChild(ref);

            ref.classList.remove('hidden');

            const enter =
                $('sub-content-enteral');

            const pn =
                $('sub-content-parenteral');

            const qc =
                $('sub-content-quick-calc');

            enter?.classList.add('hidden');

            pn?.classList.add('hidden');

            qc?.classList.remove('hidden');

            $('sub-tab-enteral')
                ?.classList
                .remove('active');

            $('sub-tab-parenteral')
                ?.classList
                .remove('active');

            $('sub-tab-quick-calc')
                ?.classList
                .add('active');
        }
    }

    function nscReturnReferenceHome() {

        const ref =
            $('section-ref');

        const host =
            $('home-reference-content');

        if (
            ref &&
            host &&
            !host.contains(ref)
        ) {
            host.appendChild(ref);
        }
    }

    function nscToast(
        msg,
        type = 'ok'
    ) {

        const el =
            document.createElement('div');

        el.className =
            'nsc-toast ' + type;

        el.textContent = msg;

        document.body.appendChild(el);

        setTimeout(
            () => el.remove(),
            3200
        );
    }

    function normalizeDept(d) {

        return String(d || '')
            .trim()
            .toLowerCase();
    }

    function activePatient(p) {

        if (!p.subscription_end)
            return true;

        return p.subscription_end >= today();
    }

    function expiringPatient(p) {

        if (!p.subscription_end)
            return false;

        const d =
            daysBetween(
                today(),
                p.subscription_end
            );

        return d >= 0 && d <= 7;
    }

    async function nscLoadPatients() {

        const u = await user();

        const {
            data,
            error
        } = await db()
            .from('patients')
            .select('*')
            .eq('user_id', u.id)
            .order(
                'full_name',
                { ascending: true }
            );

        if (error) throw error;

        state.patients = data || [];

        const sel =
            $('nsc-patient-department');

        const current =
            sel?.value || '';

        if (sel) {

            const deps = [
                ...new Set(
                    state.patients
                        .map(p => p.department)
                        .filter(Boolean)
                )
            ].sort();

            sel.innerHTML =
                '<option value="">⌕  All Departments</option>' +
                deps
                    .map(
                        d =>
                            `<option value="${esc(d)}">${esc(d)}</option>`
                    )
                    .join('');

            sel.value = current;
        }

        if ($('nsc-patient-plan')) {

            $('nsc-patient-plan')
                .textContent =
                `Patients: ${state.patients.length}`;
        }

        nscRenderPatients();
    }

    window.nscSetPatientFilter =
        function (f) {

            state.patientFilter = f;

            document
                .querySelectorAll(
                    '#nsc-page-patients .nsc-segment button'
                )
                .forEach(b =>
                    b.classList.toggle(
                        'active',
                        b.dataset.filter === f
                    )
                );

            nscRenderPatients();
        };

    window.nscRenderPatients =
        function () {

            const q =
                String(
                    $('nsc-patient-search')
                        ?.value || ''
                )
                .toLowerCase()
                .trim();

            const dep =
                String(
                    $('nsc-patient-department')
                        ?.value || ''
                );

            let rows =
                state.patients.filter(p =>

                    (
                        !q ||
                        String(
                            p.full_name || ''
                        )
                            .toLowerCase()
                            .includes(q) ||

                        String(
                            p.file_no || ''
                        )
                            .toLowerCase()
                            .includes(q)
                    )

                    &&

                    (
                        !dep ||
                        p.department === dep
                    )
                );

            if (
                state.patientFilter ===
                'current'
            ) {

                rows =
                    rows.filter(
                        activePatient
                    );
            }

            if (
                state.patientFilter ===
                'discharged'
            ) {

                rows =
                    rows.filter(
                        p =>
                            !activePatient(p)
                    );
            }

            const box =
                $('nsc-patient-directory-list');

            if (!box) return;

            if (!rows.length) {

                box.innerHTML =
                    '<div class="nsc-section-card">' +
                    '<div class="nsc-empty">' +
                    'No patients found.' +
                    '</div></div>';

                return;
            }

            box.innerHTML =
                rows
                    .map(
                        p =>

                            `<button
                                class="nsc-patient-row"
                                type="button"
                                data-id="${esc(p.id)}">

                                <div class="nsc-avatar-small">
                                    ${esc(
                                        (
                                            p.full_name ||
                                            '?'
                                        )
                                            .trim()
                                            .charAt(0)
                                            .toUpperCase()
                                    )}
                                </div>

                                <div class="main">

                                    <div class="name">
                                        ${esc(
                                            p.full_name ||
                                            'Unnamed patient'
                                        )}
                                    </div>

                                    <div class="file">
                                        ${esc(
                                            p.file_no ||
                                            'No file number'
                                        )}
                                    </div>

                                </div>

                                <div class="right">

                                    <span>DOB</span>

                                    <b>
                                        ${esc(
                                            p.date_of_birth ||
                                            '—'
                                        )}
                                    </b>

                                </div>

                            </button>`
                    )
                    .join('');

            box
                .querySelectorAll(
                    '.nsc-patient-row'
                )
                .forEach(b => {

                    b.addEventListener(
                        'click',
                        () => {

                            if (
                                typeof window.selectPatient ===
                                'function'
                            ) {

                                window.selectPatient(
                                    b.dataset.id
                                );

                            }

                        }
                    );

                });
        };

    async function nscLoadVisits() {

        const u = await user();

        const {
            data,
            error
        } = await db()
            .from('visits')
            .select('*')
            .eq('user_id', u.id)
            .order(
                'visit_date',
                { ascending: false }
            );

        if (error) throw error;

        state.visits = data || [];
    }

    function latestVisitMap() {

        const m = new Map();

        for (const v of state.visits) {

            if (
                !m.has(v.patient_id) ||
                String(v.visit_date) >
                String(
                    m.get(v.patient_id)
                        .visit_date
                )
            ) {

                m.set(
                    v.patient_id,
                    v
                );
            }
        }

        return m;
    }

    function followupDate(p, v) {

        if (!v?.visit_date)
            return null;

        const d =
            dateObj(v.visit_date);

        if (!d)
            return null;

        d.setDate(
            d.getDate() +
            Number(
                p.follow_up_interval_days ||
                0
            )
        );

        return d
            .toISOString()
            .slice(0, 10);
    }

    async function nscLoadHome() {

        await nscLoadPatients();

        await nscLoadVisits();

        const active =
            state.patients
                .filter(activePatient);

        const depCount =
            k =>
                active.filter(
                    p =>
                        normalizeDept(
                            p.department
                        ) === k
                ).length;

        if ($('nsc-session-date')) {

            $('nsc-session-date')
                .textContent =
                new Date()
                    .toLocaleDateString(
                        undefined,
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    );
        }

        if ($('nsc-stat-active'))
            $('nsc-stat-active')
                .textContent =
                active.length;

        if ($('nsc-stat-nicu'))
            $('nsc-stat-nicu')
                .textContent =
                depCount('nicu');

        if ($('nsc-stat-picu'))
            $('nsc-stat-picu')
                .textContent =
                depCount('picu');

        if ($('nsc-stat-icu'))
            $('nsc-stat-icu')
                .textContent =
                depCount('icu');

        if ($('nsc-stat-ward'))
            $('nsc-stat-ward')
                .textContent =
                depCount('ward');

        if ($('nsc-stat-outpatient'))
            $('nsc-stat-outpatient')
                .textContent =
                depCount('outpatient');

        const newToday =
            state.patients.filter(
                p =>
                    String(
                        p.created_at || ''
                    ).slice(0, 10) ===
                    today()
            ).length;

        if ($('nsc-stat-new'))
            $('nsc-stat-new')
                .textContent =
                newToday;

        if ($('nsc-stat-encounters'))
            $('nsc-stat-encounters')
                .textContent =
                state.visits.filter(
                    v =>
                        String(
                            v.visit_date || ''
                        ) === today()
                ).length;

        const latest =
            latestVisitMap();

        const due =
            state.patients.filter(
                p =>
                    followupDate(
                        p,
                        latest.get(p.id)
                    ) === today()
            );

        const exp =
            state.patients.filter(
                expiringPatient
            );

        const total =
            due.length +
            exp.length;

        if ($('nsc-alert-count'))
            $('nsc-alert-count')
                .textContent =
                `${total} ACTION ITEMS`;

        if ($('nsc-home-alerts')) {

            $('nsc-home-alerts')
                .innerHTML = [

                    ...due.map(
                        p =>
                            `<div class="nsc-alert-row warning">

                                <div>

                                    <div class="title">
                                        ${esc(
                                            p.full_name
                                        )}
                                        <small>
                                            ${esc(
                                                p.department ||
                                                ''
                                            )}
                                        </small>
                                    </div>

                                    <div class="meta">
                                        Follow-up due today ·
                                        File No.
                                        ${esc(
                                            p.file_no ||
                                            '—'
                                        )}
                                    </div>

                                </div>

                                <span>›</span>

                            </div>`
                    ),

                    ...exp.map(
                        p =>
                            `<div class="nsc-alert-row danger">

                                <div>

                                    <div class="title">
                                        ${esc(
                                            p.full_name
                                        )}
                                    </div>

                                    <div class="meta">
                                        Subscription expires
                                        ${esc(
                                            p.subscription_end
                                        )}
                                    </div>

                                </div>

                                <span>›</span>

                            </div>`
                    )

                ].join('') ||

                '<div class="nsc-empty">' +
                'No action items.' +
                '</div>';
        }

        if ($('nsc-home-recent')) {

            $('nsc-home-recent')
                .innerHTML =
                state.patients
                    .slice(0, 6)
                    .map(
                        p =>
                            `<div class="nsc-recent-row">

                                <div>

                                    <div class="title">
                                        ${esc(
                                            p.full_name ||
                                            'Unnamed'
                                        )}
                                    </div>

                                    <div class="meta">
                                        ${esc(
                                            p.department ||
                                            'No department'
                                        )}
                                        · File No.
                                        ${esc(
                                            p.file_no ||
                                            '—'
                                        )}
                                    </div>

                                </div>

                                <span>›</span>

                            </div>`
                    )
                    .join('') ||

                '<div class="nsc-empty">' +
                'No patients yet.' +
                '</div>';
        }

        if ($('nsc-notification-badge')) {

            $('nsc-notification-badge')
                .textContent =
                total;

            $('nsc-notification-badge')
                .classList
                .toggle(
                    'hidden',
                    !total
                );
        }
    }

    async function nscLoadNotifications() {

        await nscLoadPatients();

        await nscLoadVisits();

        const latest =
            latestVisitMap();

        const due =
            state.patients.filter(
                p =>
                    followupDate(
                        p,
                        latest.get(p.id)
                    ) === today()
            );

        const exp =
            state.patients.filter(
                expiringPatient
            );

        if ($('nsc-followup-count'))
            $('nsc-followup-count')
                .textContent =
                due.length;

        if ($('nsc-followup-list')) {

            $('nsc-followup-list')
                .innerHTML =
                due.map(
                    p =>
                        `<div class="nsc-alert-row warning">

                            <div>

                                <div class="title">
                                    ${esc(
                                        p.full_name
                                    )}
                                </div>

                                <div class="meta">
                                    File No.
                                    ${esc(
                                        p.file_no ||
                                        '—'
                                    )}
                                    · Follow-up today
                                </div>

                            </div>

                        </div>`
                )
                .join('') ||

                '<div class="nsc-empty">' +
                'No follow-ups today.' +
                '</div>';
        }

        if ($('nsc-expiry-list')) {

            $('nsc-expiry-list')
                .innerHTML =
                exp.map(
                    p => {

                        const days =
                            daysBetween(
                                today(),
                                p.subscription_end
                            );

                        return `
                            <div class="nsc-alert-row danger">

                                <div>

                                    <div class="title">
                                        ${esc(
                                            p.full_name
                                        )}
                                    </div>

                                    <div class="meta">
                                        Expires
                                        ${esc(
                                            p.subscription_end
                                        )}
                                        ·
                                        ${
                                            days === 0
                                            ? 'Today'
                                            : days +
                                              ' day(s) remaining'
                                        }
                                    </div>

                                </div>

                            </div>
                        `;
                    }
                )
                .join('') ||

                '<div class="nsc-empty">' +
                'No subscriptions expiring within 7 days.' +
                '</div>';
        }

        const count =
            due.length +
            exp.length;

        if ($('nsc-notification-badge')) {

            $('nsc-notification-badge')
                .textContent =
                count;

            $('nsc-notification-badge')
                .classList
                .toggle(
                    'hidden',
                    count === 0
                );
        }
    }

    async function nscLoadFinances() {

        await nscLoadPatients();

        state.financeRows =
            state.patients.map(
                p => ({
                    p,
                    status:
                        activePatient(p)
                        ? (
                            expiringPatient(p)
                            ? 'expiring'
                            : 'active'
                        )
                        : 'expired'
                })
            );

        const rows =
            state.financeRows;

        const active =
            rows.filter(
                r =>
                    r.status !== 'expired'
            );

        const paid =
            rows.filter(
                r =>
                    String(
                        r.p.payment_status ||
                        ''
                    )
                        .toLowerCase() ===
                    'paid'
            );

        const pending =
            rows.filter(
                r =>
                    String(
                        r.p.payment_status ||
                        ''
                    )
                        .toLowerCase() !==
                    'paid'
            );

        const exp =
            rows.filter(
                r =>
                    r.status === 'expiring'
            );

        if ($('nsc-fin-active'))
            $('nsc-fin-active')
                .textContent =
                active.length;

        if ($('nsc-fin-collected'))
            $('nsc-fin-collected')
                .textContent =
                paid
                    .reduce(
                        (s, r) =>
                            s +
                            Number(
                                r.p.final_price ||
                                0
                            ),
                        0
                    )
                    .toLocaleString() +
                ' EGP';

        if ($('nsc-fin-pending'))
            $('nsc-fin-pending')
                .textContent =
                pending.length;

        if ($('nsc-fin-expiring'))
            $('nsc-fin-expiring')
                .textContent =
                exp.length;

        nscRenderFinances();
    }

    window.nscSetFinanceFilter =
        function (f) {

            state.financeFilter = f;

            document
                .querySelectorAll(
                    '#nsc-fin-filters button'
                )
                .forEach(b =>
                    b.classList.toggle(
                        'active',
                        b.dataset.filter === f
                    )
                );

            nscRenderFinances();
        };

    window.nscRenderFinances =
        function () {

            const q =
                String(
                    $('nsc-fin-search')
                        ?.value || ''
                )
                .toLowerCase()
                .trim();

            let rows =
                state.financeRows.filter(
                    r =>
                        !q ||
                        String(
                            r.p.full_name || ''
                        )
                            .toLowerCase()
                            .includes(q) ||

                        String(
                            r.p.file_no || ''
                        )
                            .toLowerCase()
                            .includes(q)
                );

            if (
                state.financeFilter ===
                'active'
            ) {

                rows =
                    rows.filter(
                        r =>
                            r.status ===
                            'active'
                    );
            }

            if (
                state.financeFilter ===
                'expired'
            ) {

                rows =
                    rows.filter(
                        r =>
                            r.status ===
                            'expired'
                    );
            }

            if (
                state.financeFilter ===
                'unpaid'
            ) {

                rows =
                    rows.filter(
                        r =>
                            String(
                                r.p.payment_status ||
                                ''
                            )
                                .toLowerCase() !==
                            'paid'
                    );
            }

            if (
                state.financeFilter ===
                'expiring'
            ) {

                rows =
                    rows.filter(
                        r =>
                            r.status ===
                            'expiring'
                    );
            }

            const body =
                $('nsc-finance-body');

            if (!body) return;

            body.innerHTML =
                rows
                    .map(
                        r => {

                            const p = r.p;

                            const cls =
                                String(
                                    p.payment_status ||
                                    ''
                                )
                                    .toLowerCase() ===
                                'paid'
                                ? 'paid'
                                : r.status ===
                                  'expired'
                                ? 'expired'
                                : r.status ===
                                  'expiring'
                                ? 'expiring'
                                : 'unpaid';

                            return `
                                <tr>

                                    <td>
                                        <b>
                                            ${esc(
                                                p.full_name ||
                                                '—'
                                            )}
                                        </b>
                                        <br>
                                        <small>
                                            ${esc(
                                                p.file_no ||
                                                '—'
                                            )}
                                        </small>
                                    </td>

                                    <td>
                                        ${esc(
                                            p.subscription_duration_months ||
                                            '—'
                                        )}
                                        month(s)
                                    </td>

                                    <td>
                                        ${esc(
                                            p.subscription_start ||
                                            '—'
                                        )}
                                        →
                                        ${esc(
                                            p.subscription_end ||
                                            '—'
                                        )}
                                    </td>

                                    <td>
                                        ${
                                            Number(
                                                p.final_price ||
                                                0
                                            ).toLocaleString()
                                        }
                                        EGP
                                    </td>

                                    <td>
                                        <span
                                            class="nsc-status-pill ${cls}">
                                            ${esc(
                                                p.payment_status ||
                                                r.status ||
                                                '—'
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        ${esc(
                                            p.follow_up_interval_days ||
                                            '—'
                                        )}
                                        days
                                    </td>

                                </tr>
                            `;
                        }
                    )
                    .join('') ||

                '<tr>' +
                '<td colspan="6" class="nsc-empty">' +
                'No financial records found.' +
                '</td>' +
                '</tr>';
        };

    window.nscExportFinanceCSV =
        function () {

            const rows =
                state.financeRows
                    .map(r => r.p);

            if (!rows.length) {

                return nscToast(
                    'No records to export.',
                    'error'
                );
            }

            const head = [
                'Patient',
                'File No',
                'Plan Months',
                'Start',
                'End',
                'Price',
                'Discount %',
                'Final Price',
                'Payment Status',
                'Follow-up Days'
            ];

            const csv =
                [
                    head,

                    ...rows.map(
                        p => [
                            p.full_name,
                            p.file_no,
                            p.subscription_duration_months,
                            p.subscription_start,
                            p.subscription_end,
                            p.price,
                            p.discount_percent,
                            p.final_price,
                            p.payment_status,
                            p.follow_up_interval_days
                        ]
                    )

                ]
                    .map(
                        r =>
                            r.map(
                                v =>
                                    '"' +
                                    String(
                                        v ?? ''
                                    )
                                        .replace(
                                            /"/g,
                                            '""'
                                        ) +
                                    '"'
                            )
                            .join(',')
                    )
                    .join('\n');

            const blob =
                new Blob(
                    [csv],
                    {
                        type:
                            'text/csv;charset=utf-8'
                    }
                );

            const url =
                URL.createObjectURL(blob);

            const a =
                document.createElement('a');

            a.href = url;

            a.download =
                'nsc-finances.csv';

            a.click();

            URL.revokeObjectURL(url);
        };

    async function nscLoadSettings() {

        const p =
            await getProfile();

        const u =
            await user();

        const name =
            p.full_name ||
            p.name ||
            u.user_metadata?.full_name ||
            u.email?.split('@')[0] ||
            'User';

        if ($('nsc-profile-name'))
            $('nsc-profile-name')
                .textContent =
                name;

        if ($('nsc-profile-email'))
            $('nsc-profile-email')
                .textContent =
                u.email ||
                p.email ||
                '—';

        if ($('nsc-profile-specialty'))
            $('nsc-profile-specialty')
                .textContent =
                p.specialty ||
                'Clinical Nutrition';

        if ($('nsc-profile-phone'))
            $('nsc-profile-phone')
                .textContent =
                p.phone ||
                '—';

        if ($('nsc-profile-status'))
            $('nsc-profile-status')
                .textContent =
                (
                    p.status ||
                    'approved'
                ).toUpperCase();

        if ($('nsc-profile-avatar'))
            $('nsc-profile-avatar')
                .textContent =
                name
                    .trim()
                    .charAt(0)
                    .toUpperCase();

        if ($('nsc-setting-name'))
            $('nsc-setting-name')
                .value =
                name;

        if ($('nsc-setting-specialty'))
            $('nsc-setting-specialty')
                .value =
                p.specialty || '';

        if ($('nsc-setting-phone'))
            $('nsc-setting-phone')
                .value =
                p.phone || '';

        if ($('nsc-setting-email'))
            $('nsc-setting-email')
                .value =
                u.email ||
                p.email ||
                '';

        if ($('nsc-sub-status'))
            $('nsc-sub-status')
                .textContent =
                p.status || '—';

        if ($('nsc-sub-end'))
            $('nsc-sub-end')
                .textContent =
                p.subscription_end ||
                '—';

        if ($('nsc-sub-role'))
            $('nsc-sub-role')
                .textContent =
                p.role ||
                'user';
    }

    window.nscEditProfile =
        function () {

            $('nsc-setting-name')
                ?.focus();
        };

    window.nscSaveProfile =
        async function () {

            try {

                const u =
                    await user();

                const p =
                    state.profile ||
                    await getProfile();

                const payload = {};

                const keys =
                    Object.keys(p);

                if (
                    keys.includes(
                        'full_name'
                    )
                ) {

                    payload.full_name =
                        $(
                            'nsc-setting-name'
                        )
                            .value
                            .trim();

                } else if (
                    keys.includes('name')
                ) {

                    payload.name =
                        $(
                            'nsc-setting-name'
                        )
                            .value
                            .trim();
                }

                if (
                    keys.includes(
                        'specialty'
                    )
                ) {

                    payload.specialty =
                        $(
                            'nsc-setting-specialty'
                        )
                            .value
                            .trim();
                }

                if (
                    keys.includes('phone')
                ) {

                    payload.phone =
                        $(
                            'nsc-setting-phone'
                        )
                            .value
                            .trim();
                }

                if (
                    !Object.keys(
                        payload
                    ).length
                ) {

                    if ($(
                        'nsc-profile-status-msg'
                    )) {

                        $('nsc-profile-status-msg')
                            .textContent =
                            'Profile fields are not configured in the database yet.';
                    }

                    return;
                }

                const {
                    error
                } = await db()
                    .from('profiles')
                    .update(payload)
                    .eq('id', u.id);

                if (error) throw error;

                if ($(
                    'nsc-profile-status-msg'
                )) {

                    $('nsc-profile-status-msg')
                        .textContent =
                        'Profile saved successfully.';
                }

                await nscLoadSettings();

            } catch (e) {

                if ($(
                    'nsc-profile-status-msg'
                )) {

                    $('nsc-profile-status-msg')
                        .textContent =
                        e.message ||
                        'Unable to save profile.';
                }
            }
        };

    window.nscChangePassword =
        async function () {

            const a =
                $('nsc-new-password')
                    ?.value || '';

            const b =
                $('nsc-confirm-password')
                    ?.value || '';

            if (a.length < 6) {

                if ($(
                    'nsc-password-msg'
                )) {

                    $('nsc-password-msg')
                        .textContent =
                        'Password must be at least 6 characters.';
                }

                return;
            }

            if (a !== b) {

                if ($(
                    'nsc-password-msg'
                )) {

                    $('nsc-password-msg')
                        .textContent =
                        'Passwords do not match.';
                }

                return;
            }

            try {

                const {
                    error
                } =
                    await db()
                        .auth
                        .updateUser({
                            password: a
                        });

                if (error) throw error;

                if ($(
                    'nsc-password-msg'
                )) {

                    $('nsc-password-msg')
                        .textContent =
                        'Password changed successfully.';
                }

                if ($(
                    'nsc-new-password'
                )) {

                    $('nsc-new-password')
                        .value = '';
                }

                if ($(
                    'nsc-confirm-password'
                )) {

                    $('nsc-confirm-password')
                        .value = '';
                }

            } catch (e) {

                if ($(
                    'nsc-password-msg'
                )) {

                    $('nsc-password-msg')
                        .textContent =
                        e.message ||
                        'Unable to change password.';
                }
            }
        };

    async function nscLoadAdmin() {

        const p =
            await getProfile();

        if (!state.admin) {

            $('nsc-admin-denied')
                ?.classList
                .remove('hidden');

            $('nsc-admin-content')
                ?.classList
                .add('hidden');

            return;
        }

        $('nsc-admin-denied')
            ?.classList
            .add('hidden');

        $('nsc-admin-content')
            ?.classList
            .remove('hidden');

        const {
            data,
            error
        } = await db()
            .from('profiles')
            .select('*')
            .order(
                'created_at',
                { ascending: false }
            );

        if (error) throw error;

        const users =
            data || [];

        if ($('nsc-admin-users'))
            $('nsc-admin-users')
                .textContent =
                users.length;

        if ($('nsc-admin-approved'))
            $('nsc-admin-approved')
                .textContent =
                users.filter(
                    x =>
                        x.status ===
                        'approved'
                ).length;

        if ($('nsc-admin-pending'))
            $('nsc-admin-pending')
                .textContent =
                users.filter(
                    x =>
                        x.status ===
                        'pending'
                ).length;

        if ($('nsc-admin-expiring'))
            $('nsc-admin-expiring')
                .textContent =
                users.filter(
                    x =>
                        x.subscription_end &&
                        daysBetween(
                            today(),
                            x.subscription_end
                        ) >= 0 &&
                        daysBetween(
                            today(),
                            x.subscription_end
                        ) <= 7
                ).length;

        const body =
            $('nsc-admin-body');

        if (!body) return;

        body.innerHTML =
            users
                .map(
                    x =>
                        `<tr>

                            <td>
                                <b>
                                    ${esc(
                                        x.full_name ||
                                        x.name ||
                                        '—'
                                    )}
                                </b>
                            </td>

                            <td>
                                ${esc(
                                    x.email ||
                                    '—'
                                )}
                            </td>

                            <td>
                                ${esc(
                                    x.status ||
                                    '—'
                                )}
                            </td>

                            <td>
                                ${esc(
                                    x.subscription_end ||
                                    '—'
                                )}
                            </td>

                            <td>
                                ${esc(
                                    x.role ||
                                    'user'
                                )}
                            </td>

                        </tr>`
                )
                .join('') ||

            '<tr>' +
            '<td colspan="5" class="nsc-empty">' +
            'No users found.' +
            '</td>' +
            '</tr>';
    }

    window.nscLibraryAddBook =
        function () {

            nscToast(
                'Library interface is ready; book storage will be connected to the Library database when available.'
            );
        };

    window.nscToggleLanguage =
        function () {

            nscToast(
                'Arabic interface can be connected to the existing language switch next.'
            );
        };

    /* =========================================================
       WRAP EXISTING PATIENT MANAGEMENT FUNCTIONS
       The original clinical engine is NOT replaced.
       ========================================================= */

    function wrap(name, after) {

        const original =
            window[name];

        if (
            typeof original !==
            'function'
        ) {
            return;
        }

        window[name] =
            async function (...args) {

                const r =
                    await original.apply(
                        this,
                        args
                    );

                try {

                    await after(
                        r,
                        args
                    );

                } catch (e) {

                    console.error(
                        'NSC shell wrapper',
                        name,
                        e
                    );
                }

                return r;
            };
    }

    /* Register Patient modal */

    wrap(
        'openPatientModal',
        async () => {

            document.body
                .classList
                .add(
                    'nsc-modal-active'
                );
        }
    );

    wrap(
        'closePatientModal',
        async () => {

            document.body
                .classList
                .remove(
                    'nsc-modal-active'
                );

            if (
                state.page ===
                'patients'
            ) {

                setLegacy('none');
            }
        }
    );

    /* Open patient */

    wrap(
        'selectPatient',
        async () => {

            nscHidePagesForLegacy(
                'detail'
            );
        }
    );

    /* New encounter */

    wrap(
        'startNewVisit',
        async () => {

            nscHidePagesForLegacy(
                'visit'
            );
        }
    );

    /* Return from patient */

    wrap(
        'backToPatientHome',
        async () => {

            setLegacy('none');

            setActivePage(
                'patients'
            );

            await nscLoadPatients();
        }
    );

    /* Return from visit */

    wrap(
        'backToPatientDetail',
        async () => {

            nscHidePagesForLegacy(
                'detail'
            );
        }
    );

    /* Delete patient */

    wrap(
        'deleteSelectedPatient',
        async () => {

            setLegacy('none');

            setActivePage(
                'patients'
            );

            await nscLoadPatients();
        }
    );

    /* Save patient */

    wrap(
        'savePatientFromForm',
        async () => {

            if (
                state.page ===
                'patients'
            ) {

                await nscLoadPatients();
            }
        }
    );

    /* Save visit */

    wrap(
        'saveCurrentVisit',
        async () => {

            nscHidePagesForLegacy(
                'detail'
            );
        }
    );

    /* =========================================================
       OBSERVE ORIGINAL CLINICAL ENGINE
       ========================================================= */

    function observeLegacy() {

        const detail =
            $('patient-detail-view');

        const visit =
            $('visit-screen');

        if (
            !detail ||
            !visit
        ) {
            return;
        }

        const obs =
            new MutationObserver(
                () => {

                    if (
                        state.page !==
                        'patients'
                    ) {
                        return;
                    }

                    const vd =
                        getComputedStyle(
                            visit
                        ).display !==
                        'none';

                    const dd =
                        getComputedStyle(
                            detail
                        ).display !==
                        'none';

                    if (
                        vd &&
                        !dd
                    ) {

                        document.body
                            .classList
                            .add(
                                'nsc-legacy-visible',
                                'nsc-visit-active'
                            );

                    } else if (
                        dd &&
                        !vd
                    ) {

                        document.body
                            .classList
                            .add(
                                'nsc-legacy-visible',
                                'nsc-detail-active'
                            );
                    }
                }
            );

        obs.observe(
            detail,
            {
                attributes: true,
                attributeFilter: [
                    'style',
                    'class'
                ]
            }
        );

        obs.observe(
            visit,
            {
                attributes: true,
                attributeFilter: [
                    'style',
                    'class'
                ]
            }
        );
    }

    /* =========================================================
       INITIALIZATION
       ========================================================= */

    async function init() {

        try {

            await getProfile();

        } catch (e) {

            console.error(e);
        }

        observeLegacy();

        setActivePage(
            'home'
        );

        await nscLoadHome();
    }

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

})();
