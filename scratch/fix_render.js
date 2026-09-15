const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The corrupted block ends just before loadArena
const startIndex = html.indexOf('const renderArena = (arenaData) => {');
const endIndex = html.indexOf('const loadArena = async () => {');

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find boundaries');
    process.exit(1);
}

const replacement = `const renderArena = (arenaData) => {
            document.getElementById('arena-title').textContent = arenaData.title || 'Arena';
            document.getElementById('arena-subtitle').textContent = arenaData.subtitle || '';
            document.getElementById('arena-status').textContent = arenaData.status || 'AKTIF';
            
            const bracket = document.getElementById('arena-bracket');
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
            
            rounds.forEach((round, r) => {
                const roundEl = document.createElement('section');
                roundEl.className = 'bracket-round';
                
                const title = document.createElement('h2');
                title.textContent = round.name;
                roundEl.appendChild(title);
                
                const matchesContainer = document.createElement('div');
                matchesContainer.className = 'bracket-matches';
                matchesContainer.style.position = 'relative';
                
                // Max height determined by first round
                let totalHeight = rounds[0].matches.length * BASE_HEIGHT;
                matchesContainer.style.minHeight = totalHeight + 'px';
                
                let currentRoundNodes = [];
                
                (round.matches || []).forEach((match, m) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'bracket-match-wrapper';
                    wrapper.style.position = 'absolute';
                    wrapper.style.width = '100%';
                    wrapper.style.height = BASE_HEIGHT + 'px';
                    
                    let cy = 0;
                    if (r === 0) {
                        cy = (m + 0.5) * BASE_HEIGHT;
                    } else {
                        let child1 = matchNodes[r-1].nodes[m*2];
                        let child2 = matchNodes[r-1].nodes[m*2 + 1];
                        if (child1 && child2) {
                            cy = (child1.cy + child2.cy) / 2;
                            
                            // Draw vertical line connecting them
                            let vline = document.createElement('div');
                            vline.style.position = 'absolute';
                            vline.style.right = '-27px';
                            vline.style.top = child1.cy + 'px';
                            vline.style.height = (child2.cy - child1.cy) + 'px';
                            vline.style.borderRight = '1px solid rgba(227, 165, 95, .45)';
                            matchNodes[r-1].container.appendChild(vline);
                        } else if (child1) {
                            cy = child1.cy;
                        } else {
                            cy = 0;
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
                            playerEl.innerHTML = \`<div style="width:28px;height:28px;background:rgba(227, 165, 95, .1);border-radius:2px;display:flex;align-items:center;justify-content:center;"><i class="fab fa-discord" style="color:#E3A55F;opacity:0.5"></i></div>
                            <span style="opacity:0.5">-</span>
                            <strong class="bracket-score" style="opacity:0.5">\${score}</strong>\`;
                        } else {
                            playerEl.innerHTML = \`
                                <img src="\${escapeHtml(avatar)}" alt="">
                                <span>\${escapeHtml(player.name || 'Menunggu')}</span>
                                <strong class="bracket-score">\${escapeHtml(score)}</strong>
                            \`;
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
            winnerSection.innerHTML = \`<h2>Pemenang</h2><div class="bracket-matches"><div class="bracket-champion"><img src="\${escapeHtml(winnerAvatar)}" alt=""><span>CHAMPION<strong>\${escapeHtml(winner.name || 'Belum ditentukan')}</strong></span></div></div>\`;
            bracket.appendChild(winnerSection);
        };
        `;

html = html.substring(0, startIndex) + replacement + html.substring(endIndex);
fs.writeFileSync('index.html', html);
console.log('Fixed renderArena!');
