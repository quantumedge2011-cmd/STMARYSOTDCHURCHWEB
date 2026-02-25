document.addEventListener('DOMContentLoaded', () => {
    // Apply images from management script
    if (typeof applyImages === 'function') {
        applyImages();
    }

    // LOADING SCREEN (5 seconds)
    const loader = document.getElementById('loading-screen');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 800); // Wait for transition
        }, 2000); // 2 seconds
    }

    // SUB-NAVIGATION LOGIC (Improved Context Scoping)
    const subNavs = document.querySelectorAll('.sub-nav');
    subNavs.forEach(navContainer => {
        const items = navContainer.querySelectorAll('.sub-nav-item');
        const parentView = navContainer.closest('.view-section');

        items.forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.dataset.subtarget;

                // Update active button only within this sub-nav
                items.forEach(btn => btn.classList.remove('active'));
                item.classList.add('active');

                // Toggle subviews only within this view-section
                parentView.querySelectorAll('.subview-section').forEach(view => {
                    view.classList.add('hidden');
                    view.classList.remove('active');
                });

                const targetView = document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.remove('hidden');
                    targetView.classList.add('active');
                }
            });
        });
    });

    // Google Sheets URLs
    const CONTRIBUTIONS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGfFqPLOCO7a4uof86kAdEUSPoMe1s-DPn2tx0mpA_BA4qSk5lE4AK0NwIyPFFdbC081Eo7wjppvWU/pub?gid=1851438334&output=csv";
    const SPECIAL_EVENTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT3QzYf9Vf5NLwEH_cPeuKW3WdvGeLIot8uF7VF-NWpRuMItbOEEmB_lfReTfteXQEpmD-6hXJn1Nyn/pub?gid=928733644&output=csv";

    let churchData = null;

    async function loadChurchData() {
        try {
            // 0. SECURITY & COMPATIBILITY CHECK
            if (window.location.protocol === 'file:') {
                console.warn("WARNING: You are opening this file directly from your computer (file://). " +
                    "Modern browsers block 'Live Data Sync' in this mode for security. " +
                    "Please use a local server (like Live Server) or upload to a hosting service.");
            }

            // 1. Load Local Config (Committee, Events Ticker)
            const localResponse = await fetch(`data/data.json?v=${Date.now()}`);
            churchData = await localResponse.json();

            // 2. Load Live Contributions from Sheet
            const contribRes = await fetch(`${CONTRIBUTIONS_URL}&v=${Date.now()}`);
            const contribCsv = await contribRes.text();
            // Overwrite local contributions with live spreadsheet data
            churchData.contributions = parseContributionsCSV(contribCsv);
            console.log(`[${new Date().toLocaleTimeString()}] Live Sync Success: Found ${churchData.contributions.length} members in Sheet.`);

            // 3. Load Live Special Events from Sheet
            const eventsRes = await fetch(`${SPECIAL_EVENTS_URL}&v=${Date.now()}`);
            const eventsCsv = await eventsRes.text();
            churchData.special_events = parseSpecialEventsCSV(eventsCsv);
            console.log(`[${new Date().toLocaleTimeString()}] Live Sync Success: Found ${churchData.special_events.length} special events.`);

            renderCommittee(churchData.committee);
            renderTicker(churchData.events_ticker);
            renderSpecialEvents(churchData.special_events);

            if (typeof applyImages === 'function') {
                applyImages();
            }
        } catch (error) {
            console.error("Error loading church data:", error);
            if (window.location.protocol === 'file:') {
                alert("NOTICE: Cannot load Google Sheet data while opening the file directly (file://). \n\nPlease use a local server (like VS Code Live Server) or upload it to see the live updates.");
            }
        }
    }

    // HELPER: Improved CSV Splitter (Handles quoted commas)
    const splitLine = (line) => {
        const parts = [];
        let current = '';
        let inQuotes = false;
        // Strip any trailing carriage returns or whitespace from the line itself
        const cleanLine = line.replace(/[\r\n]+$/, '');

        for (let i = 0; i < cleanLine.length; i++) {
            const char = cleanLine[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim());
        return parts;
    };

    function parseContributionsCSV(csv) {
        // We handle ANY number of lines provided by the CSV
        const lines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) return [];

        const headers = splitLine(lines[0]).map(h => h.toLowerCase());
        const results = [];

        // Dynamic indices (Current Header: Family_ID,Family_Key,Head_Name,Phone,Prayer_Group,Address,Members_Count,Email,pending,Notes)
        const idxName = headers.indexOf('head_name') !== -1 ? headers.indexOf('head_name') : 2;
        const idxKey = headers.indexOf('family_key') !== -1 ? headers.indexOf('family_key') : 1;

        let idxPending = headers.indexOf('pending_amount') !== -1 ? headers.indexOf('pending_amount') : headers.indexOf('pending');
        if (idxPending === -1) idxPending = 8;

        let idxPaid = headers.indexOf('last_paid_date') !== -1 ? headers.indexOf('last_paid_date') : 10;

        // Note: No upper limit check here. It will parse all 500+ rows if they exist.
        for (let i = 1; i < lines.length; i++) {
            const values = splitLine(lines[i]);
            if (values.length < 2) continue;

            let name = values[idxName] ? values[idxName].trim() : "";
            let family_id = values[idxKey] ? values[idxKey].trim() : "";

            // SKIP empty rows or rows without names to avoid "Unknown" mess
            if (!name || name.toLowerCase() === "unknown" || name === "-") continue;

            let pending = values[idxPending] ? values[idxPending].trim() : "0";
            if (pending.toLowerCase() === 'inactive' || pending.toLowerCase() === 'active') pending = "0";

            let lastPaid = values[idxPaid] ? values[idxPaid].trim() : "Not Available";

            results.push({
                name, family_id, pending, last_paid: lastPaid
            });
        }
        return results;
    }

    function parseSpecialEventsCSV(csv) {
        const lines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) return [];

        const headers = splitLine(lines[0]).map(h => h.toLowerCase());
        const results = [];

        // Headers: ID,Title_EN,Title_ML,Date_EN,Date_ML,Video_URL,Description_EN,Description_ML
        const idxTitleEn = headers.indexOf('title_en');
        const idxTitleMl = headers.indexOf('title_ml');
        const idxDateEn = headers.indexOf('date_en');
        const idxDateMl = headers.indexOf('date_ml');
        const idxVideo = headers.indexOf('video_url');
        const idxDescEn = headers.indexOf('description_en');
        const idxDescMl = headers.indexOf('description_ml');

        for (let i = 1; i < lines.length; i++) {
            const values = splitLine(lines[i]);
            if (values.length < 2) continue; // Ensure at least two columns for basic data

            results.push({
                title_en: idxTitleEn !== -1 ? (values[idxTitleEn] || "") : "",
                title_ml: idxTitleMl !== -1 ? (values[idxTitleMl] || "") : "",
                date_en: idxDateEn !== -1 ? (values[idxDateEn] || "") : "",
                date_ml: idxDateMl !== -1 ? (values[idxDateMl] || "") : "",
                video_url: idxVideo !== -1 ? (values[idxVideo] || "#") : "#",
                desc_en: idxDescEn !== -1 ? (values[idxDescEn] || "") : "",
                desc_ml: idxDescMl !== -1 ? (values[idxDescMl] || "") : ""
            });
        }
        console.log(`Parsed ${results.length} special events from CSV.`);
        return results;
    }

    function renderTicker(events) {
        const container = document.getElementById('ticker-content');
        if (!container || !events) return;

        container.innerHTML = '';
        const currentLang = document.querySelector('.lang-btn.active').dataset.lang;

        // Duplicate for infinite scroll effect
        const doubledEvents = [...events, ...events];

        doubledEvents.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'ticker-item';
            const text = currentLang === 'en' ? ev.en : ev.ml;
            item.setAttribute('data-content-en', ev.en);
            item.setAttribute('data-content-ml', ev.ml);
            item.textContent = text;
            container.appendChild(item);
        });
    }

    function renderSpecialEvents(events) {
        const container = document.getElementById('special-events-container');
        if (!container || !events) return;

        container.innerHTML = '';
        const currentLang = document.querySelector('.lang-btn.active').dataset.lang;

        events.forEach(ev => {
            const card = document.createElement('div');
            card.className = 'special-event-card';
            const title = currentLang === 'en' ? ev.title_en : ev.title_ml;
            const date = currentLang === 'en' ? ev.date_en : ev.date_ml;
            const desc = currentLang === 'en' ? ev.desc_en : ev.desc_ml;

            card.innerHTML = `
                <div class="event-info">
                    <h3 class="event-name" data-content-en="${ev.title_en}" data-content-ml="${ev.title_ml}">${title}</h3>
                    <div class="event-meta">
                        <span class="event-date" data-content-en="${ev.date_en}" data-content-ml="${ev.date_ml}">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${date}
                        </span>
                    </div>
                    <p class="event-desc" data-content-en="${ev.desc_en}" data-content-ml="${ev.desc_ml}">${desc}</p>
                    <a href="${ev.video_url}" target="_blank" class="video-link">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                        <span data-content-en="Watch Event Video" data-content-ml="വീഡിയോ കാണുക">Watch Event Video</span>
                    </a>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderCommittee(committee) {
        const container = document.querySelector('#members-view .contributions-section');
        if (!container) return;

        container.innerHTML = '';

        committee.forEach((member, index) => {
            const imgId = `img${index + 2}`; // img2, img3, img4...
            const card = document.createElement('div');
            card.className = 'official-card';
            card.innerHTML = `
                <div class="image-frame round" id="${imgId}-frame">
                    <div class="placeholder-overlay">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span class="placeholder-label">${imgId}</span>
                    </div>
                </div>
                <div class="official-role" data-content-en="${member.role_en}" data-content-ml="${member.role_ml}">${member.role_en}</div>
                <div class="official-name">${member.name}</div>
            `;
            container.appendChild(card);
        });
    }

    function renderContributions(results) {
        const container = document.getElementById('search-results-container');
        if (!container) return;

        // Clear previous results completely
        container.innerHTML = '';

        if (results.length === 0) {
            const noResult = document.createElement('div');
            noResult.className = 'demo-result-card';
            noResult.innerHTML = '<p style="text-align:center; padding: 20px;">No results found.</p>';
            container.appendChild(noResult);
            return;
        }

        const currentLang = document.querySelector('.lang-btn.active').dataset.lang;
        const fragment = document.createDocumentFragment();

        // Show total count
        const countBadge = document.createElement('div');
        countBadge.className = 'results-count-badge';
        countBadge.style.cssText = "text-align: center; margin-bottom: 1.5rem; font-weight: 600; color: #64748b; font-size: 0.85rem;";
        const countTextEn = `Found ${results.length} matches`;
        const countTextMl = `${results.length} ഫലങ്ങൾ കണ്ടെത്തി`;
        countBadge.textContent = currentLang === 'en' ? countTextEn : countTextMl;
        fragment.appendChild(countBadge);

        // Render all results using Fragment for performance
        results.forEach(res => {
            const card = document.createElement('div');
            card.className = 'demo-result-card';
            card.style.marginBottom = '1rem'; // Spacing for mobile

            card.innerHTML = `
                <div class="result-details">
                    <div class="result-row">
                        <span class="label" data-content-en="Name:" data-content-ml="പേര്:">Name:</span>
                        <span class="value">${res.name}</span>
                    </div>
                    <div class="result-row">
                        <span class="label" data-content-en="Family ID:" data-content-ml="ഫാമിലി ഐഡി:">Family ID:</span>
                        <span class="value">${res.family_id}</span>
                    </div>
                    <div class="result-row">
                        <span class="label" data-content-en="Pending Amount:" data-content-ml="കുടിശ്ശിക തുക:">Pending Amount:</span>
                        <span class="value" style="color: #dc2626;">₹ ${res.pending}</span>
                    </div>
                    <div class="result-row">
                        <span class="label" data-content-en="Last Paid:" data-content-ml="അവസാനം അടച്ചത്:">Last Paid:</span>
                        <span class="value">${res.last_paid}</span>
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    }

    loadChurchData();

    const langBtns = document.querySelectorAll('.lang-btn');
    const translatableElements = document.querySelectorAll('[data-content-en]');
    const translatableInputs = document.querySelectorAll('[data-placeholder-en]');

    function setLanguage(lang) {
        if (lang !== 'en' && lang !== 'ml') return;

        langBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        translatableElements.forEach(el => {
            const content = el.getAttribute(`data-content-${lang}`);
            if (content) {
                el.style.opacity = '0.5';
                setTimeout(() => {
                    el.textContent = content;
                    el.style.opacity = '1';
                }, 150);
            }
        });

        const resultsRows = document.querySelectorAll('.result-row');
        resultsRows.forEach(row => {
            const label = row.querySelector('.label');
            if (label) {
                const text = label.getAttribute(`data-content-${lang}`);
                if (text) label.textContent = text;
            }
        });

        translatableInputs.forEach(input => {
            const placeholder = input.getAttribute(`data-placeholder-${lang}`);
            if (placeholder) {
                input.placeholder = placeholder;
            }
        });

        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            const text = item.getAttribute(`data-text-${lang}`);
            if (text) {
                const span = item.querySelector('span');
                if (span) span.textContent = text;
            }
        });
    }

    // Event Listeners for Language
    langBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            setLanguage(lang);
        });
    });

    /* --- Navigation Logic --- */
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.view-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            menuItems.forEach(btn => btn.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(sec => sec.classList.toggle('hidden', sec.id !== targetId));
        });
    });

    // Search Interaction
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-input');
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const term = searchInput.value.trim().toLowerCase();

            // AUTO-UPDATE: Re-fetch data on every search click to ensure latest sheet data
            await loadChurchData();

            if (term) {
                const results = churchData.contributions.filter(c =>
                    c.name.toLowerCase().includes(term) ||
                    (c.family_id && c.family_id.toLowerCase().includes(term))
                );
                renderContributions(results, term);
            } else {
                const container = document.getElementById('search-results-container');
                if (container) container.innerHTML = '';
                searchInput.focus();
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchBtn.click();
        });
    }

    // AUTO-UPDATE: Background Sync every 2 minutes (120000ms)
    setInterval(() => {
        console.log("Background sync starting...");
        loadChurchData();
    }, 120000);

});
