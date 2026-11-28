/** XP levels (pure, unit tested): each level needs 100 XP more than the previous one. */
export function levelFromXp(xp: number): { level: number; into: number; need: number; progress: number } {
  let level = 1;
  let floor = 0;
  let need = 100;
  const total = Math.max(0, Math.floor(xp));
  while (total >= floor + need) {
    floor += need;
    level++;
    need = level * 100;
  }
  const into = total - floor;
  return { level, into, need, progress: need ? into / need : 0 };
}

export const LEVEL_TITLES = ["Boshlovchi", "Izlanuvchi", "Bilimdon", "Tajribali", "Usta", "Ekspert", "Ustoz", "Afsona"];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, level - 1)];

/** Greeting by Uzbekistan hour. */
export function greeting(hour: number): { text: string; part: "tong" | "kun" | "kech" | "tun" } {
  if (hour >= 5 && hour < 12) return { text: "Xayrli tong", part: "tong" };
  if (hour >= 12 && hour < 18) return { text: "Xayrli kun", part: "kun" };
  if (hour >= 18 && hour < 23) return { text: "Xayrli kech", part: "kech" };
  return { text: "Xayrli tun", part: "tun" };
}

export const QUOTES = [
  "Har kuni ozgina — natija katta bo‘ladi.",
  "Xato — o‘rganishning eng qisqa yo‘li.",
  "Bugungi 20 daqiqa ertangi ishonchdir.",
  "Takrorlash — bilimning onasi.",
  "Kichik qadamlar ham oldinga olib boradi.",
  "Imtihon — bilimni ko‘rsatish imkoniyati.",
];
