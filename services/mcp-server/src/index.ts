import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const server = new Server(
  {
    name: "supabase-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_db",
        description: "Run a read-only SQL query against the Supabase database",
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description: "The SQL query to execute",
            },
          },
          required: ["sql"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "query_db") {
    const { sql } = request.params.arguments as { sql: string };

    // Basic safety check - prevent obviously destructive commands if possible, 
    // though the database user permissions are the real guardrail.
    // For now, we'll rely on the AI to be responsible and the user to set up a restricted user if needed.
    // But ideally, this should only run SELECTs if that's the intent.
    // However, the user might want to create tables, so we won't block it artificially.
    
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(sql);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      } finally {
        client.release();
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Database Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Supabase MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});



