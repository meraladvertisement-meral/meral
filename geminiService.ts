
import { GoogleGenAI, Type } from "@google/genai";
import { QuestionType, QuizConfig } from "./types";

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
  // استخدام المفتاح من بيئة العمل
  const apiKey = process.env.API_KEY;
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
  return JSON.parse(response.text.trim());
};

export const generateQuizFromText = async (inputText: string, config: QuizConfig) => {
  const apiKey = process.env.API_KEY;
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
  return JSON.parse(response.text.trim());
};
