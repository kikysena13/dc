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
            
            // First, calculate the max cy so we know the container height
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
            
            // The horizontal line connecting to the final match
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
            championBox.innerHTML = \`<img src="\${escapeHtml(winnerAvatar)}" alt=""><span>CHAMPION<strong>\${escapeHtml(winner.name || 'Belum ditentukan')}</strong></span>\`;
            championWrapper.appendChild(championBox);
            
            winnerMatchesContainer.appendChild(championWrapper);
            winnerSection.appendChild(winnerMatchesContainer);
            bracket.appendChild(winnerSection);
        };
        `;

html = html.substring(0, startIndex) + replacement + html.substring(endIndex);
fs.writeFileSync('index.html', html);
console.log('Fixed renderArena with perfect binary tree math!');
