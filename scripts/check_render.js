var data = JSON.parse(readFile("use-cases.json"));
var bad = [];
data.useCases.forEach(function (item) {
  ["gnosis", "gemini"].forEach(function (key) {
    var html = GNOSISCompare.renderMarkdown(item[key]);
    var label = item.id + " " + key;
    if (html.indexOf("<script") !== -1 || html.indexOf("onerror=") !== -1) bad.push(label + " unsafe html");
    if (html.indexOf("**") !== -1) bad.push(label + " leftover bold markers");
    if (html.indexOf("*TLDR") !== -1) bad.push(label + " malformed TLDR");
    if (html.indexOf("\\") !== -1) bad.push(label + " leftover backslash");
    if (item[key].indexOf("$") !== -1 && html.indexOf("$") !== -1) bad.push(label + " leftover math");
    if (item[key].indexOf("|") !== -1 && html.indexOf("<table") === -1) bad.push(label + " missing table");
    if (item[key].indexOf("```") !== -1 && html.indexOf("<pre>") === -1) bad.push(label + " missing diagram");
    var stars = html.match(/\*/g);
    if (stars) bad.push(label + " asterisks " + stars.length);
    if (html.indexOf("<h5>") === -1 && item[key].indexOf("\n## ") !== -1) bad.push(label + " missing heading");
  });
});
if (GNOSISCompare.renderMarkdown(data.useCases[0].gnosis).indexOf("<strong>TLDR:</strong>") === -1) {
  bad.push("case 1 TLDR was not bold");
}
var worms = GNOSISCompare.renderMarkdown(data.useCases[2].gnosis);
if (worms.indexOf("<em>C. elegans</em>") === -1) bad.push("missing italic species name");
var table = GNOSISCompare.renderMarkdown(data.useCases[2].gemini);
var rows = (table.match(/<tr>/g) || []).length;
if (rows !== 6) bad.push("case 3 table rows " + rows);
if (table.indexOf("Δ") === -1 && table.indexOf("→") === -1 && table.indexOf("×") === -1) {
  bad.push("case 3 table missing converted math");
}
var beta = GNOSISCompare.renderMarkdown(data.useCases[4].gemini);
if (beta.indexOf("Aβ") === -1) bad.push("missing Aβ");
if (beta.indexOf("α-Synuclein") === -1 && beta.indexOf("α") === -1) bad.push("missing alpha");
print(bad.length ? bad.join("\n") : "render clean");
