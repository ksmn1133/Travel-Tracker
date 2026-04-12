import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async parseFlightRecords(text: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract travel segments from the following text. For each segment, provide:
- departureCountry
- departureDate (ISO 8601 format)
- arrivalCountry
- arrivalDate (ISO 8601 format)

Text:
${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              departureCountry: { type: Type.STRING },
              departureDate: { type: Type.STRING },
              arrivalCountry: { type: Type.STRING },
              arrivalDate: { type: Type.STRING },
            },
            required: ["departureCountry", "departureDate", "arrivalCountry", "arrivalDate"],
          },
        },
      },
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return [];
    }
  }
};
