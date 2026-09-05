/** @type {import("prettier").Config} */
const config = {
  // Valores por defecto de Prettier (comillas dobles, punto y coma, 80 columnas).
  // El único agregado es el plugin que ordena las clases de Tailwind.
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
