const data = require('../data/dataarena.json');
let matchNodes = [];
const BASE_HEIGHT = 80;

data.rounds.forEach((round, r) => {
    let currentRoundNodes = [];
    round.matches.forEach((match, m) => {
        let cy = 0;
        if (r === 0) {
            cy = (m + 0.5) * BASE_HEIGHT;
        } else {
            let child1 = matchNodes[r-1][m*2];
            let child2 = matchNodes[r-1][m*2 + 1];
            if (child1 && child2) {
                cy = (child1.cy + child2.cy) / 2;
            } else if (child1) {
                cy = child1.cy;
            } else {
                cy = 0;
            }
        }
        currentRoundNodes.push({ m, cy });
        console.log(`Round ${r} Match ${m} cy: ${cy}`);
    });
    matchNodes.push(currentRoundNodes);
});
