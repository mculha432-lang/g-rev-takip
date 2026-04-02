const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'views', 'admin', 'task_detail.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the problematic string using a more robust regex
const newContent = content.replace(/<%\s*-\s*messagesMap\s*%>/g, '<%- messagesMap %>');

if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Dosya düzeltildi!');
} else {
    console.log('Dosya zaten düzgün veya değişiklik yapılamadı.');
    console.log('Mevcut içerik parçası:', content.match(/const messagesMap = .*;/));
}
