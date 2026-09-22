// ── Instant Cache & Shared helpers ──────────────────────────────────────────
let PREVIEW_DATA = { members: [] };

// Load from cache immediately on script load for 0ms instant display:
try {
    const cached = sessionStorage.getItem('ML_LEADERBOARD_CACHE');
    if (cached) {
        PREVIEW_DATA = JSON.parse(cached);
    }
} catch (e) {}

const formatXp = (value) => new Intl.NumberFormat('id-ID').format(value);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

let selectedRole = null;
const USD_TO_RP = 50000000 / 3000;

const getSpendingRole = (member) => member.spendingRole === 'WHELL' || member.spendingRole === 'LEVIA'
    ? member.spendingRole
    : member.whellRp > 0 ? 'WHELL' : member.leviaRp > 0 ? 'LEVIA' : null;

const getNormalizedSpendingValue = (member, role) => {
    const rawAmount = role === 'WHELL'
        ? Number(member.whellRp || 0)
        : Number(member.leviaRp || 0);
    const currency = role === 'WHELL'
        ? member.whellCurrency
        : member.leviaCurrency;
    return currency === 'RP' ? rawAmount : rawAmount * USD_TO_RP;
};

const getVisibleMembers = () => selectedRole === 'SPENDING'
    ? PREVIEW_DATA.members.filter((member) => member.roles.some((role) => {
        const normalizedRole = role.toUpperCase();
        return normalizedRole === 'WHELL' || normalizedRole === 'LEVIA' || normalizedRole === 'LEVIATHAN';
    }))
    : selectedRole
        ? PREVIEW_DATA.members.filter((member) => member.roles.some((role) => {
            const normalizedRole = role.toUpperCase();
            return selectedRole === 'LEVIA'
                ? normalizedRole === 'LEVIA' || normalizedRole === 'LEVIATHAN'
                : normalizedRole === selectedRole;
        }))
        : PREVIEW_DATA.members;

const sortedMembers = (filter) => {
    return [...getVisibleMembers()].sort((a, b) => {
        if (selectedRole === 'SPENDING') {
            const aRole = getSpendingRole(a) || 'WHELL';
            const bRole = getSpendingRole(b) || 'WHELL';
            return getNormalizedSpendingValue(b, bRole) - getNormalizedSpendingValue(a, aRole);
        }

        if (selectedRole === 'WHELL' || selectedRole === 'LEVIA') {
            return getNormalizedSpendingValue(b, selectedRole) - getNormalizedSpendingValue(a, selectedRole);
        }

        const xpField = filter === 'overall' ? 'xp' : filter === 'chat' ? 'chatXp' : filter === 'voice' ? 'voiceXp' : 'monthlyXp';
        return b[xpField] - a[xpField];
    });
};

const renderLeaderboard = (filter = 'overall') => {
    const el = document.getElementById('leaderboard-body');
    if (!el) return;
    const members = sortedMembers(filter);
    if (members.length === 0 && (!PREVIEW_DATA.members || PREVIEW_DATA.members.length === 0)) {
        el.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted)">Memuat data...</td></tr>`;
        return;
    }
    el.innerHTML = members.map((member, index) => {
        const spendingRole = getSpendingRole(member);
        const xp = selectedRole === 'SPENDING'
            ? spendingRole === 'WHELL' ? member.whellRp : member.leviaRp
            : selectedRole === 'WHELL' ? member.whellRp : selectedRole === 'LEVIA' ? member.leviaRp : member[filter === 'overall' ? 'xp' : filter === 'chat' ? 'chatXp' : filter === 'voice' ? 'voiceXp' : 'monthlyXp'];
        const activityLabel = filter === 'chat' ? 'pesan' : filter === 'voice' ? 'menit' : 'poin';
        const value = selectedRole
            ? `${member[(selectedRole === 'WHELL' || spendingRole === 'WHELL') ? 'whellCurrency' : 'leviaCurrency'] === 'RP' ? 'Rp ' : '$'}${formatXp(xp)}`
            : `${formatXp(xp)} <small>${activityLabel}</small>`;
        const title = selectedRole ? member.bio || 'Belum ada bio' : `LVL ${member.level}`;
        const theme = selectedRole === 'WHELL'
            ? member.whellTheme
            : selectedRole === 'LEVIA'
                ? member.leviaTheme
                : selectedRole === 'SPENDING'
                    ? (spendingRole === 'WHELL' ? member.whellTheme : member.leviaTheme)
                    : (member.whellTheme || member.leviaTheme || null);
        const themeClass = theme ? ` profile-theme theme-${theme.tier}` : '';
        const themeStyle = theme?.background ? ` style="--profile-background:url('${escapeHtml(theme.background).replace(/'/g, '%27')}');--profile-background-position:${escapeHtml(theme.backgroundPosition || 'center')}"` : '';
        const roleLabel = spendingRole === 'WHELL' ? 'WHELL' : spendingRole === 'LEVIA' ? 'LEVIA' : '';
        const finalTitle = selectedRole === 'SPENDING' ? roleLabel : title;
        const progressCell = selectedRole ? `<span class="level">${escapeHtml(finalTitle)}</span>` : `<div class="xp-progress"><div class="progress"><i style="width:${member.progress}%"></i></div><span>${member.progress}% menuju level berikutnya</span></div>`;
        return `<tr class="${themeClass.trim()}"><td class="rank ${index < 3 ? 'top' : ''}">${String(index + 1).padStart(2, '0')}</td><td class="member-cell${theme ? ' profile-theme-cell' : ''}"${themeStyle}><div class="member"><img class="avatar" src="${escapeHtml(member.avatar)}" alt="Avatar ${escapeHtml(member.username)}"><div><strong>${escapeHtml(member.username)}</strong><span>ID ${escapeHtml(member.id)}</span></div></div></td><td>${escapeHtml(title)}</td><td class="xp">${value}</td><td>${progressCell}</td></tr>`;
    }).join('');
};

const renderPodium = () => {
    const el = document.getElementById('podium');
    if (!el) return;
    const members = sortedMembers('overall').slice(0, 3);
    if (members.length === 0) return;
    el.innerHTML = members.map((member, index) => {
        const spendingRole = getSpendingRole(member);
        const points = selectedRole === 'SPENDING' ? spendingRole === 'WHELL' ? member.whellRp : member.leviaRp : selectedRole === 'WHELL' ? member.whellRp : selectedRole === 'LEVIA' ? member.leviaRp : member.xp;
        const currency = selectedRole === 'SPENDING' ? spendingRole === 'WHELL' ? member.whellCurrency : member.leviaCurrency : selectedRole === 'WHELL' ? member.whellCurrency : member.leviaCurrency;
        return `<div class="podium-item"><img class="avatar podium-avatar" src="${escapeHtml(member.avatar)}" alt="Avatar ${escapeHtml(member.username)}"><div class="podium-name">${escapeHtml(member.username)}</div><div class="podium-xp">${selectedRole ? currency === 'RP' ? 'Rp ' : '$' : ''}${formatXp(points)}${selectedRole ? '' : ' XP'}</div><div class="podium-rank">${index + 1}</div></div>`;
    }).join('');
};

const renderArena = (arenaData) => {
    const titleEl = document.getElementById('arena-title');
    const subtitleEl = document.getElementById('arena-subtitle');
    const statusEl = document.getElementById('arena-status');
    if (titleEl) titleEl.textContent = arenaData.title || 'Arena';
    if (subtitleEl) subtitleEl.textContent = arenaData.subtitle || '';
    if (statusEl) statusEl.textContent = arenaData.status || 'AKTIF';
    
    const bracket = document.getElementById('arena-bracket');
    if (!bracket) return;
    bracket.innerHTML = '';
    
    const rounds = Array.isArray(arenaData.rounds) ? arenaData.rounds : [];
    const winner = typeof arenaData.winner === 'string' ? { name: arenaData.winner } : (arenaData.winner || {});
    const winnerAvatar = winner.avatar || 'https://i.pravatar.cc/96?img=8';
    
    if (rounds.length === 0) {
        bracket.innerHTML = '<div class="bracket-error">Belum ada pertandingan di dataarena.json.</div>';
        return;
    }
    
    const BASE_HEIGHT = 110;
    let matchNodes = [];
    
    // Calculate the max cy to determine total height
    let maxCy = 0;
    rounds.forEach((round, r) => {
        (round.matches || []).forEach((match, m) => {
            let cy = (m + 0.5) * BASE_HEIGHT * Math.pow(2, r);
            if (cy > maxCy) maxCy = cy;
        });
    });
    const totalHeight = maxCy + BASE_HEIGHT;
    
    rounds.forEach((round, r) => {
        const roundEl = document.createElement('section');
        roundEl.className = 'bracket-round';
        
        const title = document.createElement('h2');
        title.textContent = round.name;
        roundEl.appendChild(title);
        
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'bracket-matches';
        matchesContainer.style.position = 'relative';
        matchesContainer.style.minHeight = totalHeight + 'px';
        
        let currentRoundNodes = [];
        
        (round.matches || []).forEach((match, m) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'bracket-match-wrapper';
            wrapper.style.position = 'absolute';
            wrapper.style.width = '100%';
            wrapper.style.height = BASE_HEIGHT + 'px';
            
            let cy = (m + 0.5) * BASE_HEIGHT * Math.pow(2, r);
            
            if (r > 0) {
                let child1 = matchNodes[r-1].nodes[m*2];
                let child2 = matchNodes[r-1].nodes[m*2 + 1];
                
                if (child1) {
                    let vline = document.createElement('div');
                    vline.style.position = 'absolute';
                    vline.style.right = '-27px';
                    vline.style.top = child1.cy + 'px';
                    vline.style.height = (cy - child1.cy) + 'px';
                    vline.style.borderRight = '1px solid rgba(227, 165, 95, .45)';
                    matchNodes[r-1].container.appendChild(vline);
                }
                if (child2) {
                    let vline = document.createElement('div');
                    vline.style.position = 'absolute';
                    vline.style.right = '-27px';
                    vline.style.top = cy + 'px';
                    vline.style.height = (child2.cy - cy) + 'px';
                    vline.style.borderRight = '1px solid rgba(227, 165, 95, .45)';
                    matchNodes[r-1].container.appendChild(vline);
                }
            }
            
            wrapper.style.top = (cy - BASE_HEIGHT / 2) + 'px';
            
            const matchEl = document.createElement('div');
            matchEl.className = 'bracket-match';
            
            ['player1', 'player2'].forEach((pKey, index) => {
                const player = typeof match[pKey] === 'string' ? { name: match[pKey] } : (match[pKey] || {});
                const playerEl = document.createElement('div');
                playerEl.className = 'bracket-player';
                const isWinner = Number(match.winner) === index + 1;
                if (isWinner && player.name !== '-') {
                    playerEl.classList.add('winner');
                }
                
                const score = player.score === undefined || player.score === null || player.score === '' ? '-' : player.score;
                const avatar = player.avatar || 'https://i.pravatar.cc/96?img=8';
                
                if (player.name === '-') {
                    playerEl.innerHTML = `<div style="width:28px;height:28px;background:rgba(227, 165, 95, .1);border-radius:2px;display:flex;align-items:center;justify-content:center;"><i class="fab fa-discord" style="color:#E3A55F;opacity:0.5"></i></div>
                    <span style="opacity:0.5">-</span>
                    <strong class="bracket-score" style="opacity:0.5">${score}</strong>`;
                } else {
                    playerEl.innerHTML = `
                        <img src="${escapeHtml(avatar)}" alt="">
                        <span>${escapeHtml(player.name || 'Menunggu')}</span>
                        <strong class="bracket-score">${escapeHtml(score)}</strong>
                    `;
                }
                matchEl.appendChild(playerEl);
            });
            
            wrapper.appendChild(matchEl);
            matchesContainer.appendChild(wrapper);
            currentRoundNodes.push({ cy: cy, element: wrapper });
        });
        
        roundEl.appendChild(matchesContainer);
        bracket.appendChild(roundEl);
        matchNodes.push({ nodes: currentRoundNodes, container: matchesContainer });
    });
    
    // Add winner section
    const winnerSection = document.createElement('section');
    winnerSection.className = 'bracket-round';
    const winnerTitle = document.createElement('h2');
    winnerTitle.textContent = 'Pemenang';
    winnerSection.appendChild(winnerTitle);
    
    const winnerMatchesContainer = document.createElement('div');
    winnerMatchesContainer.className = 'bracket-matches';
    winnerMatchesContainer.style.position = 'relative';
    winnerMatchesContainer.style.minHeight = totalHeight + 'px';
    
    const championWrapper = document.createElement('div');
    championWrapper.className = 'bracket-match-wrapper';
    championWrapper.style.position = 'absolute';
    championWrapper.style.width = '100%';
    championWrapper.style.height = BASE_HEIGHT + 'px';
    championWrapper.style.display = 'flex';
    championWrapper.style.alignItems = 'center';
    championWrapper.style.justifyContent = 'center';
    
    let finalCy = 0;
    if (matchNodes.length > 0 && matchNodes[matchNodes.length - 1].nodes.length > 0) {
        finalCy = matchNodes[matchNodes.length - 1].nodes[0].cy;
    }
    championWrapper.style.top = (finalCy - BASE_HEIGHT / 2) + 'px';
    
    let hline = document.createElement('div');
    hline.style.position = 'absolute';
    hline.style.top = '50%';
    hline.style.right = '100%';
    hline.style.width = '27px';
    hline.style.borderTop = '1px solid rgba(227, 165, 95, .45)';
    championWrapper.appendChild(hline);
    
    let championBox = document.createElement('div');
    championBox.className = 'bracket-champion';
    championBox.style.margin = '0';
    championBox.style.width = '100%';
    championBox.innerHTML = `<img src="${escapeHtml(winnerAvatar)}" alt=""><span>CHAMPION<strong>${escapeHtml(winner.name || 'Belum ditentukan')}</strong></span>`;
    championWrapper.appendChild(championBox);
    
    winnerMatchesContainer.appendChild(championWrapper);
    winnerSection.appendChild(winnerMatchesContainer);
    bracket.appendChild(winnerSection);
};

// ── API loaders with Instant Cache (SWR) ─────────────────────────────────────
const API_URL = 'https://midnight-lounge-api-production-c038.up.railway.app';

const loadLeaderboard = async () => {
    // If we have cached data, update total-members right away
    if (PREVIEW_DATA && PREVIEW_DATA.members && PREVIEW_DATA.members.length > 0) {
        const totalEl = document.getElementById('total-members');
        if (totalEl) totalEl.textContent = formatXp(PREVIEW_DATA.totalMembers || PREVIEW_DATA.members.length);
    }

    try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        if (!response.ok) throw new Error('Gagal mengambil data Discord');
        PREVIEW_DATA = await response.json();
        try {
            sessionStorage.setItem('ML_LEADERBOARD_CACHE', JSON.stringify(PREVIEW_DATA));
        } catch (e) {}
        const totalEl = document.getElementById('total-members');
        if (totalEl) totalEl.textContent = formatXp(PREVIEW_DATA.totalMembers || PREVIEW_DATA.members.length);
        return PREVIEW_DATA;
    } catch (err) {
        // If we had cache, don't throw error
        if (PREVIEW_DATA && PREVIEW_DATA.members && PREVIEW_DATA.members.length > 0) {
            console.warn('Menggunakan data cache:', err);
            return PREVIEW_DATA;
        }
        throw err;
    }
};

const loadArena = async () => {
    // Try cached arena data first for instant 0ms display:
    try {
        const cachedArena = sessionStorage.getItem('ML_ARENA_CACHE');
        if (cachedArena) {
            renderArena(JSON.parse(cachedArena));
        }
    } catch (e) {}

    const arenaPaths = ['../data/dataarena.json', './data/dataarena.json', '/data/dataarena.json'];
    let arenaData = null;
    for (const path of arenaPaths) {
        try {
            const res = await fetch(path, { cache: 'no-store' });
            if (res.ok) {
                arenaData = await res.json();
                break;
            }
        } catch (e) {}
    }
    if (!arenaData) throw new Error('Gagal mengambil data arena');

    let membersData = PREVIEW_DATA.members && PREVIEW_DATA.members.length > 0 ? PREVIEW_DATA : { members: [] };
    if (!membersData.members || membersData.members.length === 0) {
        try {
            const membersResponse = await fetch(`${API_URL}/api/leaderboard`);
            if (membersResponse.ok) {
                membersData = await membersResponse.json();
            }
        } catch (e) {}
    }

    const members = Array.isArray(membersData.members) ? membersData.members : [];
    const findMember = (player) => {
        if (!player || typeof player !== 'object') return null;
        if (player.discordId) return members.find((m) => String(m.id) === String(player.discordId)) || null;
        const name = String(player.name || '').trim().toLowerCase();
        return members.find((m) => [m.username, m.displayName].filter(Boolean).some((n) => n.toLowerCase() === name)) || null;
    };
    const enrichPlayer = (player) => {
        const m = findMember(player);
        return m ? { ...player, avatar: m.avatar, name: player.name || m.displayName } : player;
    };
    arenaData.rounds = (arenaData.rounds || []).map((round) => ({
        ...round,
        matches: (round.matches || []).map((match) => ({
            ...match,
            player1: enrichPlayer(match.player1),
            player2: enrichPlayer(match.player2)
        }))
    }));
    arenaData.winner = enrichPlayer(arenaData.winner);
    
    try {
        sessionStorage.setItem('ML_ARENA_CACHE', JSON.stringify(arenaData));
    } catch (e) {}

    renderArena(arenaData);
};

// ── Sidebar, menu toggle & Link prefetching ──────────────────────────────────
const initSidebar = () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const closeBtn = document.querySelector('.sidebar-close');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });
    }
    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
            if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
        });
    }
    // Mark active nav item based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'main.html';
    document.querySelectorAll('.nav-item').forEach((item) => {
        const href = item.getAttribute('href') || '';
        const page = href.split('/').pop();
        item.classList.toggle('active', page === currentPage || (currentPage === '' && page === 'main.html'));

        // Instant prefetch on hover:
        item.addEventListener('mouseenter', () => {
            if (href && !document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = href;
                document.head.appendChild(link);
            }
        });
    });
};

// ── Filter tabs (leaderboard) ────────────────────────────────────────────────
const initFilters = () => {
    document.querySelectorAll('.filter').forEach((btn) => {
        btn.addEventListener('click', () => {
            const currentActive = document.querySelector('.filter.active');
            if (currentActive) currentActive.classList.remove('active');
            btn.classList.add('active');
            renderLeaderboard(btn.dataset.filter || 'overall');
        });
    });
};

// ── UTC Clock ────────────────────────────────────────────────────────────────
const initClock = () => {
    const el = document.getElementById('global-clock-time');
    if (!el) return;
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
        const now = new Date();
        el.textContent = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds());
    };
    tick();
    setInterval(tick, 1000);
};