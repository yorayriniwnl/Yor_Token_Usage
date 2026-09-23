import { encode as encodeO200k } from "gpt-tokenizer";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";

(globalThis as any).YorTokenizers = Object.freeze({
  o200k_base: encodeO200k,
  cl100k_base: encodeCl100k
});
