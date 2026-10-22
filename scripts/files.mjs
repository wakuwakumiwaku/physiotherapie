// Exact public runtime inventory: destination -> reviewed source. Never recurse public/.
export const runtimeFiles = Object.freeze({
 'index.html':'index.html',
 'favicon.svg':'public/favicon.svg',
 'src/app.js':'src/app.js',
 'src/domain.js':'src/domain.js',
 'src/styles.css':'src/styles.css',
 'data/catalog.json':'public/data/catalog.json',
 'data/provenance.json':'public/data/provenance.json',
 'data/import-report.json':'public/data/import-report.json',
});
