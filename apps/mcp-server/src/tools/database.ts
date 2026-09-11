import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Pool } from "pg";
import * as dotenv from "dotenv";

// Load environment variables (from the backend if needed, or local .env)
dotenv.config({ path: '../backend/.env' });

// We create a single pg pool using the standard Postgres connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const registerDatabaseTools = (server: McpServer) => {
  // 1. Tool to get database schema
  server.registerTool(
    "get_database_schema",
    {
      description: "Get the list of tables and their columns in the database. Call this first to understand the schema before writing SQL queries.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      try {
        const query = `
          SELECT table_name, column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          ORDER BY table_name, ordinal_position;
        `;
        const result = await pool.query(query);
        
        // Group by table for readability
        const schema: Record<string, any[]> = {};
        for (const row of result.rows) {
          if (!schema[row.table_name]) schema[row.table_name] = [];
          schema[row.table_name].push({ column: row.column_name, type: row.data_type });
        }

        return {
          content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error fetching schema: ${error.message}` }],
        };
      }
    }
  );

  // 2. Tool to execute read-only SQL
  server.registerTool(
    "execute_read_only_sql",
    {
      description: "Execute a read-only SELECT SQL query against the Postgres database and get the results as JSON.",
      inputSchema: z.object({
        query: z.string().describe("The raw SQL SELECT query to run"),
      }).shape,
    },
    async (args: { query: string }) => {
      let { query } = args;
      
      // Basic safety check to prevent obvious writes
      const upperQuery = query.toUpperCase();
      if (
        upperQuery.includes("INSERT") || 
        upperQuery.includes("UPDATE") || 
        upperQuery.includes("DELETE") || 
        upperQuery.includes("DROP") || 
        upperQuery.includes("ALTER")
      ) {
        return {
          content: [{ type: "text", text: "Error: Only SELECT queries are allowed for safety." }],
        };
      }

      // Ensure it's read only at the transaction level for extra safety
      const readOnlyQuery = `BEGIN READ ONLY; ${query}; COMMIT;`;
      
      try {
        // Run query (pool.query on a multi-statement string works, but it's safer to use a client)
        const client = await pool.connect();
        try {
          await client.query("BEGIN READ ONLY;");
          const result = await client.query(query);
          await client.query("COMMIT;");
          
          return {
            content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
          };
        } catch (innerError: any) {
          await client.query("ROLLBACK;");
          throw innerError;
        } finally {
          client.release();
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `SQL Error: ${error.message}` }],
        };
      }
    }
  );
};
