export interface TagColor {
  color: string;
  bg: string;
  border: string;
}

export const TAG_COLORS: Record<string, TagColor> = {
  leadership: {
    color: "#D4863C",
    bg: "rgba(212,134,60,0.12)",
    border: "rgba(212,134,60,0.3)",
  },
  technical: {
    color: "#6B8AE0",
    bg: "rgba(107,138,224,0.12)",
    border: "rgba(107,138,224,0.3)",
  },
  collaboration: {
    color: "#4CAF82",
    bg: "rgba(76,175,130,0.12)",
    border: "rgba(76,175,130,0.3)",
  },
  "problem-solving": {
    color: "#C978D6",
    bg: "rgba(201,120,214,0.12)",
    border: "rgba(201,120,214,0.3)",
  },
  communication: {
    color: "#E0C46B",
    bg: "rgba(224,196,107,0.12)",
    border: "rgba(224,196,107,0.3)",
  },
  mentoring: {
    color: "#E07272",
    bg: "rgba(224,114,114,0.12)",
    border: "rgba(224,114,114,0.3)",
  },
};
