const fs = require('fs');

const html = fs.readFileSync('./index.monolith.html.bak', 'utf8');
const match = html.match(/<style>([\s\S]*?)<\/style>/i);
if (!match) {
    console.error('Could not find style tag!');
    process.exit(1);
}

let css = match[1];

// Add global text-decoration: none for <a> and .nav-item
const fix = `
        * {
            box-sizing: border-box;
        }

        a {
            text-decoration: none;
            color: inherit;
        }
`;

css = css.replace(/(\*\s*\{\s*box-sizing:\s*border-box;\s*\})/i, fix);
css = css.replace(/(\.nav-item\s*\{[^}]*)/i, (m) => m + '\n            text-decoration: none;');

fs.writeFileSync('./style.css', css, 'utf8');
console.log('Successfully written style.css with length:', css.length);
