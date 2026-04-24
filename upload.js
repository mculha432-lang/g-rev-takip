const fs = require('fs');
const https = require('https');

const filePath = 'deploy.tar.gz';
const data = fs.readFileSync(filePath);
const boundary = '----FormBoundary' + Date.now();

const prefix = Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="deploy.tar.gz"\r\nContent-Type: application/gzip\r\n\r\n`
);
const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
const body = Buffer.concat([prefix, data, suffix]);

const req = https.request({
  hostname: 'catbox.moe',
  path: '/user/api.php',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('DOWNLOAD URL:', d));
});

req.on('error', e => console.error('Hata:', e.message));
req.write(body);
req.end();
