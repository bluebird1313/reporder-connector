# Supabase MCP Server

This MCP server provides SQL access to your Supabase database for AI assistants (like Cursor).

## Setup

1.  Create a `.env` file in this directory (`services/mcp-server/.env`) with your database connection string:
    ```
    DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
    ```
    You can find this in your Supabase Dashboard under Project Settings > Database > Connection string > Node.js.
    *Note: Use the "Transaction" connection string (port 6543) if available, or "Session" (port 5432).*

2.  Build the server:
    ```bash
    npm install
    npm run build
    ```

## Configuring Cursor

1.  Open Cursor Settings (Cmd+, or Ctrl+,).
2.  Go to **Features** > **MCP**.
3.  Click **Add New MCP Server**.
4.  Enter the following details:
    *   **Name**: `supabase` (or any name you prefer)
    *   **Type**: `command`
    *   **Command**: `node`
    *   **Args**:
        ```
        C:/Users/tglas/reporder-connector/services/mcp-server/dist/index.js
        ```
        *(Make sure to use the absolute path to the dist/index.js file)*
    *   **Environment Variables**:
        *   `DATABASE_URL`: (Paste your connection string here, or ensure the .env file is loaded if the tool supports it. For Cursor MCP, it's best to explicitly set the ENV var in the settings if the .env isn't picked up automatically, though this server code tries to load .env from its directory).*

    *Better approach for Cursor config:*
    Just set the `env` in the JSON config or UI:
    `DATABASE_URL=...`

## Tools

*   `query_db`: Executes a SQL query and returns the results.



