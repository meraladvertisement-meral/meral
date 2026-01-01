import { GoogleGenAI, Type } from "@google/genai";
import { QuestionType, QuizConfig } from "./types";

// Define the schema for structured JSON output from Gemini
const QUIZ_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: { type: Type.STRING },
      question: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING },
    },
    required: ["id", "type", "question", "options", "correctAnswer"],
  },
};

const getSystemInstruction = (config: QuizConfig) => {
  const langMap = { ar: 'Arabic', en: 'English', de: 'German' };
  const typesDesc = config.allowedTypes.map(t => {
    if (t === QuestionType.MULTIPLE_CHOICE) return "Multiple Choice (4 options)";
    if (t === QuestionType.TRUE_FALSE) return "True/False";
    if (t === QuestionType.FILL_BLANKS) return "short Fill-in-the-blanks (one or two words maximum)";
    return "";
  }).join(", ");

  return `You are an educational expert. Generate a quiz with exactly ${config.count} questions.
  Difficulty Level: ${config.difficulty}. 
  Language: ${langMap[config.language]}.
  Allowed question types: ${typesDesc}.
  Return strictly JSON array. No markdown.`;
};

/**
 * Analyzes an image and generates a quiz using gemini-3-pro-preview.
 */
export const generateQuizFromImage = async (base64Data: string, config: QuizConfig) => {
  let mimeType = "image/jpeg";
  let data = base64Data;
  if (base64Data.includes(";base64,")) {
    const parts = base64Data.split(";base64,");
    mimeType = parts[0].split(":")[1];
    data = parts[1];
  }

  // Initialize GoogleGenAI using process.env.API_KEY directly as per guidelines.
  // We use gemini-3-pro-preview for complex educational analysis and reasoning.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: data } },
          { text: `Analyze this image and create an educational quiz. ${getSystemInstruction(config)}` },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: QUIZ_SCHEMA,
      },
    });

    // Access the text property directly on the response object.
    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "FAILED_TO_GENERATE");
  }
};

/**
 * Generates a quiz from text input using gemini-3-pro-preview.
 */
export const generateQuizFromText = async (inputText: string, config: QuizConfig) => {
  // Initialize GoogleGenAI using process.env.API_KEY directly as per guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Based on this text: "${inputText}", ${getSystemInstruction(config)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUIZ_SCHEMA,
      },
    });

    // Access the text property directly on the response object.
    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "FAILED_TO_GENERATE");
  }
};
