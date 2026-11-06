const fs = require('fs');

const source = fs.readFileSync(__dirname + '/../static/mdm.editor.js', 'utf8');
const fail = (message) => {
    process.stderr.write(message + '\n');
    process.exit(1);
};

for (const key of ['date', 'post_date', 'published_date', 'creationdate', 'changedate']) {
    if (!source.includes(`${key}: '`)) {
        fail(`Article metadata date kind is missing for ${key}`);
    }
}
if (!source.includes('input.dataset.metaDateKind = dateKind')) {
    fail('Date metadata inputs must carry their canonical date kind');
}
if (!source.includes("articleMetaDatePlaceholder(dateKind)")) {
    fail('Date metadata inputs must expose the canonical format placeholder');
}
if (!source.includes("input.maxLength = dateKind === 'datetime' ? 16 : 10")) {
    fail('Date metadata inputs must constrain the canonical value length');
}
if (!source.includes('normalizeArticleMetaDate(value, dateKind)')) {
    fail('Article metadata Apply must normalize and validate date values');
}
if (!source.includes('invalidDateInput.reportValidity()')) {
    fail('Invalid date metadata must block Apply and report the field error');
}

for (const language of ['en', 'nl', 'de', 'es', 'fr', 'it', 'pt']) {
    const translation = JSON.parse(fs.readFileSync(__dirname + `/../translations/${language}.json`, 'utf8'));
    const articleMeta = translation.article_meta || {};
    if (!articleMeta.date_format || !articleMeta.datetime_format || !articleMeta.invalid_date || !articleMeta.invalid_datetime) {
        fail(`Date validation messages are missing for ${language}`);
    }
}
const nl = JSON.parse(fs.readFileSync(__dirname + '/../translations/nl.json', 'utf8')).article_meta;
if (nl.date_format !== 'JJJJ-MM-DD' || nl.datetime_format !== 'JJJJ-MM-DD HH:MM') {
    fail('Dutch date masks must use JJJJ for the year');
}
if (nl.invalid_date !== 'Gebruik JJJJ-MM-DD.' || nl.invalid_datetime !== 'Gebruik JJJJ-MM-DD HH:MM.') {
    fail('Dutch date validation messages must use the localized mask');
}

process.stdout.write('WPM date input mask regression checks passed\n');
