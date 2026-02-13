# Self-Hosted MCP Search: Implementation & Operations Guide

This document details the technical implementation, deployment strategy, and operational procedures for self-hosting the Model Context Protocol (MCP) search server on our VPS.

## 1. Strategic Architecture

### Tier 1: The "Efficient" Stack (Current)
We are deploying a single-container solution using `mrkrsl/web-search-mcp`.
- **Primary Function**: Real-time web search and content extraction.
- **Engine**: Playwright (Headless Browser) running inside Docker.
- **Cost**: $0 (Uses public search engines like DuckDuckGo/Brave/Bing).
- **Protocol**: JSON-RPC over Stdio (via `docker exec`).

### Tier 2: The "Agentic" Upgrade (Future)
If complex data extraction (SPAs, login-gated sites) becomes necessary, we will upgrade to `browser-use` or `OneSearch` which utilizes LLM-driven navigation.

---

## 2. Technical Implementation

### A. Docker Configuration
The `mrkrsl/web-search-mcp` repository is designed for local Node.js use. We have containerized it to run on a headless VPS.

**`Dockerfile` (Custom)**
```dockerfile
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Keep container alive for "docker exec" commands
CMD ["tail", "-f", "/dev/null"]
```

**`docker-compose.yml`**
```yaml
version: '3.8'
services:
  web-search-mcp:
    build: .
    container_name: web-search-mcp
    restart: unless-stopped
    # Shared memory required for Chromium
    shm_size: '2gb'
    environment:
      - LOG_LEVEL=error
```

### B. Backend Bridge Service (`McpWebSearchService`)
We communicate with the container using Node.js `ChildProcess`.

**File**: `backend/src/services/data-collection/mcp-web-search.service.ts`

**Core Logic**:
1.  **Spawn**: `spawn('docker', ['exec', '-i', 'web-search-mcp', 'node', 'dist/index.js'])`
2.  **Handshake**: Send JSON-RPC `initialize` request.
3.  **Execute**: Send `tools/call` request with `get-web-search-summaries` (Fast) or `full-web-search` (Deep).
4.  **Parse**: Read `stdout` for the JSON-RPC response.

### C. Search Modes

| Mode | Tool Name | Latency | Use Case |
| :--- | :--- | :--- | :--- |
| **FAST** | `get-web-search-summaries` | 3-5s | Strategy Generation (Trends, Competitor Angles) |
| **DEEP** | `full-web-search` | 8-15s | Content Factory (Detailed Research, Fact Checking) |

---

## 3. Resilience & Fallback Protocol

To ensure 99.9% reliability, we implement a "Circuit Breaker" pattern.

### The Failure Cascade
1.  **Attempt 1**: Backend calls `McpWebSearchService.search()`.
2.  **Failure Condition**:
    - Docker container is down.
    - Timeout (>20s).
    - Search engine blocks the request (empty result).
3.  **Fallback Action**:
    - Catch the error.
    - Log warning: `⚠️ [MCP] Search failed, falling back to Groq Native`.
    - Set `enableWebSearch: true` in the subsequent `GroqCompoundService` call.

**Code Example (Concept)**:
```typescript
let searchContext = "";
try {
  searchContext = await mcpWebSearchService.search(query, 'fast');
} catch (err) {
  console.warn("MCP Failed, switching to Groq Web Search");
  // The actual fallback happens in the LLM call configuration
  useGroqNativeSearch = true;
}

// In LLM Call
await groqCompoundService.generateContent({
    // ...
    enableWebSearch: useGroqNativeSearch // TRUE if MCP failed
});
```

---

## 4. Integration Workflows

### A. Strategy Generation (`strategy-generation.service.ts`)
- **Trigger**: When generating a new content strategy.
- **Query**: `"Latest trends in [Industry] regarding [Topic]"` + `"Competitor analysis [Competitor Name]"`
- **Mode**: `FAST`
- **Injection**: Search summaries are appended to the `userPrompt` as "Market Context".

### B. Content Factory (`recommendation-content.service.ts`)
- **Trigger**: When writing the actual draft (Blog, LinkedIn, etc.).
- **Query**: Specific factual queries based on the outline.
- **Mode**: `DEEP`
- **Injection**: Full page content is passed in `extraContext`.

---

## 5. VPS Deployment Checklist

Run these commands on the VPS to deploy the search server.

1.  **Clone & Setup**:
    ```bash
    cd /opt
    git clone https://github.com/mrkrsl/web-search-mcp.git
    cd web-search-mcp
    ```

2.  **Create Docker Files**:
    - Create the `Dockerfile` and `docker-compose.yml` (as defined in Section 2A).

3.  **Build & Run**:
    ```bash
    docker-compose up -d --build
    ```

4.  **Verify**:
    ```bash
    # Test if it responds to a simple echo
    docker exec -i web-search-mcp echo "Search Server Online"
    ```

## 6. Future Roadmap

- **Q2 2025**: Evaluate `OneSearch` for multi-engine aggregation if DuckDuckGo blocking increases.
- **Q3 2025**: Implement "Agentic" browsing for deep competitor product analysis (requires Login capability).