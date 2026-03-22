import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const removeBackground = async (base64Image: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { text: "Remove the background from this image and return only the main subject. Return the result as a base64 encoded PNG image." },
          { inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }
        ]
      }
    ]
  });
  
  const result = await model;
  // Note: Gemini returns text or image parts. For real bg removal, we might need a specific model or clever prompting.
  // In a real app, you'd use a dedicated BG removal API, but we'll simulate/prompt Gemini here.
  return result.text; 
};

export const enhancePhoto = async (base64Image: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          { text: "Enhance this photo: improve lighting, color balance, and sharpness. Return the enhanced image as base64." },
          { inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }
        ]
      }
    ]
  });
  
  const result = await model;
  return result.text;
};

export const generateImage = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
    config: {
      imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
        }
    },
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
