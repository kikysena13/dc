const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Remove margin-top from .bracket-champion in CSS
html = html.replace(/margin-top: 18px;\s*/g, '');

// 2. Re-inject the JS logic to position the champion AND draw the connecting line
const startIndex = html.indexOf('// Add winner section');
const endIndex = html.indexOf('};', startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find boundaries');
    process.exit(1);
}

const replacement = `// Add winner section
            const winnerSection = document.createElement('section');
            winnerSection.className = 'bracket-round';
            const winnerTitle = document.createElement('h2');
            winnerTitle.textContent = 'Pemenang';
            winnerSection.appendChild(winnerTitle);
            
            const winnerMatchesContainer = document.createElement('div');
            winnerMatchesContainer.className = 'bracket-matches';
            winnerMatchesContainer.style.position = 'relative';
            
            let totalHeight = rounds[0].matches.length * BASE_HEIGHT;
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
        `;

html = html.substring(0, startIndex) + replacement + html.substring(endIndex);
fs.writeFileSync('index.html', html);
console.log('Fixed winner section completely!');
