/**
 * VRAM requirements for popular AI models.
 * Numbers are typical loaded-weight VRAM (no KV cache headroom included).
 * Community can extend this list over time.
 */

export interface ModelQuantization {
  label: string;
  vram_mb: number;
}

export interface ModelEntry {
  name: string;
  family: string;
  params: string;
  quantizations: ModelQuantization[];
}

export const MODEL_DATABASE: ModelEntry[] = [
  {
    name: "Llama 3.1 8B",
    family: "Llama",
    params: "8B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 5500 },
      { label: "Q8_0", vram_mb: 9200 },
      { label: "FP16", vram_mb: 16400 },
    ],
  },
  {
    name: "Llama 3.1 70B",
    family: "Llama",
    params: "70B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 40960 },
      { label: "Q8_0", vram_mb: 74000 },
    ],
  },
  {
    name: "Llama 3.2 3B",
    family: "Llama",
    params: "3B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 2400 },
      { label: "Q8_0", vram_mb: 3700 },
      { label: "FP16", vram_mb: 6500 },
    ],
  },
  {
    name: "Mistral 7B",
    family: "Mistral",
    params: "7B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 4800 },
      { label: "Q8_0", vram_mb: 8200 },
      { label: "FP16", vram_mb: 14800 },
    ],
  },
  {
    name: "Mixtral 8x7B",
    family: "Mistral",
    params: "47B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 27000 },
      { label: "Q8_0", vram_mb: 50000 },
    ],
  },
  {
    name: "Phi-3 Mini",
    family: "Phi",
    params: "3.8B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 2800 },
      { label: "Q8_0", vram_mb: 4600 },
      { label: "FP16", vram_mb: 7800 },
    ],
  },
  {
    name: "Qwen 2.5 7B",
    family: "Qwen",
    params: "7B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 5000 },
      { label: "Q8_0", vram_mb: 8500 },
      { label: "FP16", vram_mb: 15200 },
    ],
  },
  {
    name: "Qwen 2.5 14B",
    family: "Qwen",
    params: "14B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 9500 },
      { label: "Q8_0", vram_mb: 16800 },
    ],
  },
  {
    name: "Gemma 2 9B",
    family: "Gemma",
    params: "9B",
    quantizations: [
      { label: "Q4_K_M", vram_mb: 6200 },
      { label: "Q8_0", vram_mb: 10500 },
      { label: "FP16", vram_mb: 18500 },
    ],
  },
  {
    name: "Stable Diffusion 1.5",
    family: "Stable Diffusion",
    params: "0.9B",
    quantizations: [
      { label: "FP16", vram_mb: 2200 },
      { label: "FP32", vram_mb: 4200 },
    ],
  },
  {
    name: "Stable Diffusion XL",
    family: "Stable Diffusion",
    params: "SDXL",
    quantizations: [
      { label: "FP16", vram_mb: 6500 },
      { label: "FP32", vram_mb: 12000 },
    ],
  },
  {
    name: "FLUX.1 Dev",
    family: "FLUX",
    params: "12B",
    quantizations: [
      { label: "FP16", vram_mb: 24000 },
      { label: "FP8", vram_mb: 12000 },
      { label: "NF4", vram_mb: 7000 },
    ],
  },
  {
    name: "FLUX.1 Schnell",
    family: "FLUX",
    params: "12B",
    quantizations: [
      { label: "FP16", vram_mb: 24000 },
      { label: "FP8", vram_mb: 12000 },
    ],
  },
];
