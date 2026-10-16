import "server-only";

import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

import type { ConfigIA } from "@/lib/ai/config";

/**
 * HU-15 · El único archivo de la aplicación que conoce al proveedor del LLM
 * (RNF-12). Cambiar de Groq a otro es agregar un caso aquí, un valor en
 * `PROVEEDORES` y la variable `IA_PROVEEDOR`; el resto del código recibe un
 * `LanguageModel` y no sabe de quién es.
 */
export function crearModelo(config: ConfigIA): LanguageModel {
  switch (config.proveedor) {
    case "groq":
      return createGroq({ apiKey: config.apiKey })(config.modelo);
  }
}
