// Fonte: Copy Deck v2.0, secao 11. Lista de parceiros ativada com assets locais
// de src/assets/images/encontrar (PRD v1.2, secao 18; Especificacao Funcional, secao 6.10).
import type { OndeComprarContent } from "./OndeComprar.types";

import lupiLogo from "../../assets/images/encontrar/Ativo-1Lupi_com_Cachorro_Gato (2).png";
import tudoBichoLogo from "../../assets/images/encontrar/TudodeBicho-Logomarca.png";
import tudoBichoNegLogo from "../../assets/images/encontrar/TudodeBicho_RGB_Horizontal_Negativo - Logomarca.png";
import manadaLogo from "../../assets/images/encontrar/manada.jpeg";

export const ondeComprarContent: OndeComprarContent = {
  heading: "Onde encontrar Veggiedent® ",
  intro:
    "A Virbac não vende diretamente ao consumidor final. Encontre Veggiedent com os parceiros abaixo.",
  partners: [
    {
      nome: "Lupi",
      logoUrl: lupiLogo,
      link: "#",
    },
    {
      nome: "Tudo de Bicho",
      logoUrl: tudoBichoLogo,
      link: "#",
    },
    {
      nome: "Tudo de Bicho",
      logoUrl: tudoBichoNegLogo,
      link: "#",
    },
    {
      nome: "Manada",
      logoUrl: manadaLogo,
      link: "#",
    },
  ],
};
