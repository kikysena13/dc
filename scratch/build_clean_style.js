const fs = require('fs');

const raw = fs.readFileSync('index.monolith.html.bak', 'utf8');
const match = raw.match(/<style>([\s\S]*?)<\/style>/);
if (!match) {
    console.error('Could not find style tag');
    process.exit(1);
}

let css = match[1];

// 1. Add global `a` reset right after `* { box-sizing: border-box; }`
css = css.replace(
    /\*\s*\{\s*box-sizing:\s*border-box;\s*\}/,
    `* {
            box-sizing: border-box;
        }

        a {
            text-decoration: none;
            color: inherit;
        }`
);

// 2. Ensure .nav-item has text-decoration: none
css = css.replace(
    /\.nav-item\s*\{/,
    `.nav-item {
            text-decoration: none;`
);

// 3. In .hero definition (around line 1117), set min-height: 480px and align-items: center
css = css.replace(
    /(\.hero\s*\{[\s\S]*?min-height:\s*)380px;([\s\S]*?align-items:\s*)end;/,
    '$1480px;$2center;'
);

// 4. In earlier .hero definition (around line 271), set align-items: center
css = css.replace(
    /(\.hero\s*\{\s*padding:\s*36px\s*0\s*28px;\s*display:\s*flex;\s*align-items:\s*)end;/,
    '$1center;'
);

fs.writeFileSync('style.css', css, 'utf8');
console.log('Successfully generated clean style.css, length:', css.length);
