import http from 'http';

console.log('Testing MCP Gateway...');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET'
}, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

req.end();