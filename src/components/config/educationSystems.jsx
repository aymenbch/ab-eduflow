// Education system configurations
export const EDUCATION_SYSTEMS = {
  francais: {
    label: "Système Français",
    flag: "🇫🇷",
    description: "École primaire, collège, lycée",
    cycles: [
      {
        name: "École Primaire",
        levels: ["CP", "CE1", "CE2", "CM1", "CM2"],
      },
      {
        name: "Collège",
        levels: ["6ème", "5ème", "4ème", "3ème"],
      },
      {
        name: "Lycée",
        levels: ["2nde", "1ère", "Terminale"],
      },
    ],
    allLevels: ["CP", "CE1", "CE2", "CM1", "CM2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"],
  },
  tunisien: {
    label: "Système Tunisien",
    flag: "🇹🇳",
    description: "Primaire, collège, lycée",
    cycles: [
      {
        name: "École Primaire",
        levels: ["1ère AP", "2ème AP", "3ème AP", "4ème AP", "5ème AP", "6ème AP"],
      },
      {
        name: "Collège (Préparatoire)",
        levels: ["7ème de base", "8ème de base", "9ème de base"],
      },
      {
        name: "Lycée (Secondaire)",
        levels: ["1ère Sec", "2ème Sec", "3ème Sec", "4ème Sec"],
      },
    ],
    allLevels: ["1ère AP", "2ème AP", "3ème AP", "4ème AP", "5ème AP", "6ème AP", "7ème de base", "8ème de base", "9ème de base", "1ère Sec", "2ème Sec", "3ème Sec", "4ème Sec"],
  },
  canadien: {
    label: "Système Canadien",
    flag: "🇨🇦",
    description: "Primaire, secondaire (Québec)",
    cycles: [
      {
        name: "École Primaire",
        levels: ["1re année", "2e année", "3e année", "4e année", "5e année", "6e année"],
      },
      {
        name: "École Secondaire",
        levels: ["Sec 1", "Sec 2", "Sec 3", "Sec 4", "Sec 5"],
      },
    ],
    allLevels: ["1re année", "2e année", "3e année", "4e année", "5e année", "6e année", "Sec 1", "Sec 2", "Sec 3", "Sec 4", "Sec 5"],
  },
  ib: {
    label: "Baccalauréat International (IB)",
    flag: "🌍",
    description: "Programme IB — PYP, MYP, DP",
    cycles: [
      {
        name: "PYP (Primary Years Programme)",
        levels: ["PYP 1", "PYP 2", "PYP 3", "PYP 4", "PYP 5", "PYP 6"],
      },
      {
        name: "MYP (Middle Years Programme)",
        levels: ["MYP 1", "MYP 2", "MYP 3", "MYP 4", "MYP 5"],
      },
      {
        name: "DP (Diploma Programme)",
        levels: ["DP 1", "DP 2"],
      },
    ],
    allLevels: ["PYP 1", "PYP 2", "PYP 3", "PYP 4", "PYP 5", "PYP 6", "MYP 1", "MYP 2", "MYP 3", "MYP 4", "MYP 5", "DP 1", "DP 2"],
  },
};

export const DEFAULT_SYSTEM = "francais";

export function getEducationSystem() {
  return localStorage.getItem("edugest_education_system") || DEFAULT_SYSTEM;
}

export function setEducationSystem(system) {
  localStorage.setItem("edugest_education_system", system);
}

export function getCurrentLevels() {
  const system = getEducationSystem();
  return EDUCATION_SYSTEMS[system]?.allLevels || EDUCATION_SYSTEMS.francais.allLevels;
}

export function getCurrentSystemConfig() {
  const system = getEducationSystem();
  return EDUCATION_SYSTEMS[system] || EDUCATION_SYSTEMS.francais;
}