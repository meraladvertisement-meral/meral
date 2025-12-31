
import { GoogleGenAI, Type } from "@google/genai";
import { QuestionType, QuizConfig } from "./types";

// إخبار TypeScript أن process موجود عالمياً لتجنب خطأ TS2580
const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is missing from environment variables.");



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
  Ensure the questions are engaging for children.
  Allowed question types: ${typesDesc}.
  Strictly return only the JSON array.`;
};

export const generateQuizFromImage = async (base64Image: string, config: QuizConfig) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("API_KEY is missing from environment variables.");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        { text: `Analyze this image and create a quiz based on its educational content. ${getSystemInstruction(config)}` },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: QUIZ_SCHEMA,
    },
  });

 const text = response.text ?? "";
if (!text.trim()) {
  throw new Error("Empty response from model.");
}
return JSON.parse(text.trim());

};

export const generateQuizFromText = async (inputText: string, config: QuizConfig) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("API_KEY is missing from environment variables.");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this text: "${inputText}", ${getSystemInstruction(config)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: QUIZ_SCHEMA,
    },
  });

  const text = response.text;
  if (typeof text !== 'string') {
    throw new Error("Model failed to generate a valid text response.");
  }
  return JSON.parse(text.trim());
};
