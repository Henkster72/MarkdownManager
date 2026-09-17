const fs = require('fs');

const source = fs.readFileSync(__dirname + '/../static/mdm.editor.js', 'utf8');
const fail = (message) => {
    process.stderr.write(message + '\n');
    process.exit(1);
};

if (!source.includes("node.classList.contains('mdw-faq-list')")) {
    fail('Visual editor must recognize the generic FAQ preview list');
}
if (!source.includes("item.querySelector(':scope > details > summary > h3')") || !source.includes("item.querySelector(':scope > details > .mdw-faq-answer')")) {
    fail('Visual editor must serialize FAQ headings and answers from generic preview DOM');
}
if (!source.includes("return `### ${inlineMarkdown(heading)}\\n\\n${answer}`.trim();")) {
    fail('Visual editor must serialize FAQ entries as ordinary H3 Markdown');
}
if (source.includes('faq-start') || source.includes('faqspecial') || source.includes('reading-detail')) {
    fail('Visual editor must not serialize legacy marker or site-specific FAQ markup');
}

process.stdout.write('WPM FAQ visual serializer regression checks passed\n');
