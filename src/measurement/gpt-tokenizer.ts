import { encode } from "gpt-tokenizer";
(globalThis as any).GptTokenizer_encode = encode;
