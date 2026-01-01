import { GoogleGenAI, Type } from "@google/genai";
import { QuestionType, QuizConfig } from "./types";

declare const process: {
  env: {
    API_KEY: string;
  };
};

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

export const generateQuizFromImage = async (base64Data: string, config: QuizConfig) => {
  // استخراج النوع من الـ base64 إذا وجد (مثال: data:image/png;base64,...)
  let mimeType = "image/jpeg";
  let data = base64Data;
  if (base64Data.includes(";base64,")) {
    const parts = base64Data.split(";base64,");
    mimeType = parts[0].split(":")[1];
    data = parts[1];
  }

  // Initialize GoogleGenAI directly with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    // Parse the trimmed text directly since responseMimeType is application/json
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "FAILED_TO_GENERATE");
  }
};

export const generateQuizFromText = async (inputText: string, config: QuizConfig) => {
  // Initialize GoogleGenAI directly with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this text: "${inputText}", ${getSystemInstruction(config)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUIZ_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("EMPTY_RESPONSE");
    // Parse the trimmed text directly since responseMimeType is application/json
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "FAILED_TO_GENERATE");
  }
};