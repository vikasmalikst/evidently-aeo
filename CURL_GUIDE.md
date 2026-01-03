# cURL Guide - Understanding API Requests

## What is cURL?

**cURL** (Client URL) is a command-line tool that allows you to make HTTP requests to any server. It's like using a browser, but from your terminal.

## Basic cURL Syntax

```bash
curl [OPTIONS] <URL>
```

## Common cURL Commands

### 1. GET Request (Fetching Data)
```bash
# Simple GET request
curl http://192.168.1.13:11434/api/tags

# GET with headers
curl -H "Authorization: Bearer token123" https://api.example.com/data

# GET with pretty JSON output
curl https://api.example.com/data | json_pp
```

### 2. POST Request (Sending Data)
```bash
# POST with JSON data
curl -X POST http://192.168.1.13:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss:20b",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# POST with form data
curl -X POST https://api.example.com/login \
  -d "username=user&password=pass"
```

### 3. PUT Request (Updating Data)
```bash
curl -X PUT https://api.example.com/users/123 \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```

### 4. DELETE Request
```bash
curl -X DELETE https://api.example.com/users/123
```

## Common cURL Options

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--request` | `-X` | HTTP method (GET, POST, PUT, DELETE) | `-X POST` |
| `--header` | `-H` | Add HTTP header | `-H "Content-Type: application/json"` |
| `--data` | `-d` | Send data in request body | `-d '{"key":"value"}'` |
| `--verbose` | `-v` | Show detailed request/response info | `-v` |
| `--include` | `-i` | Include response headers in output | `-i` |
| `--output` | `-o` | Save response to file | `-o response.json` |
| `--silent` | `-s` | Silent mode (no progress bar) | `-s` |
| `--location` | `-L` | Follow redirects | `-L` |

## Understanding URLs in cURL

### Is it an API Endpoint or Backend Route?

**They're the same thing!** Here's the breakdown:

```
http://192.168.1.13:11434/api/chat
│      │              │    │   │
│      │              │    │   └─ Endpoint/Route Path
│      │              │    └───── API Prefix (common convention)
│      │              └────────── Port Number
│      └───────────────────────── Host/IP Address
└───────────────────────────────── Protocol (HTTP/HTTPS)
```

### Components Explained:

1. **Protocol**: `http://` or `https://`
2. **Host/IP**: `192.168.1.13` (manager's machine IP)
3. **Port**: `11434` (Ollama's default port)
4. **Path**: `/api/chat` (the endpoint/route)

### In Your Application Context:

```bash
# This is an API endpoint provided by Ollama service
curl http://192.168.1.13:11434/api/tags
#                                    │
#                                    └─ Ollama's API endpoint to list models
```

```bash
# This is also an API endpoint (Ollama's chat endpoint)
curl -X POST http://192.168.1.13:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-oss:20b", "messages": [...]}'
#                                    │
#                                    └─ Ollama's API endpoint for chat
```

## Real-World Examples

### Example 1: Testing Ollama Connection
```bash
# Check if Ollama is running and list available models
curl http://192.168.1.13:11434/api/tags
```

**Response:**
```json
{
  "models": [
    {
      "name": "gpt-oss:20b",
      "modified_at": "2024-01-01T00:00:00Z",
      "size": 1234567890
    }
  ]
}
```

### Example 2: Making a Chat Request
```bash
curl -X POST http://192.168.1.13:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss:20b",
    "messages": [
      {"role": "user", "content": "What is AI?"}
    ],
    "stream": false
  }'
```

### Example 3: Testing Your Own Backend API
```bash
# If your backend has an endpoint like:
# GET /api/admin/global-settings/consolidated-analysis/ollama

curl http://localhost:3000/api/admin/global-settings/consolidated-analysis/ollama
```

### Example 4: With Authentication
```bash
# If your API requires authentication
curl -X GET https://api.example.com/data \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json"
```

## How Your Application Uses It

### In Your Code (ollama-client.service.ts):

```typescript
// This is equivalent to a cURL command:
const response = await fetch(`${ollamaUrl}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: ollamaModel,
    messages: [...]
  })
});
```

### Equivalent cURL Command:

```bash
curl -X POST http://192.168.1.13:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-oss:20b",
    "messages": [...]
  }'
```

## Key Differences: API Endpoint vs Backend Route

| Term | Meaning | Example |
|------|---------|---------|
| **API Endpoint** | A URL where an API can be accessed | `http://192.168.1.13:11434/api/chat` |
| **Backend Route** | The path/pattern defined in your server code | `/api/chat` (in Express.js: `router.post('/api/chat', ...)`) |
| **Full URL** | Complete address including protocol, host, port, and path | `http://192.168.1.13:11434/api/chat` |

**In practice**: They're often used interchangeably, but:
- **Endpoint** = The full URL you call
- **Route** = The path pattern in your code

## Troubleshooting with cURL

### Check if service is running:
```bash
curl http://192.168.1.13:11434/api/tags
# If it works → Service is accessible
# If it fails → Check VPN, firewall, or service status
```

### See detailed request/response:
```bash
curl -v http://192.168.1.13:11434/api/tags
# Shows headers, status codes, and full request details
```

### Test with timeout:
```bash
curl --max-time 5 http://192.168.1.13:11434/api/tags
# Fails after 5 seconds if no response
```

## Summary

1. **cURL** = Command-line tool for HTTP requests
2. **URL in cURL** = Full API endpoint (protocol + host + port + path)
3. **API Endpoint** = Backend Route (same thing, different terminology)
4. **Use cURL** to test APIs before using them in code
5. **Your app's `fetch()`** = Same as cURL, but in JavaScript

