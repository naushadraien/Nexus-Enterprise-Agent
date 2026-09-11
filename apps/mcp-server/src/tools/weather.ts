import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const weatherSchema = z.object({
  city: z.string().describe("The name of the city (e.g., 'New York', 'London')"),
  days: z.number().optional().describe("Number of days for the forecast"),
});

export const registerWeatherTool = (server: McpServer) => {
  server.registerTool(
    "get_weather_forecast",
    {
      description: "Get the weather forecast for a given city.",
      inputSchema: weatherSchema.shape,
    },
    async (args: { city: string; days?: number }) => {
      const { city } = args;
      const targetCity = city || "Unknown";

      // Mock data for now
      const mockWeather = `The weather in ${targetCity} is currently sunny and 75°F.`;

      return {
        content: [
          {
            type: "text",
            text: mockWeather,
          },
        ],
      };
    }
  );
};
