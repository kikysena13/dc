const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const startIndex = html.indexOf('let currentRoundNodes = [];');
const endIndex = html.indexOf('                roundEl.appendChild(matchesContainer);', startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find boundaries');
    process.exit(1);
}

const replacement = `let currentRoundNodes = [];
                
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
                            playerEl.innerHTML = \\\`<div style="width:28px;height:28px;background:rgba(227, 165, 95, .1);border-radius:2px;display:flex;align-items:center;justify-content:center;"><i class="fab fa-discord" style="color:#E3A55F;opacity:0.5"></i></div>
                            <span style="opacity:0.5">-</span>
                            <strong class="bracket-score" style="opacity:0.5">\\\${score}</strong>\\\`;
                        } else {
                            playerEl.innerHTML = \\\`
                                <img src="\\\${escapeHtml(avatar)}" alt="">
                                <span>\\\${escapeHtml(player.name || 'Menunggu')}</span>
                                <strong class="bracket-score">\\\${escapeHtml(score)}</strong>
                            \\\`;
                        }
                        matchEl.appendChild(playerEl);
                    });
                    
                    wrapper.appendChild(matchEl);
                    matchesContainer.appendChild(wrapper);
                    currentRoundNodes.push({ cy: cy, element: wrapper });
                });
                
`;

html = html.substring(0, startIndex) + replacement + html.substring(endIndex);
fs.writeFileSync('index.html', html);
console.log('Fixed binary tree positions!');
