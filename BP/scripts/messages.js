export function text(value) {
  return { text: String(value ?? "") };
}

export function translate(key, values = undefined) {
  const message = { translate: key };
  if (Array.isArray(values) && values.length) message.with = values;
  return message;
}

export function raw(parts) {
  const rawtext = [];
  for (const part of parts.flat(Infinity)) {
    if (part === undefined || part === null) continue;
    rawtext.push(typeof part === "string" ? text(part) : part);
  }
  return { rawtext };
}

export function titleCase(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.\/+\-:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

export function entryName(entry) {
  if (typeof entry?.s === "string" && entry.o !== true) return translate(entry.s);
  if (typeof entry?.n === "string") return translate(entry.n);
  if (typeof entry?.s === "string") return translate(entry.s);
  return text(entry?.x || entry?.d || titleCase(entry?.i?.split(":").pop()) || "Unknown Content");
}

export function sourceName(entry) {
  if (typeof entry?.sk === "string") return translate(entry.sk);
  return text(entry?.a || entry?.sourceName || entry?.sourceId || "Unknown Add-on");
}

export function sourceListName(source) {
  if (typeof source?.key === "string") return translate(source.key);
  return text(source?.name || source?.id || "Unknown Add-on");
}
