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
      const apiKey = process.env.OPENWEATHER_API_KEY;

      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "Error: The OPENWEATHER_API_KEY environment variable is missing. Please configure it in the backend .env file.",
            },
          ],
        };
      }

      try {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(targetCity)}&appid=${apiKey}&units=metric`
        );

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to fetch weather for ${targetCity}. The city might not exist or the API key is invalid.`,
              },
            ],
          };
        }

        const data = await response.json();
        const weatherDesc = data.weather?.[0]?.description || "unknown conditions";
        const temp = data.main?.temp;
        const humidity = data.main?.humidity;
        const windSpeed = data.wind?.speed;
        
        const mockWeather = `The weather in ${data.name} is currently ${weatherDesc} with a temperature of ${temp}°C. Humidity is at ${humidity}% and wind speed is ${windSpeed} m/s.`;

        return {
          content: [
            {
              type: "text",
              text: mockWeather,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `An error occurred while fetching the weather: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );
};
