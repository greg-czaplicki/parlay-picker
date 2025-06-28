# Golf Parlay Picker Next

## Development Setup

### MCP Configuration

This project uses MCP (Machine Coding Protocol) for development tools integration. To set up MCP:

1. Copy `.mcp.example.json` to `.mcp.json`:
   ```bash
   cp .mcp.example.json .mcp.json
   ```

2. Update `.mcp.json` with your API keys:
   - Replace `your-supabase-access-token-here` with your Supabase access token
   - Replace `your-anthropic-api-key-here` with your Anthropic API key

You can obtain these API keys from:
- Supabase: Your project's API settings page
- Anthropic: [Anthropic Console](https://console.anthropic.com/)

**Note:** `.mcp.json` contains sensitive information and is git-ignored. Never commit this file to the repository. 