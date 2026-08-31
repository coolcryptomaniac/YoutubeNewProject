'use strict';

// Ridge free-only provider policy. Automatic paid fallback is intentionally impossible here.
export const RIDGE_FREE_POLICY_VERSION='2026-08-31';
export const WORKERS_AI_DAILY_NEURON_BUDGET=10000;
export const GROQ_FREE_LIMITS={
  'whisper-large-v3-turbo':{rpd:2000,audioSecondsPerDay:28800},
  'whisper-large-v3':{rpd:2000,audioSecondsPerDay:28800},
  'openai/gpt-oss-20b':{rpd:1000,tokensPerDay:200000},
  'openai/gpt-oss-120b':{rpd:1000,tokensPerDay:200000},
  'qwen/qwen3.8-27b':{rpd:1000,tokensPerDay:2000000}
};
export const FREE_WORKERS_AI_TEXT_MODELS=[
  '@cf/zai-org/glm-4.7-flash',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/nvidia/nemotron-3-120b-a12b'
];
export const WORKERS_AI_PAID_ONLY_BLOCKLIST=[
  '@cf/moonshotai/kimi-k2.6',
  '@cf/moonshotai/kimi-k2.7-code',
  '@cf/zai-org/glm-5.2',
  '@cf/zai-org/glm-5.3',
  '@cf/zai-org/glm-5.3-flash',
  '@cf/deepseek-ai/deepseek-v4-flash-0731',
  '@cf/deepseek-ai/deepseek-v4-pro-0813'
];
export const RETIRED_OR_DISABLED=[
  'meta/llama-3.3-70b-instruct',
  'imagen-4',
  'gemini-omni-flash-preview'
];
export const PAID_MEDIA_PROVIDERS=['veo','lyria','replicate','gemini-image','imagen','huggingface-paid-video'];

export function isWorkersAiFreeModel(model=''){
  return FREE_WORKERS_AI_TEXT_MODELS.includes(String(model));
}
export function assertFreeWorkersAiModel(model=''){
  if(!isWorkersAiFreeModel(model))throw new Error(`Workers AI model is not approved for Ridge free-only routing: ${model}`);
  return model;
}
export function freePolicyCapabilities(env={}){
  return {
    version:RIDGE_FREE_POLICY_VERSION,
    paidFallback:false,
    workersAI:{enabled:!!env.AI,dailyNeuronBudget:WORKERS_AI_DAILY_NEURON_BUDGET,models:FREE_WORKERS_AI_TEXT_MODELS},
    groq:{enabled:!!env.GROQ_API_KEY,models:Object.keys(GROQ_FREE_LIMITS),limits:GROQ_FREE_LIMITS},
    geminiEmbedding2:{enabled:false,reason:'experiment stays off until Ridge can enforce project-level no-billing rather than merely trust an API key'},
    mistralLocal:{enabled:false,mode:'local/self-hosted only',candidates:['Mistral Small 4','Ministral 3 3B','Ministral 3 8B','Voxtral Realtime']},
    mediaGeneration:{automatic:false,blockedPaidProviders:PAID_MEDIA_PROVIDERS},
    browser:{cloudflareBrowserRun:true,kitesurfExperiment:false,reason:'do not replace the proven Vusic Browser Run path until Kitesurf exposes a compatible stable automation contract'},
    retiredOrDisabled:RETIRED_OR_DISABLED
  };
}
