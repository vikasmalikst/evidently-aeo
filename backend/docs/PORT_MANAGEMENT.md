# Port Management for AnswerIntel Backend

## The Problem
The `EADDRINUSE: address already in use :::3000` error occurs when:
- Multiple instances of the backend are running
- Previous processes didn't shut down properly
- Other applications are using port 3000

## The Solution

### Quick Fix
```bash
# Clean up all ports and restart
npm run cleanup && npm run dev
```

### Safe Development Mode
```bash
# Use the safe startup script that handles port conflicts automatically
npm run dev:safe
```

### Manual Cleanup
```bash
# Run the cleanup script manually
./cleanup-ports.sh

# Or kill processes manually
lsof -ti:3000 | xargs kill -9
pkill -f "ts-node-dev"
```

## Available Scripts

- `npm run dev` - Standard development mode (may fail on port conflicts)
- `npm run dev:safe` - Safe development mode with automatic port conflict handling
- `npm run cleanup` - Clean up all AnswerIntel processes and ports

## How It Works

The `dev:safe` script:
1. Kills any existing processes on ports 3000-3005
2. Checks if port 3000 is available
3. If not, finds the next available port (3001, 3002, etc.)
4. Starts the backend on the available port

## Prevention

To avoid port conflicts in the future:
- Always use `npm run dev:safe` for development
- Use `npm run cleanup` before starting if you encounter issues
- Don't run multiple instances of the backend simultaneously

## Troubleshooting

If you still get port conflicts:
1. Run `npm run cleanup`
2. Wait 2-3 seconds
3. Run `npm run dev:safe`
4. Check the console output for the actual port being used
